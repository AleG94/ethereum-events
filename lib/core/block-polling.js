'use strict';
const EventEmitter = require('events');
const { safeMemoryCache } = require('safe-memory-cache');
const EventFetcher = require('./event-fetcher');
const BlockStatus = require('../util/block-status');
const { BlockNotFoundError } = require('../errors');

const DEFAULT_POLL_INTERVAL = 13000;
const DEFAULT_CONFIRMATIONS = 12;
const DEFAULT_CHUNK_SIZE = 10000;
const DEFAULT_BACKOFF = 1000;

class BlockPolling {
  constructor(web3, contracts, options = {}) {
    this._web3 = web3;
    this._eventFetcher = new EventFetcher(web3, contracts, options);
    this._emitter = new EventEmitter();
    this._startBlock = options.startBlock;
    this._chunkSize = options.chunkSize || DEFAULT_CHUNK_SIZE;
    this._pollInterval = options.pollInterval || DEFAULT_POLL_INTERVAL;
    this._confirmations = options.confirmations || DEFAULT_CONFIRMATIONS;
    this._backoff = options.backoff || DEFAULT_BACKOFF;
    this._eventCache = safeMemoryCache({ limit: this._confirmations });
  }

  start() {
    this._poll(this._startBlock);
  }

  on(event, callback) {
    this._emitter.on(event, callback);
  }

  async _poll(fromBlock) {
    try {
      const latestBlock = await this._web3.eth.getBlockNumber();

      fromBlock = fromBlock || latestBlock;

      const toBlock = Math.min(fromBlock + this._chunkSize - 1, latestBlock);
      const latestConfirmedBlock = latestBlock - this._confirmations;
      const latestConfirmedQueriedBlock = Math.min(toBlock, latestConfirmedBlock);

      if (toBlock !== this._latestQueriedBlock) {
        const events = await this._eventFetcher.getEvents(fromBlock, toBlock);

        for (let i = fromBlock; i <= toBlock; i++) {
          const status = this._getBlockStatus(i, latestConfirmedBlock);
          const blockEvents = events.filter(e => e.blockNumber === i);

          this._notify(i, status, blockEvents);
        }

        this._latestQueriedBlock = toBlock;
      }

      const delay = toBlock === latestBlock ? this._pollInterval : 0;
      const nextBlock = Math.max(fromBlock, latestConfirmedQueriedBlock + 1);

      setTimeout(() => this._poll(nextBlock), delay);
    } catch (err) {
      if (!(err instanceof BlockNotFoundError)) {
        console.error(err);
      }

      setTimeout(() => this._poll(fromBlock), this._backoff);
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

  _getBlockStatus(blockNumber, latestConfirmedBlock) {
    return blockNumber <= latestConfirmedBlock ? BlockStatus.CONFIRMED : BlockStatus.UNCONFIRMED;
  }
}

module.exports = BlockPolling;