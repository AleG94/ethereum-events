'use strict';
const chai = require('chai');
const sinon = require('sinon');
const EventFetcher = require('../../lib/core/event-fetcher');
const BlockPolling = require('../../lib/core/block-polling');
const BlockStatus = require('../../lib/util/block-status');
const { BlockNotFoundError } = require('../../lib/errors');

chai.should();

describe('Block Polling', function () {
  const chunkSize = 100;
  const confirmations = 12;
  const pollInterval = 5000;
  const backoff = 1000;

  beforeEach(function () {
    const options = {
      chunkSize: chunkSize,
      confirmations: confirmations,
      pollInterval: pollInterval,
      backoff: backoff
    };

    this.web3 = {
      eth: {
        getBlockNumber: sinon.stub()
      }
    };

    this.eventFetcher = sinon.createStubInstance(EventFetcher);
    this.polling = new BlockPolling(this.web3, this.eventFetcher, options);
    this.clock = sinon.useFakeTimers();
  });

  afterEach(function () {
    sinon.restore();
  });

  it('should start polling from a specific block', async function () {
    const startBlock = 20;
    const latestBlock = 50;

    this.eventFetcher.getEvents.resolves([]);
    this.web3.eth.getBlockNumber.resolves(latestBlock);

    this.polling.start(startBlock);

    this.polling.isRunning().should.be.true;

    await this.clock.tickAsync();

    this.eventFetcher.getEvents.calledWith(startBlock, latestBlock).should.be.true;
  });

  it('should start polling from latest block if an initial block is not provided', async function () {
    const latestBlock = 50;

    this.eventFetcher.getEvents.resolves([]);
    this.web3.eth.getBlockNumber.resolves(latestBlock);

    this.polling.start();

    this.polling.isRunning().should.be.true;

    await this.clock.tickAsync();

    this.eventFetcher.getEvents.calledWith(latestBlock, latestBlock).should.be.true;
  });

  it('should poll up to latest block if n° of blocks <= chunkSize', async function () {
    const latestBlock = chunkSize * 5;
    const startBlock = latestBlock - chunkSize + 1;

    this.eventFetcher.getEvents.resolves([]);
    this.web3.eth.getBlockNumber.resolves(latestBlock);

    this.polling.start(startBlock);

    await this.clock.tickAsync();

    this.eventFetcher.getEvents.calledWith(startBlock, latestBlock).should.be.true;
  });

  it('should poll a single chunk if n° of blocks > chunkSize', async function () {
    const latestBlock = chunkSize * 5;
    const startBlock = latestBlock - chunkSize * 2;
    const toBlock = startBlock + chunkSize - 1;

    this.eventFetcher.getEvents.resolves([]);
    this.web3.eth.getBlockNumber.resolves(latestBlock);

    this.polling.start(startBlock);

    await this.clock.tickAsync();

    this.eventFetcher.getEvents.calledWith(startBlock, toBlock).should.be.true;
  });

  it('should not look for events if there aren\'t any new blocks', async function () {
    const latestBlock = 50;

    this.eventFetcher.getEvents.resolves([]);
    this.web3.eth.getBlockNumber.resolves(latestBlock);

    this.polling.start();

    await this.clock.nextAsync();

    this.eventFetcher.getEvents.callCount.should.be.equal(1);
  });

  it('should stop polling', function () {
    this.polling.start();
    this.polling.stop();

    this.polling.isRunning().should.be.false;
  });

  context('blocks', function () {
    it('should emit an unconfirmed block', async function () {
      const latestBlock = 50;
      const blockNumber = latestBlock;
      const events = [{ name: 'Event', blockNumber: blockNumber }];
      const block = { number: blockNumber, status: BlockStatus.UNCONFIRMED, events: events };

      this.eventFetcher.getEvents.resolves(events);
      this.web3.eth.getBlockNumber.resolves(latestBlock);

      const blockCb = sinon.stub();

      this.polling.on('block', blockCb);
      this.polling.start(blockNumber);

      await this.clock.tickAsync();

      blockCb.calledWith(block).should.be.true;
    });

    it('should emit a confirmed block', async function () {
      const latestBlock = 50;
      const blockNumber = latestBlock - confirmations;
      const events = [{ name: 'Event', blockNumber: blockNumber }];
      const block = { number: blockNumber, status: BlockStatus.CONFIRMED, events: events };

      this.eventFetcher.getEvents.resolves(events);
      this.web3.eth.getBlockNumber.resolves(latestBlock);

      const blockCb = sinon.stub();

      this.polling.on('block', blockCb);
      this.polling.start(blockNumber);

      await this.clock.tickAsync();

      blockCb.calledWith(block).should.be.true;
    });

    it('should emit multiple blocks', async function () {
      const latestBlock = 50;
      const blockNumber = latestBlock - confirmations;
      const startBlock = blockNumber;
      const events = [{ name: 'Event', blockNumber: blockNumber }];
      const block = { number: blockNumber, status: BlockStatus.CONFIRMED, events: events };

      this.eventFetcher.getEvents.resolves(events);
      this.web3.eth.getBlockNumber.resolves(latestBlock);

      const blockCount = latestBlock - startBlock + 1;
      const blockCb = sinon.stub();

      this.polling.on('block', blockCb);
      this.polling.start(startBlock);

      await this.clock.tickAsync();

      blockCb.callCount.should.be.equal(blockCount);
      blockCb.calledWith(block).should.be.true;

      const otherBlocks = Array.from(Array(blockCount), (e, i) => i + startBlock)
        .filter(e => e !== block.number)
        .map(e => ({ number: e, status: BlockStatus.UNCONFIRMED, events: [] }));

      for (const otherBlock of otherBlocks) {
        blockCb.calledWith(otherBlock).should.be.true;
      }
    });

    context('after emitting an unconfirmed block', function () {
      const blockNumber = 20;
      const events = [{ name: 'Event', blockNumber: blockNumber }];
      const block = { number: blockNumber, status: BlockStatus.UNCONFIRMED, events: events };

      beforeEach(function () {
        this.eventFetcher.getEvents.onFirstCall().resolves(events);
        this.web3.eth.getBlockNumber.onFirstCall().resolves(blockNumber);
      });

      it('should not emit the block again if it\'s still unconfirmed and events did not change', async function () {
        const latestBlock = blockNumber + 1;

        this.eventFetcher.getEvents.resolves(events);
        this.web3.eth.getBlockNumber.resolves(latestBlock);

        const blockCb = sinon.stub();

        this.polling.on('block', blockCb);
        this.polling.start(blockNumber);

        await this.clock.nextAsync();

        blockCb.withArgs(block).calledOnce.should.be.true;
      });

      it('should emit the block again if it\'s still unconfirmed but events changed', async function () {
        const latestBlock = blockNumber + 1;
        const newEvents = [{ name: 'NewEvent', blockNumber: blockNumber }];
        const blockWithNewEvents = { ...block, events: newEvents };

        this.eventFetcher.getEvents.resolves(newEvents);
        this.web3.eth.getBlockNumber.resolves(latestBlock);

        const blockCb = sinon.stub();

        this.polling.on('block', blockCb);
        this.polling.start(blockNumber);

        await this.clock.nextAsync();

        blockCb.withArgs(block).calledOnce.should.be.true;
        blockCb.withArgs(blockWithNewEvents).calledOnce.should.be.true;
      });

      it('should emit the block again if its status changed to confirmed', async function () {
        const latestBlock = blockNumber + confirmations;
        const blockWithNewStatus = { ...block, status: BlockStatus.CONFIRMED };
        const blockCb = sinon.stub();

        this.eventFetcher.getEvents.resolves(events);
        this.web3.eth.getBlockNumber.resolves(latestBlock);

        this.polling.on('block', blockCb);
        this.polling.start(blockNumber);

        await this.clock.nextAsync();

        blockCb.withArgs(block).calledOnce.should.be.true;
        blockCb.withArgs(blockWithNewStatus).calledOnce.should.be.true;
      });
    });
  });

  context('restart', function () {
    it('should restart polling from the same block if it\'s still unconfirmed', async function () {
      const latestBlockOnFirstCall = 49;
      const latestBlockOnSecondCall = 50;
      const startBlock = latestBlockOnFirstCall - confirmations + 1;

      this.eventFetcher.getEvents.resolves([]);
      this.web3.eth.getBlockNumber
        .onFirstCall().resolves(latestBlockOnFirstCall)
        .onSecondCall().resolves(latestBlockOnSecondCall);

      this.polling.start(startBlock);

      await this.clock.nextAsync(pollInterval);

      this.eventFetcher.getEvents.firstCall.calledWith(startBlock, latestBlockOnFirstCall).should.be.true;
      this.eventFetcher.getEvents.secondCall.calledWith(startBlock, latestBlockOnSecondCall).should.be.true;
    });

    it('should restart polling from the latestConfirmedQueriedBlock + 1 if fromBlock is confirmed', async function () {
      const latestBlockOnFirstCall = 49;
      const latestBlockOnSecondCall = 50;
      const latestConfirmedQueriedBlockOnFirstCall = latestBlockOnFirstCall - confirmations;
      const startBlock = latestConfirmedQueriedBlockOnFirstCall - 1;

      this.eventFetcher.getEvents.resolves([]);
      this.web3.eth.getBlockNumber
        .onFirstCall().resolves(latestBlockOnFirstCall)
        .onSecondCall().resolves(latestBlockOnSecondCall);

      this.polling.start(startBlock);

      await this.clock.nextAsync(pollInterval);

      this.eventFetcher.getEvents.firstCall.calledWith(startBlock, latestBlockOnFirstCall).should.be.true;
      this.eventFetcher.getEvents.secondCall
        .calledWith(latestConfirmedQueriedBlockOnFirstCall + 1, latestBlockOnSecondCall).should.be.true;
    });

    it('should restart from the same block if an error occurs', async function () {
      const latestBlock = 50;
      const startBlock = latestBlock - confirmations;

      this.eventFetcher.getEvents.rejects(new Error());
      this.web3.eth.getBlockNumber.resolves(latestBlock);

      this.polling.on('error', sinon.stub());
      this.polling.start(startBlock);

      await this.clock.nextAsync(pollInterval);

      this.eventFetcher.getEvents.firstCall.calledWith(startBlock, latestBlock).should.be.true;
      this.eventFetcher.getEvents.secondCall.calledWith(startBlock, latestBlock).should.be.true;
    });

    it('should not restart polling if it was stopped', async function () {
      const latestBlockOnFirstCall = 49;
      const latestBlockOnSecondCall = 50;
      const startBlock = latestBlockOnFirstCall - confirmations;

      this.eventFetcher.getEvents.resolves([]);
      this.web3.eth.getBlockNumber
        .onFirstCall().resolves(latestBlockOnFirstCall)
        .onSecondCall().resolves(latestBlockOnSecondCall);

      this.polling.start(startBlock);
      this.polling.stop();

      await this.clock.nextAsync();

      this.eventFetcher.getEvents.calledOnce.should.be.true;
    });
  });

  context('errors', function () {
    beforeEach(function () {
      const latestBlock = 50;

      this.web3.eth.getBlockNumber.resolves(latestBlock);
    });

    it('should emit an error if an unknown error occurs', async function () {
      const error = new Error();
      const errorCb = sinon.stub();

      this.eventFetcher.getEvents.rejects(error);

      this.polling.on('error', errorCb);
      this.polling.start();

      await this.clock.tickAsync();

      errorCb.calledWith(error).should.be.true;
    });

    it('should not emit an error if BlockNotFound error occurs', async function () {
      const error = new BlockNotFoundError();
      const errorCb = sinon.stub();

      this.eventFetcher.getEvents.rejects(error);

      this.polling.on('error', errorCb);
      this.polling.start();

      await this.clock.tickAsync();

      errorCb.called.should.be.false;
    });
  });
});
