'use strict';
const EventFetcher = require('./lib/core/event-fetcher');
const BlockPolling = require('./lib/core/block-polling');
const EventListener = require('./lib/core/event-listener');

module.exports = (web3, contracts, options) => {
  const eventFetcher = new EventFetcher(web3, contracts, options);
  const polling = new BlockPolling(web3, eventFetcher, options);

  return new EventListener(polling);
};
