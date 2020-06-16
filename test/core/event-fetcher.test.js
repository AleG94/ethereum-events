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
  const contracts = [{ name: event.contract, address: event.to, abi: abi }];
  const addresses = contracts.map(e => e.address);

  beforeEach(function () {
    const web3 = {
      eth: {
        getBlock: sinon.stub().resolves(block),
        getPastLogs: sinon.stub().resolves([log])
      }
    };

    this.eventFetcher = new EventFetcher(web3, contracts);
  });

  afterEach(function () {
    sinon.restore();
  });

  it('should get events', async function () {
    const fromBlock = event.blockNumber - 1;
    const toBlock = event.blockNumber;
    const events = await this.eventFetcher.getEvents(fromBlock, toBlock);

    events.should.have.length(1);
    events[0].should.be.deep.equal(event);

    const logOpts = { address: addresses, fromBlock: fromBlock, toBlock: toBlock };

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
});