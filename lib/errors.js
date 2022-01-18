class BaseError extends Error {
  constructor(message) {
    super(message);
    this.name = this.constructor.name;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

class InvalidTargetError extends BaseError {}

class CommandExitedAbnormallyError extends BaseError {}

class ConnectionFailedError extends BaseError {}

class InvalidArgumentError extends BaseError {}

class AbortedError extends BaseError {}

class ProcessInterruptedError extends BaseError {}

module.exports = {
  BaseError,
  InvalidTargetError,
  CommandExitedAbnormallyError,
  ConnectionFailedError,
  InvalidArgumentError,
  AbortedError,
  ProcessInterruptedError,
};
