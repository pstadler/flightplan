var Fiber = require('fibers')
  , Future = require('fibers/future')
  , extend = require('util-extend')
  , SSH = require('../transport/ssh')
  , logger = require('../logger')()
  , prettyTime = require('pretty-hrtime');

exports.run = function(fn, context) {
  var task = function(context) {
    var future = new Future();

    new Fiber(function() {
      var t = process.hrtime();
      logger.info('Flight to ' + context.remote.host + ' started');

      var transport = new SSH(context);
      fn(transport);
      transport.close();

      logger.info('Flight to ' + context.remote.host +
                  ' finished after ' + prettyTime(process.hrtime(t)));

      return future.return();
    }).run();

    return future;
  };

  var tasks = [];
  context.hosts.forEach(function(host) {
    var _context = extend({}, context);
    _context.remote = host;
    tasks.push(task(_context));
  });

  Future.wait(tasks);
};