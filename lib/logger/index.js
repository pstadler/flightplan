var chalk = require('chalk');

function Logger(options) {
  options = options || {};
  var debug  = options.debug  || false;
  var prefix = options.prefix || '';

  var printPrefix = !prefix
    ? function() {}
    : function() { process.stdout.write(chalk.gray(prefix) + ' '); };

  this._log = function(message) {
    printPrefix();
    process.stdout.write(message.trim() + '\n');
  };

  if(debug) {
    var self = this;
    this.debug = function(message) {
      self._log(chalk.cyan(message));
    };
  }
}

Logger.prototype.user = function(message) {
  this._log(chalk.cyan(message));
};

Logger.prototype.info = function(message) {
  this._log(chalk.magenta('✈ ' + message));
};

Logger.prototype.success = function(message) {
  this._log(chalk.green('● ' + message));
};

Logger.prototype.warn = function(message) {
  this._log(chalk.yellow('● ' + message));
};

Logger.prototype.error = function(message) {
  this._log(chalk.red('● ' + message));
};

Logger.prototype.command = function(message) {
  this._log(chalk.blue('$ ' + message));
};

Logger.prototype.stdout = function(message) {
  this._log(chalk.gray('> ') + message);
};

Logger.prototype.stdwarn = function(message) {
  this._log(chalk.yellow('> ') + message);
};

Logger.prototype.stderr = function(message) {
  this._log(chalk.red('> ') + message);
};

Logger.prototype.debug = function() {};

module.exports = function(options) {
  return new Logger(options);
};
