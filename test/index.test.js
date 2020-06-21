'use strict';
const chai = require('chai');
const EthereumEvents = require('../lib/core/ethereum-events');
const index = require('..');

chai.should();

describe('External API', function () {
  it('should create an instance of EthereumEvents', function () {
    const web3 = {}, contracts = [], options = {};

    index(web3, contracts, options).should.be.an.instanceOf(EthereumEvents);
  });
});
