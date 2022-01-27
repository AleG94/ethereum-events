import EventListener = require('ethereum-events/lib/core/event-listener');
import EthereumEventsConfig = require('./config');

declare class EthereumEvents extends EventListener {
  constructor(web3: any, contracts: any, options?: EthereumEventsConfig);
}

export = EthereumEvents;
