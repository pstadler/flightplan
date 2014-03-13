var util = require('util')
  , Flight = require('./flight')
  , ShellTransport = require('./transport/shell');

function LocalFlight(flightplan, fn) {
  LocalFlight.super_.call(this, flightplan, ShellTransport, fn);
}

util.inherits(LocalFlight, Flight);

module.exports = LocalFlight;