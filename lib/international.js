var util = require('util')
	, Fiber = require('fibers')
	, Future = require('fibers/future')
	, Flight = require('./flight')
	, SSHTransport = require('./transport/ssh');

function InternationalFlight(flightplan, fn) {
	InternationalFlight.super_.call(this, flightplan, SSHTransport, fn);

	if(!this.flightplan.briefing()) {
		this.logger.error("You can\'t do international flights without a briefing.");
		this.flightplan.abort();
	}
}

util.inherits(InternationalFlight, Flight);

InternationalFlight.prototype.liftoff = function(hosts) {
	var task = function(config) {
		var future = new Future();
		var flight = new InternationalFlight(this.flightplan, this.fn);
		Fiber(function() {
			var t = process.hrtime();

			var transport = new flight.transportClass(flight, config);
			flight.fn(transport);
			transport.close();

			if(flight.isAborted()) {
				this.flightplan.abort();
			}

			t = process.hrtime(t);
			flight.status.executionTime = Math.round(t[0]*1e3 + t[1]/1e6);
			if(flight.status.executionTime > this.status.executionTime) {
				this.status.executionTime = flight.status.executionTime;
			}
			return future.return();
		}.bind(this)).run();

		return future;
	}.bind(this);

	var tasks = [];
	for(var i=0, len=hosts.length; i < len; i++) {
		tasks.push(task(hosts[i]));
	}
	Future.wait(tasks);

	return this.status;
};



module.exports = InternationalFlight;