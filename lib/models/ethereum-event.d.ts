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
export = EthereumEvent
