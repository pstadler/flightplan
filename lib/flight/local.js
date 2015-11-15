var extend = require('util-extend')
  , Fiber = require('fibers')
  , Future = require('fibers/future')
  , Shell = require('../transport/shell')
  , logger = require('../logger')()
  , prettyTime = require('pretty-hrtime');

exports.run = function(fn, context) {
  var _context = extend({}, context);
  _context.remote = { host: 'localhost' };

  var future = new Future();

  var task = function() {
    var transport = new Shell(_context);

    new Fiber(function() {
      fn(transport);
      return future.return();
    }).run();

    return future;
  };

  var t = process.hrtime();

  logger.info('Executing local task');

  Future.wait(task());

  logger.info('Local task finished after ' + prettyTime(process.hrtime(t)));
};