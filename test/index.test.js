'use strict';
const chai = require('chai');
const EthereumEvents = require('../lib/core/ethereum-events');
const index = require('..');

chai.should();

describe('External API', function () {
  it('should expose EthereumEvents constructor', function () {
    index.should.be.equal(EthereumEvents);
  });
});
