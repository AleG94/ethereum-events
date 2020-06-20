'use strict';
const chai = require('chai');
const sinon = require('sinon');
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

  it('should emit a new block', function (done) {
    const block = { number: 2, status: 'confirmed', events: [{ name: 'Event' }] };

    this.ethereumEvents.on('block.confirmed', (blockNumber, events) => {
      blockNumber.should.be.equal(block.number);
      events.should.be.deep.equal(block.events);
      done();
    });

    this.ethereumEvents._polling._emitter.emit('block', block);
  });

  it('should not emit a new block with the same status if done callback is not called', function () {
    const blocks = [
      { number: 2, status: 'confirmed', events: [{ name: 'Event' }] },
      { number: 3, status: 'confirmed', events: [{ name: 'AnotherEvent' }] }
    ];

    const blockCb = sinon.stub();

    this.ethereumEvents.on('block.confirmed', blockCb);

    for (const block of blocks) {
      this.ethereumEvents._polling._emitter.emit('block', block);
    }

    blockCb.callCount.should.be.equal(1);
    blockCb.calledWith(blocks[0].number, blocks[0].events).should.be.true;
  });

  it('should not emit a new block with the same status if done callback is called with an argument', function () {
    const blocks = [
      { number: 2, status: 'confirmed', events: [{ name: 'Event' }] },
      { number: 3, status: 'confirmed', events: [{ name: 'AnotherEvent' }] }
    ];

    const blockCb = sinon.stub().onFirstCall().callsArgWith(2, 'Error');

    this.ethereumEvents.on('block.confirmed', blockCb);

    for (const block of blocks) {
      this.ethereumEvents._polling._emitter.emit('block', block);
    }

    blockCb.callCount.should.be.equal(2);
    blockCb.calledWith(blocks[0].number, blocks[0].events).should.be.true;
    blockCb.calledWith(blocks[1].number, blocks[1].events).should.be.false;
  });

  it('should emit a new block with same status after done callback is called without arguments', function () {
    const blocks = [
      { number: 2, status: 'confirmed', events: [{ name: 'Event' }] },
      { number: 3, status: 'confirmed', events: [{ name: 'AnotherEvent' }] }
    ];

    const blockCb = sinon.stub().callsArg(2);

    this.ethereumEvents.on('block.confirmed', blockCb);

    for (const block of blocks) {
      this.ethereumEvents._polling._emitter.emit('block', block);
    }

    blockCb.callCount.should.be.equal(2);
  });

  it('should emit a new block with different status even if done callback is not called', function () {
    const blocks = [
      { number: 2, status: 'confirmed', events: [{ name: 'Event' }] },
      { number: 3, status: 'unconfirmed', events: [{ name: 'AnotherEvent' }] }
    ];

    const confirmedBlockCb = sinon.stub();
    const unconfirmedBlockCb = sinon.stub();

    this.ethereumEvents.on('block.confirmed', confirmedBlockCb);
    this.ethereumEvents.on('block.unconfirmed', unconfirmedBlockCb);

    for (const block of blocks) {
      this.ethereumEvents._polling._emitter.emit('block', block);
    }

    confirmedBlockCb.callCount.should.be.equal(1);
    unconfirmedBlockCb.callCount.should.be.equal(1);
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

    const block = { number: 2, status: 'confirmed', events: [{ name: 'Event' }] };
    const blockCb = sinon.stub();

    this.ethereumEvents.on('block.confirmed', blockCb);
    this.ethereumEvents.stop();
    this.ethereumEvents._polling._emitter.emit('block', block);

    blockCb.called.should.be.false;
    this.ethereumEvents._polling.stop.called.should.be.true;
  });
});
