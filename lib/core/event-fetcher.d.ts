import { EthereumEventsConfig } from '../../config';
import Web3 from 'web3';

export class EventFetcher {
  constructor(web3: Web3, contracts: any, options?: EthereumEventsConfig);
  /** private
    _web3: any;
    _contracts: any;
    _addresses: any;
    _concurrency: any;
    _blockCache: any;
    _parse(logs: any): any;
    _filter(logs: any): any;
    _format(logs: any): Promise<any>;
    _getBlocks(blockHashes: any): Promise<any[]>;
  */

  getEvents(fromBlock: any, toBlock: any): Promise<EthereumEvent[]>;
}
