# Ethereum Events

[![CircleCI][circleci-image]][circleci-url]
[![NPM Version][npm-image]][npm-url]
[![Coverage Status][coveralls-image]][coveralls-url]
[![License][license-image]][license-url]

Efficient and reliable event listener for Ethereum.

Receive real-time events from your contracts with minimal effort.


## Motivation

Ethereum and blockchains in general can be quite challenging for new developers to approach.
Most of the difficulty resides in understanding the many dynamics that can occur (e.g. finality, reorgs)
and how to deal with them in order to provide quality UX.

A lot of Ethereum based dApps heavily depend on events fired by their smart contracts.
This package is meant to simplify the process of listening for those events in real-time in a reliable 
and efficient way, keeping away blockchain complexity as much as possible.


## Requirements

* Web3 (1.2.0 or higher)


## Installation

```
npm install ethereum-events
```


## Usage

```js
const Web3 = require('web3');
const EthereumEvents = require('ethereum-events');

const ERC20_ABI = /* ABI for ERC20 token contract */;
const WEB3_PROVIDER = /* Your web3 provider (e.g. geth, Infura) */;

const contracts = [
  {
    name: 'Token',
    address: '0xefE1e4e13F9ED8399eE8e258b3a1717b7D15f054',
    abi: ERC20_ABI,
    events: ['Transfer'] // optional events filter (default: all events)
  } 
];

const options = {
  pollInterval: 13000, // period between poll for new events in milliseconds (default: 13000)
  confirmations: 12,   // n° of confirmation blocks (default: 12)
  chunkSize: 10000,    // n° of blocks to fetch at a time (default: 10000)
  concurrency: 10,     // maximum n° of concurrent web3 requests (default: 10)
  backoff: 1000        // retry backoff in milliseconds (default: 1000)
};

const web3 = new Web3(WEB3_PROVIDER);

const ethereumEvents = new EthereumEvents(web3, contracts, options);


ethereumEvents.on('block.confimed', (blockNumber, events, done) => {

  // Events contained in blocks with 'confirmed' status are considered final,
  // hence the callback will be fired only once for each blockNumber.
  // Blocks are received in order and one at a time so you don't skip any
  // and know for sure that you processed every block up to the latest received.
  
  // Remeber to call the 'done()' function after processing the events
  // in order to receive the next block. If an error occurs, pass it to the done
  // function as argument like so 'done(err)' to retry and not skip the block.

});

ethereumEvents.on('block.unconfimed', (blockNumber, events, done) => {
  
  // Events contained in blocks with 'unconfirmed' status are NOT considered final
  // and may be subject to change, hence the callback may be fired multiple times
  // for the same blockNumber if the events change.
  // Blocks are received in order and one at a time.
  
  // Remeber to call the 'done()' function after processing the events
  // in order to receive the next block. If an error occurs, pass it to the done
  // function as argument like so 'done(err)' to retry and not skip the block.
  
});

ethereumEvents.on('error', err => {

  // An error occured while fetching new events.
  // Retry will be attempted after backoff interval.

});

// Start listening for events
ethereumEvents.start();


// Stop listening for events
ethereumEvents.stop();
```


## Event Format

```json
{
  "name": "Transfer",
  "contract": "Token",
  "timestamp": 1591110290,
  "blockHash": "0xde42b82c4e28122218d79f8491b05587608a8c9bb87c0d0df9be9fb9ae6f7e13",
  "blockNumber": 6596988,
  "transactionHash": "0x686943cee4035375b25209a2972535c93eefb688fad42d72e518c452387c69c9",
  "transactionIndex": 10,
  "from": "0x5B848132d3a0111d4daB7060b6051961013C71c7",
  "to": "0xefE1e4e13F9ED8399eE8e258b3a1717b7D15f054",
  "logIndex": 11,
  "values": {
    "from": "0x343c6A169D973bBF33A8F1535754A4745a3BD9C1",
    "to": "0x78a3339aD6A565B4136077C8878970D7f1B66021",
    "value": "100000000000000000000"
  }
}
```


## Notes

The `chunkSize` option lets you customize how many blocks to query for events at a time. This is useful when the start block is far behind the current latest block and many blocks have to be fetched in order to get up to date.\
Having a higher *chunkSize* is more performant but it may cause a failure in the calls to your provider if too many events are retreived in the same request so the optimal value heavily depends on how many events your contracts emit.

The `concurrency` option lets you customize how many concurrent requests can be sent to your web3 provider so that 
you can avoid being rate limited.


[circleci-image]: https://circleci.com/gh/AleG94/ethereum-events.svg?style=svg
[circleci-url]: https://circleci.com/gh/AleG94/ethereum-events
[coveralls-image]: https://coveralls.io/repos/github/AleG94/ethereum-events/badge.svg?branch=master
[coveralls-url]: https://coveralls.io/github/AleG94/ethereum-events?branch=master
[npm-image]: https://img.shields.io/npm/v/ethereum-events.svg
[npm-url]: https://npmjs.org/package/ethereum-events
[license-image]: https://img.shields.io/npm/l/ethereum-events.svg
[license-url]: https://github.com/AleG94/ethereum-events/blob/master/LICENSE