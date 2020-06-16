'use strict';
const EventEmitter = require('events');
const BlockPolling = require('./block-polling');
const BlockStatus = require('../util/block-status');

class EthereumEvents {
  constructor(web3, contracts, options = {}) {
    this._web3 = web3;
    this._polling = new BlockPolling(web3, contracts, options);
    this._emitter = new EventEmitter();
    this._queues = {};
    this._isConsuming = {};

    for (const status in BlockStatus) {
      this._queues[BlockStatus[status]] = [];
      this._isConsuming[BlockStatus[status]] = false;
    }

    this._polling.on('block', block => {
      this._queues[block.status].push(block);
      this._next(block.status);
    });
  }

  start() {
    this._polling.start();
  }

  on(event, callback) {
    this._emitter.on(event, callback);
  }

  _next(status) {
    const block = this._queues[status][0];

    if (block && !this._isConsuming[status]) {
      const doneCb = err => {
        if (err == null) {
          this._queues[status].shift();
        }

        this._isConsuming[status] = false;
        this._next(status);
      };

      this._isConsuming[status] = true;
      this._emitter.emit('block.' + status, block.number, block.events, doneCb);
    }
  }
}

module.exports = EthereumEvents;
