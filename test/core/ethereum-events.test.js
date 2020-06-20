'use strict';
const chai = require('chai');
const sinon = require('sinon');
const BlockStatus = require('../../lib/util/block-status');
const EthereumEvents = require('../../lib/core/ethereum-events');

chai.should();

describe('Ethereum Events', function () {
  beforeEach(function () {
    const web3 = sinon.stub();
    const contracts = [];

    this.ethereumEvents = new EthereumEvents(web3, contracts);
  });

  afterEach(function () {
    sinon.restore();
  });

  it('should start listening', function () {
    sinon.stub(this.ethereumEvents._polling, 'start');

    this.ethereumEvents.start();
    this.ethereumEvents._polling.start.called.should.be.true;
  });

  it('should emit a new block', function () {
    const status = BlockStatus.CONFIRMED;
    const block = { number: 2, status: status, events: [{ name: 'Event' }] };
    const blockCb = sinon.stub();

    this.ethereumEvents.on('block.' + status, blockCb);
    this.ethereumEvents._polling._emitter.emit('block', block);

    blockCb.calledWith(block.number, block.events).should.be.true;
  });

  it('should not emit a new block with the same status if done callback is not called', function () {
    const status = BlockStatus.CONFIRMED;
    const blocks = [
      { number: 2, status: status, events: [{ name: 'Event' }] },
      { number: 3, status: status, events: [{ name: 'AnotherEvent' }] }
    ];

    const blockCb = sinon.stub();

    this.ethereumEvents.on('block.' + status, blockCb);

    for (const block of blocks) {
      this.ethereumEvents._polling._emitter.emit('block', block);
    }

    blockCb.callCount.should.be.equal(1);
    blockCb.calledWith(blocks[0].number, blocks[0].events).should.be.true;
  });

  it('should not emit a new block with the same status if done callback is called with an argument', function () {
    const status = BlockStatus.CONFIRMED;
    const blocks = [
      { number: 2, status: status, events: [{ name: 'Event' }] },
      { number: 3, status: status, events: [{ name: 'AnotherEvent' }] }
    ];

    const blockCb = sinon.stub().onFirstCall().callsArgWith(2, 'Error');

    this.ethereumEvents.on('block.' + status, blockCb);

    for (const block of blocks) {
      this.ethereumEvents._polling._emitter.emit('block', block);
    }

    blockCb.callCount.should.be.equal(2);
    blockCb.calledWith(blocks[0].number, blocks[0].events).should.be.true;
    blockCb.calledWith(blocks[1].number, blocks[1].events).should.be.false;
  });

  it('should emit a new block with same status after done callback is called without arguments', function () {
    const status = BlockStatus.CONFIRMED;
    const blocks = [
      { number: 2, status: status, events: [{ name: 'Event' }] },
      { number: 3, status: status, events: [{ name: 'AnotherEvent' }] }
    ];

    const blockCb = sinon.stub().callsArg(2);

    this.ethereumEvents.on('block.' + status, blockCb);

    for (const block of blocks) {
      this.ethereumEvents._polling._emitter.emit('block', block);
    }

    blockCb.callCount.should.be.equal(2);
  });

  it('should emit a new block with different status even if done callback is not called', function () {
    const confirmedBlock = { number: 2, status: BlockStatus.CONFIRMED, events: [{ name: 'Event' }] };
    const unconfirmedBlock = { number: 3, status: BlockStatus.UNCONFIRMED, events: [{ name: 'AnotherEvent' }] };

    const confirmedBlockCb = sinon.stub();
    const unconfirmedBlockCb = sinon.stub();

    this.ethereumEvents.on('block.' + BlockStatus.CONFIRMED, confirmedBlockCb);
    this.ethereumEvents.on('block.' + BlockStatus.UNCONFIRMED, unconfirmedBlockCb);

    this.ethereumEvents._polling._emitter.emit('block', confirmedBlock);
    this.ethereumEvents._polling._emitter.emit('block', unconfirmedBlock);

    confirmedBlockCb.callCount.should.be.equal(1);
    confirmedBlockCb.calledWith(confirmedBlock.number, confirmedBlock.events).should.be.true;
    unconfirmedBlockCb.callCount.should.be.equal(1);
    unconfirmedBlockCb.calledWith(unconfirmedBlock.number, unconfirmedBlock.events).should.be.true;
  });

  it('should emit an error', function () {
    const error = new Error();
    const blockCb = sinon.stub();

    this.ethereumEvents.on('error', blockCb);
    this.ethereumEvents._polling._emitter.emit('error', error);

    blockCb.calledWith(error).should.be.true;
  });

  it('should stop listening', function () {
    sinon.stub(this.ethereumEvents._polling, 'stop');

    const status = BlockStatus.CONFIRMED;
    const block = { number: 2, status: status, events: [{ name: 'Event' }] };
    const blockCb = sinon.stub();

    this.ethereumEvents.on('block.' + status, blockCb);
    this.ethereumEvents.stop();
    this.ethereumEvents._polling._emitter.emit('block', block);

    blockCb.called.should.be.false;
    this.ethereumEvents._polling.stop.called.should.be.true;
  });
});
