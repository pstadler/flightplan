var Fiber = require('fibers')
	, Logger = require('./logger')
	, Briefing = require('./briefing')
	, DomesticFlight = require('./domestic')
	, InternationalFlight = require('./international');

function Flightplan() {
	this._briefing = null;
	this.flights = [];
	this.status = {
		aborted: false,
		executionTime: 0
	};
	this.logger = new Logger();

	this.successCallback = function() {};
	this.disasterCallback = function() {};
	this.debriefingCallback	= function() {};

	process.on('SIGINT', function() {
		this.logger.space();
		this.logger.error('Flightplan was interrupted'.error);
		process.exit(1);
	}.bind(this));

	process.on('uncaughtException', function(err) {
		this.logger.error(err);
		this.logger.error('Flightplan aborted'.error);
		process.exit(1);
	}.bind(this));

	module.parent.parent.exports = this; // expose to user's flightplan.js

}

Flightplan.prototype = {

	abort: function(msg) {
		this.status.aborted = true;
	},

	isAborted: function() {
		return this.status.aborted;
	},

	briefing: function(config) {
		if(!config) {
			return this._briefing;
		}
		this._briefing = new Briefing(this, config);
		return this;
	},

	domestic: function(fn) {
		this.flights.push(new DomesticFlight(this, fn));
		return this;
	},

	international: function(fn) {
		this.flights.push(new InternationalFlight(this, fn));
		return this;
	},

	success: function(fn) {
		this.successCallback = fn;
		return this;
	},

	disaster: function(fn) {
		this.disasterCallback = fn;
		return this;
	},

	debriefing: function(fn) {
		this.debriefingCallback = fn;
		return this;
	},

	start: function(destination, options) {
		if(this.briefing()) {
			this.briefing().applyOptions(options);
		} else {
			this.briefing(options);
		}
		this.logger.debug('Briefing done');
		if(!this.briefing().hasDestination(destination)) {
			this.logger.error(destination.warn, 'is not a valid destination');
			process.exit(1);
		}

		if(this.isAborted()) {
			this.logger.error('Flightplan aborted'.error);
			process.exit(1);
		}
		this.logger.info('Executing flightplan with'.info, String(this.flights.length).magenta
							, 'planned flight(s) to'.info, destination.warn);
		this.logger.space();

		Fiber(function() {

			var t = process.hrtime();

			for(var i=0, len=this.flights.length; i < len; i++) {
				var flight = this.flights[i];

				this.logger.info('Flight'.info, this.logger.format('%s/%s', i+1, len).magenta, 'launched...'.info);
				this.logger.space();

				flight.liftoff(this.briefing().getHostsForDestination(destination));

				var status = flight.getStatus();
				if(flight.isAborted()) {
					this.logger.error('Flight'.error, this.logger.format('%s/%s', i+1, len).magenta
										, 'aborted after'.error
										, this.logger.format('%s%s', status.executionTime, 'ms').magenta
										, this.logger.format('when %s', status.crashRecordings));
					this.logger.space();
					break;
				}
				this.logger.success('Flight'.success, this.logger.format('%s/%s', i+1, len).magenta
								, 'landed after'.success
								, this.logger.format('%s%s', status.executionTime, 'ms').magenta);
				this.logger.space();
			}

			t = process.hrtime(t);
			this.status.executionTime = Math.round(t[0]*1e3 + t[1]/1e6);

			if(this.isAborted()) {
				this.logger.error('Flightplan aborted after'.error
									, this.logger.format('%s%s', this.status.executionTime, 'ms').magenta);
				this.disasterCallback();
				this.debriefingCallback();
				process.exit(1);
			} else {
				this.logger.success('Flightplan finished after'.success
									, this.logger.format('%s%s', this.status.executionTime, 'ms').magenta);
				this.successCallback();
				this.debriefingCallback();
				process.exit(0);
			}

		}.bind(this)).run();
	}

};

module.exports = Flightplan;