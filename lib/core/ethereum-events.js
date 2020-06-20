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
    this._processing = {};

    for (const status in BlockStatus) {
      this._queues[BlockStatus[status]] = [];
      this._processing[BlockStatus[status]] = false;
    }

    this._polling.on('block', block => {
      this._queues[block.status].push(block);
      this._next(block.status);
    });

    this._polling.on('error', err => this._emitter.emit('error', err));
  }

  start() {
    this._polling.start();
  }

  stop() {
    this._polling.stop();
    this._emitter.removeAllListeners();
  }

  on(event, callback) {
    this._emitter.on(event, callback);
  }

  _next(status) {
    const block = this._queues[status][0];

    if (block && !this._processing[status]) {
      const doneCb = err => {
        if (err == null) {
          this._queues[status].shift();
        }

        this._processing[status] = false;
        this._next(status);
      };

      this._processing[status] = true;
      this._emitter.emit('block.' + status, block.number, block.events, doneCb);
    }
  }
}

module.exports = EthereumEvents;
