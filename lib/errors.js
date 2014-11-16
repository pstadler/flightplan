var util = require('util');

function BaseError(message) {
  BaseError.super_.call(this, message);
  Error.captureStackTrace(this, this.constructor);
  this.message = message;
  this.name = this.constructor.name;
}
util.inherits(BaseError, Error);

function InvalidTargetError(message) {
  InvalidTargetError.super_.call(this, message);
  Error.captureStackTrace(this, this.constructor);
  this.name = this.constructor.name;
}
util.inherits(InvalidTargetError, BaseError);

function CommandExitedAbormallyError(message) {
  CommandExitedAbormallyError.super_.call(this, message);
  Error.captureStackTrace(this, this.constructor);
  this.name = this.constructor.name;
}
util.inherits(CommandExitedAbormallyError, BaseError);

function ConnectionFailedError(message) {
  ConnectionFailedError.super_.call(this, message);
  Error.captureStackTrace(this, this.constructor);
  this.name = this.constructor.name;
}
util.inherits(ConnectionFailedError, BaseError);

function InvalidArgumentError(message) {
  InvalidArgumentError.super_.call(this, message);
  Error.captureStackTrace(this, this.constructor);
  this.name = this.constructor.name;
}
util.inherits(InvalidArgumentError, BaseError);

function AbortedError(message) {
  AbortedError.super_.call(this, message);
  Error.captureStackTrace(this, this.constructor);
  this.name = this.constructor.name;
}
util.inherits(AbortedError, BaseError);

function ProcessInterruptedError(message) {
  ProcessInterruptedError.super_.call(this, message);
  Error.captureStackTrace(this, this.constructor);
  this.name = this.constructor.name;
}
util.inherits(ProcessInterruptedError, BaseError);

module.exports = {
  BaseError: BaseError,
  InvalidTargetError: InvalidTargetError,
  CommandExitedAbormallyError: CommandExitedAbormallyError,
  ConnectionFailedError: ConnectionFailedError,
  InvalidArgumentError: InvalidArgumentError,
  AbortedError: AbortedError,
  ProcessInterruptedError: ProcessInterruptedError
};