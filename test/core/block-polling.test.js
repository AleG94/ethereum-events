'use strict';
const chai = require('chai');
const sinon = require('sinon');
const BlockPolling = require('../../lib/core/block-polling');
const event = require('../fixtures/event.json');
const BlockStatus = require('../../lib/util/block-status');
const { BlockNotFoundError } = require('../../lib/errors');

chai.should();

describe('Block Polling', function () {
  const latestBlock = event.blockNumber;
  const startBlock = event.blockNumber - 10;
  const chunkSize = 100;
  const confirmations = 12;
  const pollInterval = 5000;
  const backoff = 1000;
  const events = [event];

  beforeEach(function () {
    const web3 = {
      eth: {
        getBlockNumber: sinon.stub().resolves(latestBlock)
      }
    };

    const contracts = [];
    const options = {
      startBlock: startBlock,
      chunkSize: chunkSize,
      confirmations: confirmations,
      pollInterval: pollInterval,
      backoff: backoff
    };

    this.polling = new BlockPolling(web3, contracts, options);
    this.clock = sinon.useFakeTimers();
  });

  afterEach(function () {
    sinon.restore();
  });

  it('should start polling', function () {
    sinon.stub(this.polling, '_poll');

    this.polling.start();

    this.polling._running.should.be.true;
    this.polling._poll.calledWith(startBlock).should.be.true;
  });

  it('should poll from a specific block', async function () {
    sinon.stub(this.polling._eventFetcher, 'getEvents').resolves(events);

    await this.polling._poll(startBlock);

    this.polling._eventFetcher.getEvents.calledWith(startBlock, latestBlock).should.be.true;
  });

  it('should poll from latest block if an initial block is not provided', async function () {
    sinon.stub(this.polling._eventFetcher, 'getEvents').resolves(events);

    await this.polling._poll();

    this.polling._eventFetcher.getEvents.calledWith(latestBlock, latestBlock).should.be.true;
  });

  it('should poll up to latest block if n° of blocks <= chunkSize', async function () {
    sinon.stub(this.polling._eventFetcher, 'getEvents').resolves(events);

    const fromBlock = latestBlock - chunkSize + 1;

    await this.polling._poll(fromBlock);

    this.polling._eventFetcher.getEvents.calledWith(fromBlock, latestBlock).should.be.true;
  });

  it('should poll a single chunk if n° of blocks > chunkSize', async function () {
    sinon.stub(this.polling._eventFetcher, 'getEvents').resolves(events);

    const fromBlock = latestBlock - chunkSize * 2;
    const toBlock = fromBlock + chunkSize - 1;

    await this.polling._poll(fromBlock);

    this.polling._eventFetcher.getEvents.calledWith(fromBlock, toBlock).should.be.true;
  });

  it('should not look for events if there aren\'t any new blocks', async function () {
    sinon.stub(this.polling._eventFetcher, 'getEvents').resolves(events);

    await this.polling._poll(startBlock);

    this.polling._eventFetcher.getEvents.callCount.should.be.equal(1);

    await this.polling._poll(startBlock);

    this.polling._eventFetcher.getEvents.callCount.should.be.equal(1);
  });

  it('should stop polling', async function () {
    const block = { number: event.blockNumber, status: BlockStatus.UNCONFIRMED, events: events };
    const blockCb = sinon.stub();

    this.polling.on('block', blockCb);
    this.polling.stop();

    this.polling._running.should.be.false;

    this.polling._emitter.emit('block', block);

    blockCb.called.should.be.false;
  });

  context('blocks', function () {
    it('should get block status', function () {
      this.polling._getBlockStatus(latestBlock - confirmations, latestBlock).should.be.equal(BlockStatus.CONFIRMED);
      this.polling._getBlockStatus(latestBlock - 1, latestBlock).should.be.equal(BlockStatus.UNCONFIRMED);
    });

    it('should emit a confirmed block', function () {
      const block = { number: event.blockNumber, status: BlockStatus.CONFIRMED, events: events };
      const blockCb = sinon.stub();

      this.polling.on('block', blockCb);
      this.polling._notify(block.number, block.status, block.events);

      blockCb.callCount.should.be.equal(1);
      blockCb.calledWith(block).should.be.true;
    });

    it('should emit an unconfirmed block', function () {
      const block = { number: event.blockNumber, status: BlockStatus.UNCONFIRMED, events: events };
      const blockCb = sinon.stub();

      this.polling.on('block', blockCb);
      this.polling._notify(block.number, block.status, block.events);

      blockCb.callCount.should.be.equal(1);
      blockCb.calledWith(block).should.be.true;
    });

    it('should emit multiple blocks', async function () {
      const block = { number: event.blockNumber, status: BlockStatus.UNCONFIRMED, events: events };

      sinon.stub(this.polling._eventFetcher, 'getEvents').resolves(block.events);

      const blockCount = latestBlock - startBlock + 1;
      const blockCb = sinon.stub();

      this.polling.on('block', blockCb);

      await this.polling._poll(startBlock);

      blockCb.callCount.should.be.equal(blockCount);
      blockCb.calledWith(block).should.be.true;

      const blocksWithEmptyEvents = Array.from(Array(blockCount), (e, i) => i + startBlock)
        .filter(e => e !== block.number);

      for (const blockNumber of blocksWithEmptyEvents) {
        const emptyBlock = {
          number: blockNumber,
          status: this.polling._getBlockStatus(blockNumber, latestBlock - confirmations),
          events: []
        };

        blockCb.calledWith(emptyBlock).should.be.true;
      }
    });

    context('after emitting an unconfirmed block', function () {
      const block = { number: event.blockNumber, status: BlockStatus.UNCONFIRMED, events: events };

      beforeEach(function () {
        this.polling._notify(block.number, block.status, block.events);
      });

      it('should not emit the block again if it\'s still unconfirmed and events did not change', function () {
        const blockCb = sinon.stub();

        this.polling.on('block', blockCb);
        this.polling._notify(block.number, block.status, block.events);

        blockCb.callCount.should.be.equal(0);
      });

      it('should emit the block again if it\'s still unconfirmed but events changed', function () {
        const newEvents = [{ name: 'NewEvent' }];
        const blockWithNewEvents = { ...block, events: newEvents };
        const blockCb = sinon.stub();

        this.polling.on('block', blockCb);
        this.polling._notify(block.number, block.status, newEvents);

        blockCb.callCount.should.be.equal(1);
        blockCb.calledWith(blockWithNewEvents).should.be.true;
      });

      it('should emit the block again if its status changed to confirmed', function () {
        const status = BlockStatus.CONFIRMED;
        const blockWithNewStatus = { ...block, status: status };
        const blockCb = sinon.stub();

        this.polling.on('block', blockCb);
        this.polling._notify(block.number, status, block.events);

        blockCb.callCount.should.be.equal(1);
        blockCb.calledWith(blockWithNewStatus).should.be.true;
      });
    });
  });

  context('restart', function () {
    it('should restart polling from the same block if it\'s still unconfirmed', async function () {
      this.polling._running = true;

      sinon.stub(this.polling._eventFetcher, 'getEvents').resolves(events);
      sinon.stub(this.polling, '_poll')
        .onSecondCall().resolves()
        .callThrough();

      const fromBlock = latestBlock - confirmations + 2;

      await this.polling._poll(fromBlock);

      this.clock.tick(pollInterval);

      this.polling._poll.secondCall.calledWith(fromBlock).should.be.true;
    });

    it('should restart polling from the latestConfirmedQueriedBlock + 1 if fromBlock is confirmed', async function () {
      this.polling._running = true;

      sinon.stub(this.polling._eventFetcher, 'getEvents').resolves(events);
      sinon.stub(this.polling, '_poll')
        .onSecondCall().resolves()
        .callThrough();

      const latestConfirmedBlock = latestBlock - confirmations;
      const fromBlock = latestConfirmedBlock - 1;

      await this.polling._poll(fromBlock);

      this.clock.tick(pollInterval);

      this.polling._poll.secondCall.calledWith(latestConfirmedBlock + 1).should.be.true;
    });

    it('should backoff and restart from the same block if an error occurs', async function () {
      this.polling._running = true;

      sinon.stub(this.polling._eventFetcher, 'getEvents').rejects(new Error());
      sinon.stub(this.polling, '_poll')
        .onSecondCall().resolves()
        .callThrough();

      this.polling.on('error', sinon.stub());

      await this.polling._poll(startBlock);

      this.clock.tick(backoff);

      this.polling._poll.secondCall.calledWith(startBlock);
    });

    it('should not restart polling if it was stopped', async function () {
      this.polling._running = false;

      sinon.stub(this.polling._eventFetcher, 'getEvents').resolves(events);
      sinon.stub(this.polling, '_poll')
        .onSecondCall().resolves()
        .callThrough();

      const fromBlock = latestBlock - confirmations + 2;

      await this.polling._poll(fromBlock);

      this.clock.tick(pollInterval);

      this.polling._poll.callCount.should.be.equal(1);
    });
  });

  context('errors', function () {
    it('should emit an error if an unknown error occurs', async function () {
      const error = new Error();
      const errorCb = sinon.stub();

      sinon.stub(this.polling._eventFetcher, 'getEvents').rejects(error);

      this.polling.on('error', errorCb);

      await this.polling._poll(startBlock);

      errorCb.calledWith(error).should.be.true;
    });

    it('should not emit an error if BlockNotFound error occurs', async function () {
      const error = new BlockNotFoundError();
      const errorCb = sinon.stub();

      sinon.stub(this.polling._eventFetcher, 'getEvents').rejects(error);

      this.polling.on('error', errorCb);

      await this.polling._poll(startBlock);

      errorCb.called.should.be.false;
    });
  });
});
