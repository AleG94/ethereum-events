'use strict';
const chai = require('chai');
const EventListener = require('../lib/core/event-listener');
const EthereumEvents = require('..');

chai.should();

describe('External API', function () {
  it('should create an instance of EthereumEvents', function () {
    const web3 = {}, contracts = [], options = {};
    const ethereumEvents = new EthereumEvents(web3, contracts, options);

    ethereumEvents.should.be.an.instanceOf(EventListener);
  });
});
