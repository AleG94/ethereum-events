declare type EventType = 'error' | 'block' | 'block.confirmed' | 'block.unconfirmed';

declare interface EthereumEvent {
  name: string;
  contract: string;
  timestamp: Date;
  blockHash: string;
  blockNumber: number;
  transactionHash: string;
  transactionIndex: number;
  from: string;
  to: string;
  logIndex: number;
  values: any;
}
