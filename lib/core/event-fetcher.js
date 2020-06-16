'use strict';
const asyncPool = require('tiny-async-pool');
const parseLog = require('eth-log-parser');
const { safeMemoryCache } = require('safe-memory-cache');
const { BlockNotFoundError } = require('../errors');

const DEFAULT_CONCURRENCY = 10;

class EventFetcher {
  constructor(web3, contracts, options = {}) {
    this._web3 = web3;
    this._contracts = contracts;
    this._addresses = contracts.map(e => e.address);
    this._concurrency = options.concurrency || DEFAULT_CONCURRENCY;
    this._blockCache = safeMemoryCache({ limit: 100 });
  }

  async getEvents(fromBlock, toBlock) {
    const logs = await this._web3.eth.getPastLogs({
      address: this._addresses,
      fromBlock: fromBlock,
      toBlock: toBlock
    });

    const parsedLogs = this._parse(logs);
    const events = await this._format(parsedLogs);

    return events;
  }

  _parse(logs) {
    return logs.map(log => parseLog(log, this._contracts.find(c => c.address === log.address).abi));
  }

  async _format(logs) {
    const blockHashes = logs.map(log => log.blockHash).filter((e, i, a) => a.indexOf(e) === i);
    const blocks = await this._getBlocks(blockHashes);

    return logs.map(log => {
      const transactionHash = log.transactionHash;
      const transaction = blocks[log.blockHash].transactions.find(e => e.hash === transactionHash);
      const contract = this._contracts.find(c => c.address === log.address);

      return {
        event: log.event,
        contract: contract.name,
        timestamp: blocks[log.blockHash].timestamp,
        blockHash: log.blockHash,
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash,
        transactionIndex: log.transactionIndex,
        from: transaction.from,
        to: log.address,
        logIndex: log.logIndex,
        values: log.returnValues
      };
    });
  }

  async _getBlocks(blockHashes) {
    const results = [];
    const uncachedBlockHashes = [];

    for (let i = 0; i < blockHashes.length; i++) {
      const cachedBlock = this._blockCache.get(blockHashes[i]);

      if (cachedBlock) {
        results[blockHashes[i]] = cachedBlock;
      } else {
        uncachedBlockHashes.push(blockHashes[i]);
      }
    }

    const blocks = await asyncPool(this._concurrency, uncachedBlockHashes, this._web3.eth.getBlock);

    if (blocks.indexOf(null) !== -1) {
      throw new BlockNotFoundError();
    }

    for (const block of blocks) {
      this._blockCache.set(block.hash, block);

      results[block.hash] = block;
    }

    return results;
  }
}

module.exports = EventFetcher;
