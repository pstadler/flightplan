var Fiber = require('fibers')
	, Future = require('fibers/future');

function Flight(flightplan, transportClass, fn) {
	this.flightplan = flightplan;
	this.fn = fn;
	this.transportClass = transportClass;
	this.logger = flightplan.logger;
	this.status = {
		aborted: false,
		crashRecordings: null,
		executionTime: 0 // milliseconds
	};
}

Flight.prototype = {

	liftoff: function(config) {
		var future = new Future();

		var task = function() {
			Fiber(function() {
				var t = process.hrtime();

				var transport = new this.transportClass(this, config);
				this.fn(transport);
				transport.close();

				t = process.hrtime(t);
				this.status.executionTime = Math.round(t[0]*1e3 + t[1]/1e6);

				if(this.isAborted()) {
					this.flightplan.abort();
				}

				return future.return();
			}.bind(this)).run();

			return future;
		}.bind(this);

		Future.wait(task());

		return this.status;
	},

	abort: function(msg) {
		this.flightplan.abort();
		this.status.aborted = true;
		this.status.crashRecordings = msg || null;
	},

	isAborted: function() {
		return this.status.aborted;
	},

	getStatus: function() {
		return this.status;
	}

};

module.exports = Flight;