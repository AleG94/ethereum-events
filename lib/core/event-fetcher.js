'use strict';
const pLimit = require('p-limit');
const parseLog = require('eth-log-parser');
const { safeMemoryCache } = require('safe-memory-cache');
const config = require('../../config');
const { BlockNotFoundError } = require('../errors');

class EventFetcher {
  constructor(web3, contracts, options = {}) {
    this._web3 = web3;
    this._contracts = contracts;
    this._addresses = contracts.map(e => e.address);
    this._concurrency = options.concurrency || config.concurrency;
    this._blockCache = safeMemoryCache({ limit: 100 });
  }

  async getEvents(fromBlock, toBlock) {
    const logs = await this._web3.eth.getPastLogs({
      address: this._addresses,
      fromBlock: fromBlock,
      toBlock: toBlock
    });

    const parsedLogs = this._parse(logs);
    const filteredLogs = this._filter(parsedLogs);
    const events = await this._format(filteredLogs);

    return events;
  }

  _parse(logs) {
    return logs.map(
      log => parseLog(log, this._contracts.find(c => c.address.toLowerCase() === log.address.toLowerCase()).abi)
    );
  }

  _filter(logs) {
    return logs.filter(log => {
      const contract = this._contracts.find(c => c.address.toLowerCase() === log.address.toLowerCase());

      return contract.events ? contract.events.includes(log.event) : true;
    });
  }

  async _format(logs) {
    const blockHashes = logs.map(log => log.blockHash).filter((e, i, a) => a.indexOf(e) === i);
    const blocks = await this._getBlocks(blockHashes);

    return logs.map(log => {
      const transactionHash = log.transactionHash;
      const transaction = blocks[log.blockHash].transactions.find(e => e.hash === transactionHash);
      const contract = this._contracts.find(c => c.address.toLowerCase() === log.address.toLowerCase());

      return {
        name: log.event,
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

    const limit = pLimit(this._concurrency);
    const blocks = await Promise.all(uncachedBlockHashes.map(e => limit(this._web3.eth.getBlock, e, true)));

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
