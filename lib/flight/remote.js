var SSH = require('../transport/ssh'),
  logger = require('../logger')(),
  prettyTime = require('pretty-hrtime'),
  errors = require('../errors');

var _connections = [];

async function connect(_context) {
  logger.info("Connecting to '" + _context.remote.host + "'");

  try {
    var connection = await SSH.create(_context);
    _connections.push(connection);
  } catch (e) {
    if (!_context.remote.failsafe) {
      throw new errors.ConnectionFailedError(
        "Error connecting to '" + _context.remote.host + "': " + e.message
      );
    }

    logger.warn("Safely failed connecting to '" + _context.remote.host + "': " + e.message);
  }
}

async function execute(transport, fn) {
  var t = process.hrtime();

  logger.info('Executing remote task on ' + transport.runtime.host);

  await fn(transport);

  logger.info(
    'Remote task on ' + transport.runtime.host + ' finished after ' + prettyTime(process.hrtime(t))
  );
}

exports.run = async function (fn, context) {
  if (_connections.length === 0) {
    for (const host of context.hosts) {
      await connect({
        ...context,
        remote: host,
      });
    }
  }

  for (const connection of _connections) {
    await execute(connection, fn);
  }
};

exports.disconnect = function () {
  _connections.forEach(function (connection) {
    connection.close();
  });

  _connections = [];
};
