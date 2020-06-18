'use strict';
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const sinon = require('sinon');
const event = require('../fixtures/event.json');
const log = require('../fixtures/log.json');
const abi = require('../fixtures/abi.json');
const block = require('../fixtures/block.json');
const EventFetcher = require('../../lib/core/event-fetcher');
const { BlockNotFoundError } = require('../../lib/errors');

chai.should();
chai.use(chaiAsPromised);

describe('Event Fetcher', function () {
  const blockHash = event.blockHash;
  const fromBlock = event.blockNumber - 1;
  const toBlock = event.blockNumber;
  const contract = { name: event.contract, address: event.to, abi: abi };

  beforeEach(function () {
    this.web3 = {
      eth: {
        getBlock: sinon.stub().withArgs(blockHash).resolves(block),
        getPastLogs: sinon.stub().resolves([log])
      }
    };

    this.eventFetcher = new EventFetcher(this.web3, [contract]);
  });

  afterEach(function () {
    sinon.restore();
  });

  it('should get events', async function () {
    const events = await this.eventFetcher.getEvents(fromBlock, toBlock);

    events.should.have.length(1);
    events[0].should.be.deep.equal(event);

    const logOpts = { address: [contract.address], fromBlock: fromBlock, toBlock: toBlock };

    this.eventFetcher._web3.eth.getPastLogs.calledWith(logOpts).should.be.true;
  });

  it('should get a block', async function () {
    const blocks = await this.eventFetcher._getBlocks([blockHash]);

    blocks[blockHash].should.be.deep.equal(block);

    this.eventFetcher._web3.eth.getBlock.called.should.be.true;
  });

  it('should throw an error if block is not available', function () {
    this.eventFetcher._web3.eth.getBlock.resolves(null);

    return this.eventFetcher._getBlocks([blockHash]).should.be.eventually.rejected
      .and.be.an.instanceOf(BlockNotFoundError);
  });

  context('after getting a block', function () {
    beforeEach(async function () {
      await this.eventFetcher._getBlocks([blockHash]);
    });

    it('should find the block in cache when getting it again', async function () {
      this.eventFetcher._web3.eth.getBlock.reset();

      const blocks = await this.eventFetcher._getBlocks([blockHash]);

      blocks[blockHash].should.be.deep.equal(block);

      this.eventFetcher._web3.eth.getBlock.called.should.be.false;
    });
  });

  context('events filter', function () {
    it('should get all events if filter is not provided', async function () {
      const eventFetcher = new EventFetcher(this.web3, [contract]);
      const events = await eventFetcher.getEvents(fromBlock, toBlock);

      events.should.have.length(1);
      events[0].should.be.deep.equal(event);
    });

    it('should get selected events if filter is provided', async function () {
      const contractWithFilters = { ...contract, events: [event.event] };
      const eventFetcher = new EventFetcher(this.web3, [contractWithFilters]);
      const events = await eventFetcher.getEvents(fromBlock, toBlock);

      events.should.have.length(1);
      events[0].should.be.deep.equal(event);
    });

    it('should get no events if none of them matches the filter', async function () {
      const contractWithFilters = { ...contract, events: ['RandomEvent'] };
      const eventFetcher = new EventFetcher(this.web3, [contractWithFilters]);
      const events = await eventFetcher.getEvents(fromBlock, toBlock);

      events.should.have.length(0);
    });
  });
});
