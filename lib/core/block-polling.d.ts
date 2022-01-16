import EthereumEventsConfig = require('../../config');
import EthereumEvent from '../models/ethereum-event';
import Web3 from 'web3';
import { BlockNumber } from 'web3-core';

declare class BlockPolling {
  constructor(web3: Web3, eventFetcher: any, options?: EthereumEventsConfig);

  /** private
    _web3: any;
    _eventFetcher: any;
    _emitter: EventEmitter;
    _running: boolean;
    _chunkSize: any;
    _pollInterval: any;
    _confirmations: any;
    _backoff: any;
    _eventCache: any;
    _poll(fromBlock: any): Promise<void>;
    _latestQueriedBlock: any;
    _notify(blockNumber: any, status: any, events: any): void;
    _getBlockStatus(blockNumber: any, latestBlock: any): string;
  */

  start(startBlock: BlockNumber): void;
  stop(): void;
  isRunning(): boolean;
  on(
    event: EventType,
    callback: (
      blockNumber: BlockNumber,
      events: EthereumEvent,
      done: (err?: any) => void,
    ) => void,
  ): void;
}

export = BlockPolling;
