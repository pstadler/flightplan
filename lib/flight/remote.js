var Fiber = require('fibers')
  , Future = require('fibers/future')
  , extend = require('util-extend')
  , SSH = require('../transport/ssh')
  , logger = require('../logger')()
  , prettyTime = require('pretty-hrtime');

var _connections = [];

exports.run = function(fn, context) {
  var connect = function(context) {
    var future = new Future();
    new Fiber(function() {
      logger.info('Connecting to "' + context.remote.host + '"');
      _connections.push(new SSH(context));
      return future.return();
    }).run();
    return future;
  };

  var execute = function(transport) {
    var future = new Future();
    new Fiber(function() {
      var t = process.hrtime();
      logger.info('Executing remote task on ' + transport.runtime.host);
      fn(transport);
      logger.info('Remote task on ' + transport.runtime.host +
                  ' finished after ' + prettyTime(process.hrtime(t)));
      return future.return();
    }).run();
    return future;
  };

  if(_connections.length === 0) {
    Future.wait(context.hosts.map(function(host) {
      var _context = extend({}, context);
      _context.remote = host;
      return connect(_context);
    }));
  }

  Future.wait(_connections.map(function(connection) {
    return execute(connection);
  }));
};

exports.disconnect = function() {
  _connections.forEach(function(connection) {
    connection.close();
  });
  _connections = [];
};