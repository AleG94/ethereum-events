'use strict';
const EventEmitter = require('events');
const BlockStatus = require('../util/block-status');

class EventListener {
  constructor(polling) {
    this._polling = polling;
    this._emitter = new EventEmitter();
    this._running = false;
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

    this._polling.on('error', err => this._running && this._emitter.emit('error', err));
  }

  start(startBlock) {
    this._running = true;
    this._polling.start(startBlock);
  }

  stop() {
    this._running = false;
    this._polling.stop();
  }

  isRunning() {
    return this._running;
  }

  on(event, callback) {
    this._emitter.on(event, callback);
  }

  _next(status) {
    const block = this._queues[status][0];

    if (this._running && block && !this._processing[status]) {
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

module.exports = EventListener;
