var util = require('util')
	, Flight = require('./flight')
	, ShellTransport = require('./transport/shell');

function DomesticFlight(flightplan, fn) {
	DomesticFlight.super_.call(this, flightplan, ShellTransport, fn);
}

util.inherits(DomesticFlight, Flight);

module.exports = DomesticFlight;