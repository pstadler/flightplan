var extend = require('util-extend')
  , Fiber = require('fibers')
  , Future = require('fibers/future')
  , Shell = require('../transport/shell')
  , logger = require('../logger')()
  , prettyTime = require('pretty-hrtime');

exports.run = function(fn, context) {
  var _context = extend({}, context);
  _context.remote = { host: 'localhost' };

  var t = process.hrtime();
  logger.info('Flight to ' + _context.remote.host + ' started');

  var future = new Future();

  var task = function() {

    var transport = new Shell(_context);
    new Fiber(function() {
      fn(transport);
      return future.return();
    }).run();
    return future;
  };

  Future.wait(task());

  logger.info('Flight to ' + _context.remote.host
            + ' finished after ' + prettyTime(process.hrtime(t)));
};