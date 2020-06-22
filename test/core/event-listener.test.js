'use strict';
const chai = require('chai');
const sinon = require('sinon');
const EventEmitter = require('events');
const BlockStatus = require('../../lib/util/block-status');
const BlockPolling = require('../../lib/core/block-polling');
const EventListener = require('../../lib/core/event-listener');

chai.should();

describe('Event Listener', function () {
  beforeEach(function () {
    const emitter = new EventEmitter();

    this.polling = sinon.createStubInstance(BlockPolling, {
      on: sinon.stub().callsFake(emitter.on)
    });

    this.polling.emit = sinon.stub().callsFake(emitter.emit);

    this.eventListener = new EventListener(this.polling);
  });

  afterEach(function () {
    sinon.restore();
  });

  it('should start listening', function () {
    const startBlock = 20;

    this.eventListener.start(startBlock);

    this.eventListener.isRunning().should.be.true;
    this.polling.start.calledWith(startBlock).should.be.true;
  });

  context('when not running', function () {
    it('should not emit any block', function () {
      const status = BlockStatus.CONFIRMED;
      const block = { number: 2, status: status, events: [{ name: 'Event' }] };
      const blockCb = sinon.stub();

      this.eventListener.on('block.' + status, blockCb);
      this.polling.emit('block', block);

      blockCb.called.should.be.false;
    });

    it('should not emit any error', function () {
      const error = new Error();
      const blockCb = sinon.stub();

      this.eventListener.on('error', blockCb);
      this.polling.emit('error', error);

      blockCb.called.should.be.false;
    });
  });

  context('when running', function () {
    beforeEach(function () {
      this.eventListener.start();
    });

    it('should emit a new block', function () {
      const status = BlockStatus.CONFIRMED;
      const block = { number: 2, status: status, events: [{ name: 'Event' }] };
      const blockCb = sinon.stub();

      this.eventListener.on('block.' + status, blockCb);
      this.polling.emit('block', block);

      blockCb.calledWith(block.number, block.events).should.be.true;
    });

    it('should not emit a new block with the same status if done callback is not called', function () {
      const status = BlockStatus.CONFIRMED;
      const blocks = [
        { number: 2, status: status, events: [{ name: 'Event' }] },
        { number: 3, status: status, events: [{ name: 'AnotherEvent' }] }
      ];

      const blockCb = sinon.stub();

      this.eventListener.on('block.' + status, blockCb);

      for (const block of blocks) {
        this.polling.emit('block', block);
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

      this.eventListener.on('block.' + status, blockCb);

      for (const block of blocks) {
        this.polling.emit('block', block);
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

      this.eventListener.on('block.' + status, blockCb);

      for (const block of blocks) {
        this.polling.emit('block', block);
      }

      blockCb.callCount.should.be.equal(2);
    });

    it('should emit a new block with different status even if done callback is not called', function () {
      const confirmedBlock = { number: 2, status: BlockStatus.CONFIRMED, events: [{ name: 'Event' }] };
      const unconfirmedBlock = { number: 3, status: BlockStatus.UNCONFIRMED, events: [{ name: 'AnotherEvent' }] };

      const confirmedBlockCb = sinon.stub();
      const unconfirmedBlockCb = sinon.stub();

      this.eventListener.on('block.' + BlockStatus.CONFIRMED, confirmedBlockCb);
      this.eventListener.on('block.' + BlockStatus.UNCONFIRMED, unconfirmedBlockCb);

      this.polling.emit('block', confirmedBlock);
      this.polling.emit('block', unconfirmedBlock);

      confirmedBlockCb.callCount.should.be.equal(1);
      confirmedBlockCb.calledWith(confirmedBlock.number, confirmedBlock.events).should.be.true;
      unconfirmedBlockCb.callCount.should.be.equal(1);
      unconfirmedBlockCb.calledWith(unconfirmedBlock.number, unconfirmedBlock.events).should.be.true;
    });

    it('should emit an error', function () {
      const error = new Error();
      const blockCb = sinon.stub();

      this.eventListener.on('error', blockCb);
      this.polling.emit('error', error);

      blockCb.calledWith(error).should.be.true;
    });

    it('should stop listening', function () {
      this.eventListener.stop();

      this.eventListener.isRunning().should.be.false;
      this.polling.stop.called.should.be.true;
    });
  });
});
