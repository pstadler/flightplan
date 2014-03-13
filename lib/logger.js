var util = require('util')
  , colors = require('colors');

var messageTypes = {
  log: 'yellow',
  info: 'blue',
  success: 'green',
  warn: 'yellow',
  error: 'red',
  command: 'white',
  debug: 'cyan'
};

colors.setTheme(messageTypes);

var __debug = false; // persistent

function Logger(debug) {
  __debug = (debug !== null && debug !== undefined) ? debug : __debug;
  this.symbol = '✈';
  this.prefix = '';

  this._logStream = function() {
    var writePrefix = true;
    return function(symbol, prefix, msg) {
      var lines = msg.split('\n');
      var out = [];
      for(var i=0, len=lines.length; i < len; i++) {
        if(writePrefix && lines[i] !== '') {
          out.push(this._format(symbol, prefix, lines[i]));
          if(i+1 === lines.length) {
            writePrefix = false; // stream will continue
          }
        } else {
          if(i+1 !== lines.length || lines[i] === '') {
            writePrefix = true;
          }
          out.push(lines[i]);
        }
      }
      process.stdout.write(out.join('\n'));
    }.bind(this);
  };

  this.stdout = (function() {
    var logStream = this._logStream();
    return function() {
      var data = this._parseArgs(arguments, false);
      logStream('>'.grey, this.prefix, data);
    }.bind(this);
  }.bind(this))();

  this.stderr = (function() {
    var logStream = this._logStream();
    return function() {
      var data = this._parseArgs(arguments, false);
      logStream('>'.error, this.prefix, data);
    }.bind(this);
  }.bind(this))();

  this.stdwarn = (function() {
    var logStream = this._logStream();
    return function() {
      var data = this._parseArgs(arguments, false);
      logStream('>'.warn, this.prefix, data);
    }.bind(this);
  }.bind(this))();
}

Object.keys(messageTypes).forEach(function(type) {
  Logger.prototype[type] = function() {
    var msg = this._parseArgs(arguments);
    this._log(this.symbol[type], this.prefix, msg);
  };
});

Logger.prototype = util._extend(Logger.prototype, {

  enableDebug: function(flag) {
    __debug = !!flag;
  },

  debugEnabled: function() {
    return __debug;
  },

  clone: function() {
    return new Logger();
  },

  cloneWithPrefix: function(prefix) {
    var logger = this.clone();
    logger.symbol = '●';
    logger.prefix = prefix;
    logger._format = function(symbol, prefix, msg) {
      return util.format('%s %s %s', (prefix || '').grey, symbol, msg);
    };
    return logger;
  },

  command: function() {
    var msg = this._parseArgs(arguments);
    this._log('$'.command, this.prefix, msg.command);
  },

  debug: function() {
    if(__debug) {
      var msg = this._parseArgs(arguments);
      this._log(this.symbol.debug, this.prefix, msg);
    }
  },

  space: function() {
    process.stdout.write('\n');
  },

  log: function() {
    var msg = this._parseArgs(arguments);
    this._log(this.symbol.cyan, this.prefix, msg.cyan);
  },

  _log: function(symbol, prefix, msg) {
    var lines = msg.split('\n');
    var out = [];
    for(var i=0, len=lines.length; i < len; i++) {
      var line = lines[i].trim();
      out.push(this._format(symbol, prefix, line));
    }
    process.stdout.write(out.join('\n') + '\n');
  },

  format: util.format, // convenience method

  _format: function(symbol, prefix, msg) {
    return util.format('%s%s %s', symbol, prefix, msg);
  },

  _parseArgs: function(args, trim) {
    var str = Array.prototype.slice.call(args, 0).join(' ');
    if(trim !== false) {
      str = str.trim();
    }
    return str;
  }

});

module.exports = Logger;