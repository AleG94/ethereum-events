'use strict';

class CustomError extends Error {
  constructor(message) {
    super(message);
    this.name = this.constructor.name;

    Error.captureStackTrace(this, this.constructor);
  }
}

class BlockNotFoundError extends CustomError {
  constructor() {
    super('Block not found');
  }
}

module.exports = { BlockNotFoundError };
