var Fiber = require('fibers')
	, Logger = require('./logger')
	, Briefing = require('./briefing')
	, LocalFlight = require('./local')
	, RemoteFlight = require('./remote');

/**
 * A flightplan is a set of subsequent flights to be executed on one or more
 * hosts. The constructor doesn't take any arguments. The configuration is
 * handled with the `briefing()` method.
 *
 * ```javascript
 * var plan = new Flightplan();
 * ```
 *
 * ### Flights
 * A flight is a set of commands to be executed on one or more hosts. There are
 * two types of flights:
 *
 * #### Local flights
 *
 * Commands in local flights are executed on the **local host**.
 *
 * ```javascript
 * plan.local(function(transport) {
 *   transport.hostname(); // prints the hostname of the local host
 * });
 * ```
 *
 * #### Remote flights
 *
 * Commands in remote flights are executed in **parallel** against
 * remote hosts defined during the briefing.
 *
 * ```javascript
 * plan.remote(function(transport) {
 *   transport.hostname(); // prints the hostname(s) of the remote host(s)
 * });
 * ```
 *
 * You can define multiple flights of each type. They will be executed in the
 * order of their definition. If a previous flight failed, all subsequent
 * flights won't get executed. For more information about what it means for
 * a flight to fail, see the section about `Transport`.
 *
 * ```javascript
 * // executed first
 * plan.local(function(transport) {});
 *
 * // executed if first flight succeeded
 * plan.remote(function(transport) {});
 *
 * // executed if second flight succeeded
 * plan.local(function(transport) {});
 *
 * // ...
 * ```
 *
 * @class Flightplan
 * @return flightplan
 */
function Flightplan() {
	this._briefing = null;
	this.flights = [];
	this.status = {
		aborted: false,
		executionTime: 0
	};
	this.hasRemoteFlights = false;
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
		this.logger.error(err.stack);
		this.disasterCallback();
		this.debriefingCallback();
		this.logger.error('Flightplan aborted'.error);
		process.exit(1);
	}.bind(this));

	module.parent.parent.exports = this; // expose to user's flightplan.js

}

Flightplan.prototype = {

	/**
	 * Configure the flightplan's destinations with `briefing()`. Without a
	 * proper briefing you can't do remote flights which require at
	 * least one destination. Each destination consists of one ore more hosts.
	 *
	 * Values in the hosts section are passed directly to the `connect()`
	 * method of [mscdex/ssh2](https://github.com/mscdex/ssh2#connection-methods).
	 *
	 * ```javascript
	 * plan.briefing({
	 *   destinations: {
	 *     // run with `fly staging`
	 *     'staging': {
	 *       // see: https://github.com/mscdex/ssh2#connection-methods
	 *       host: 'staging.pstadler.sh',
	 *       username: 'pstadler',
	 *       agent: process.env.SSH_AUTH_SOCK
	 *     },
	 *     // run with `fly production`
	 *     'production': [
	 *       {
	 *         host: 'www1.pstadler.sh',
	 *         username: 'pstadler',
	 *         agent: process.env.SSH_AUTH_SOCK
	 *       },
	 *       {
	 *         host: 'www2.pstadler.sh',
	 *         username: 'pstadler',
	 *         agent: process.env.SSH_AUTH_SOCK
	 *       },
	 *     ]
	 *   }
	 * });
	 * ```
	 *
	 * You can override the `username` value of all hosts by calling `fly` with
	 * the `-u|--username` option:
	 *
	 * ```bash
	 * fly production --username=admin
	 * ```
	 *
	 * @method briefing(config)
	 * @return this
	 */
	briefing: function(config) {
		if(!config) {
			return this._briefing;
		}
		this._briefing = new Briefing(this, config);
		return this;
	},

	/**
	 * Calling this method registers a local flight. Local flights are
	 * executed on your local host. When `fn` gets called a `Transport` object
	 * is passed with the first argument.
	 *
	 * ```javascript
	 * plan.local(function(local) {
	 *   local.echo('hello from your localhost.');
	 * });
	 * ```
	 *
	 * @method local(fn)
	 * @return this
	 */
	local: function(fn) {
		this.flights.push(new LocalFlight(this, fn));
		return this;
	},

	/**
	 * Calling this method registers a remote flight. Remote
	 * flights are executed on the current destination's remote hosts defined
	 * with `briefing()`. When `fn` gets called a `Transport` object is passed
	 * with the first argument.
	 *
	 * ```javascript
	 * plan.remote(function(remote) {
	 *   remote.echo('hello from the remote host.');
	 * });
	 * ```
	 *
	 * @method remote(fn)
	 * @return this
	 */
	remote: function(fn) {
		this.flights.push(new RemoteFlight(this, fn));
		this.hasRemoteFlights = true;
		return this;
	},

	/**
	 * `fn()` is called after the flightplan (and therefore all flights)
	 * succeeded.
	 *
	 * @method success(fn)
	 * @return this
	 */
	success: function(fn) {
		this.successCallback = fn;
		return this;
	},

	/**
	 * `fn()` is called after the flightplan was aborted.
	 *
	 * @method disaster(fn)
	 * @return this
	 */
	disaster: function(fn) {
		this.disasterCallback = fn;
		return this;
	},

	/**
	 * `fn()` is called at the very end of the flightplan's execution.
	 *
	 * @method debriefing(fn)
	 */
	debriefing: function(fn) {
		this.debriefingCallback = fn;
		return this;
	},


	/**
	 * Whether the flightplan is aborted or not.
	 *
	 * @method isAborted()
	 * @return Boolean
	 */
	isAborted: function() {
		return this.status.aborted;
	},

	/**
	 * Calling this method will abort the flightplan and prevent any further
	 * flights from being executed.
	 *
	 * ```javascript
	 * plan.abort();
	 * ```
	 *
	 * @method abort()
	 */
	abort: function() {
		this.status.aborted = true;
	},

	requiresDestination: function() {
		return this.hasRemoteFlights;
	},

	start: function(destination, options) {
		if(this.briefing()) {
			this.briefing().applyOptions(options);
		} else {
			this.briefing(options);
		}
		this.logger.debug('Briefing done');
		if(this.requiresDestination() && !this.briefing().hasDestination(destination)) {
			this.logger.error((destination || '<empty>').warn, 'is not a valid destination');
			process.exit(1);
		}

		if(this.isAborted()) {
			this.logger.error('Flightplan aborted'.error);
			process.exit(1);
		}
		this.logger.info('Executing flightplan with'.info, String(this.flights.length).magenta
							, 'planned flight(s) to'.info, (destination || 'localhost').warn);
		this.logger.space();

		Fiber(function() {

			var t = process.hrtime();

			for(var i=0, len=this.flights.length; i < len; i++) {
				var flight = this.flights[i];

				this.logger.info('Flight'.info, this.logger.format('%s/%s', i+1, len).magenta, 'launched...'.info);
				this.logger.space();

				flight.start(destination);

				var status = flight.getStatus()
					, flightNumber = this.logger.format('%s/%s', i+1, len).magenta
					, executionTime = this.logger.format('%s%s', status.executionTime, 'ms').magenta
					, crashReason = !status.crashRecordings ? '' : this.logger.format('when %s', status.crashRecordings);

				if(flight.isAborted()) {
					this.logger.error('Flight'.error, flightNumber, 'aborted after'.error, executionTime, crashReason);
					this.logger.space();
					break;
				}
				this.logger.success('Flight'.success, flightNumber, 'landed after'.success, executionTime);
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