import BlockPolling = require('./block-polling');
import { BlockNumber } from 'web3-core';

declare class EventListener {
  constructor(polling: BlockPolling);

  /** private
  _polling: any;
  _emitter: EventEmitter;
  _running: boolean;
  _queues: {};
  _processing: {};
  _next(status: any): void;
  */

  start(startBlock?: BlockNumber): void;
  stop(): void;
  isRunning(): boolean;
  on(
    event: EventType,
    callback: (
      blockNumber: BlockNumber,
      events: EthereumEvent[],
      done: (err?: any) => void,
    ) => void,
  ): void;
}

export = EventListener;
