var util = require('util')
	, Fiber = require('fibers')
	, Future = require('fibers/future')
	, Flight = require('./flight')
	, SSHTransport = require('./transport/ssh');

function RemoteFlight(flightplan, fn) {
	RemoteFlight.super_.call(this, flightplan, SSHTransport, fn);

	if(!this.flightplan.briefing()) {
		this.logger.error("You can\'t do remote flights without a briefing.");
		this.flightplan.abort();
	}
}

util.inherits(RemoteFlight, Flight);

RemoteFlight.prototype.liftoff = function(hosts) {
	var task = function(config) {
		var future = new Future();
		var flight = new RemoteFlight(this.flightplan, this.fn);
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



module.exports = RemoteFlight;