var extend = require('util-extend'),
  Shell = require('../transport/shell'),
  logger = require('../logger')(),
  prettyTime = require('pretty-hrtime');

exports.run = async function (fn, context) {
  var _context = extend({}, context);
  _context.remote = { host: 'localhost' };

  var task = function () {
    var transport = new Shell(_context);
    return fn(transport);
  };

  var t = process.hrtime();

  logger.info('Executing local task');

  await task();

  logger.info('Local task finished after ' + prettyTime(process.hrtime(t)));
};
