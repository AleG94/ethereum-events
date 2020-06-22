'use strict';
const EventEmitter = require('events');
const { safeMemoryCache } = require('safe-memory-cache');
const config = require('../../config');
const BlockStatus = require('../util/block-status');
const { BlockNotFoundError } = require('../errors');

class BlockPolling {
  constructor(web3, eventFetcher, options = {}) {
    this._web3 = web3;
    this._eventFetcher = eventFetcher;
    this._emitter = new EventEmitter();
    this._running = false;
    this._chunkSize = options.chunkSize || config.chunkSize;
    this._pollInterval = options.pollInterval || config.pollInterval;
    this._confirmations = options.confirmations || config.confirmations;
    this._backoff = options.backoff || config.backoff;
    this._eventCache = safeMemoryCache({ limit: this._confirmations });
  }

  start(startBlock) {
    this._running = true;
    this._poll(startBlock);
  }

  stop() {
    this._running = false;
  }

  isRunning() {
    return this._running;
  }

  on(event, callback) {
    this._emitter.on(event, callback);
  }

  async _poll(fromBlock) {
    try {
      const latestBlock = await this._web3.eth.getBlockNumber();

      fromBlock = fromBlock || latestBlock;

      const toBlock = Math.min(fromBlock + this._chunkSize - 1, latestBlock);
      const latestConfirmedQueriedBlock = Math.min(toBlock, latestBlock - this._confirmations);

      if (toBlock !== this._latestQueriedBlock) {
        const events = await this._eventFetcher.getEvents(fromBlock, toBlock);

        for (let i = fromBlock; i <= toBlock; i++) {
          const status = this._getBlockStatus(i, latestBlock);
          const blockEvents = events.filter(e => e.blockNumber === i);

          this._notify(i, status, blockEvents);
        }

        this._latestQueriedBlock = toBlock;
      }

      const delay = toBlock === latestBlock ? this._pollInterval : 0;
      const nextBlock = Math.max(fromBlock, latestConfirmedQueriedBlock + 1);

      setTimeout(() => this._running && this._poll(nextBlock), delay);
    } catch (err) {
      if (!(err instanceof BlockNotFoundError)) {
        this._emitter.emit('error', err);
      }

      setTimeout(() => this._running && this._poll(fromBlock), this._backoff);
    }
  }

  _notify(blockNumber, status, events) {
    if (status === BlockStatus.CONFIRMED) {
      this._emitter.emit('block', { number: blockNumber, status: status, events: events });
    } else {
      const strBlockEvents = JSON.stringify(events);

      if (this._eventCache.get(blockNumber) !== strBlockEvents) {
        this._eventCache.set(blockNumber, strBlockEvents);
        this._emitter.emit('block', { number: blockNumber, status: status, events: events });
      }
    }
  }

  _getBlockStatus(blockNumber, latestBlock) {
    return blockNumber <= latestBlock - this._confirmations ? BlockStatus.CONFIRMED : BlockStatus.UNCONFIRMED;
  }
}

module.exports = BlockPolling;
