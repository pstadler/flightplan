var Fiber = require('fibers')
  , prettyTime = require('pretty-hrtime')
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
 * Commands in local flights are executed on the **localhost**.
 *
 * ```javascript
 * plan.local(function(transport) {
 *   transport.hostname(); // prints the hostname of localhost
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
 * ### Tasks
 * Flightplan supports optional tasks to run a subset of flights.
 *
 * ```javascript
 * // fly deploy:<destination>
 * plan.local('deploy', function(transport) {});
 *
 * // fly build:<destination>
 * plan.local('build', function(transport) {});
 *
 * // fly deploy:<destination> or...
 * // fly build:<destination>
 * plan.local(['deploy', 'build'], function(transport) {});
 * plan.remote(['deploy', 'build'], function(transport) {});
 * ```
 *
 * If no task is specified it's implicitly set to "default". Therefore,
 * `fly <destination>` is the same as `fly default:<destination>`.
 *
 * ```javascript
 * // fly <destination>
 * plan.local(function(transport) {});
 * // is the same as...
 * plan.local('default', function(transport) {});
 * // "default" + other tasks:
 * plan.remote(['default', 'deploy', 'build'], function(transport) {});
 * ```
 *
 * @class Flightplan
 * @return flightplan
 */
function Flightplan() {
  this._briefing = null;
  this.flights = {};
  this.target = {
    task: 'default',
    destination: null,
    hosts: []
  };
  this.status = {
    aborted: false,
    executionTime: 0
  };
  this.hasRemoteFlights = false;
  this.logger = new Logger();

  this.successCallback = function() {};
  this.disasterCallback = function() {};
  this.debriefingCallback  = function() {};

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
   * method of [mscdex/ssh2](https://github.com/mscdex/ssh2#connection-methods)
   * with one exception: `privateKey` needs to be passed as a string
   * containing the path to the keyfile instead of the key itself.
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
   * executed on your localhost. When `fn` gets called a `Transport` object
   * is passed with the first argument.
   *
   * ```javascript
   * plan.local(function(local) {
   *   local.echo('hello from your localhost.');
   * });
   * ```
   *
   * An optional first parameter of type Array or String can be passed for
   * defining the flight's task(s).
   *
   * @method local([tasks, ]fn)
   * @return this
   */
  local: function() {
    var args = Array.prototype.slice.call(arguments, 0);
    var fn, tasks = [];

    if(typeof args[0] === 'string') {
      tasks.push(args[0]);
      fn = args[1];
    } else if(args[0] instanceof Array) {
      tasks = args[0];
      fn = args[1];
    } else {
      tasks.push('default');
    }

    var flight = new LocalFlight(this, fn || args[0]);

    tasks.forEach(function(task) {
      this.flights[task] = this.flights[task] || [];
      this.flights[task].push(flight);
    }.bind(this));

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
   * An optional first parameter of type Array or String can be passed for
   * defining the flight's task(s).
   *
   * @method remote([tasks, ]fn)
   * @return this
   */
  remote: function() {
    var args = Array.prototype.slice.call(arguments, 0);
    var fn, tasks = [];

    if(typeof args[0] === 'string') {
      tasks.push(args[0]);
      fn = args[1];
    } else if(args[0] instanceof Array) {
      tasks = args[0];
      fn = args[1];
    } else {
      tasks.push('default');
    }

    var flight = new RemoteFlight(this, fn || args[0]);

    tasks.forEach(function(task) {
      this.flights[task] = this.flights[task] || [];
      this.flights[task].push(flight);
    }.bind(this));

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

  abort: function() {
    this.status.aborted = true;
  },

  requiresDestination: function() {
    return this.hasRemoteFlights;
  },

  getDestinations: function() {
    return this.briefing().getDestinations();
  },

  start: function(task, destination, options) {
    this.target.task = task;
    this.target.destination = destination;

    if(this.briefing()) {
      this.briefing().applyOptions(options);
    } else {
      this.briefing(options);
    }
    this.logger.debug('Briefing done');
    if(this.requiresDestination() && !this.briefing().hasDestination(this.target.destination)) {
      this.logger.error((destination || '<empty>').warn, 'is not a valid destination');
      process.exit(1);
    }

    var flightsForTask = this.flights[this.target.task] || [];
    this.target.hosts = this.briefing().getHostsForDestination(this.target.destination);

    if(this.isAborted()) {
      this.logger.error('Flightplan aborted'.error);
      process.exit(1);
    }
    this.logger.info('Flying to'.info
                      , (this.target.task === 'default' ? '' : (this.target.task.warn + ':'))
                      + (this.target.destination || 'localhost').warn
                      , 'with '.info + String(flightsForTask.length).magenta + ' flight(s)'.info);
    this.logger.space();

    new Fiber(function() {

      var t = process.hrtime();

      for(var i=0, len=flightsForTask.length; i < len; i++) {
        var flight = flightsForTask[i];

        this.logger.info('Flight'.info, this.logger.format('%s/%s', i+1, len).magenta
                                                                          , 'launched...'.info);
        this.logger.space();

        flight.start(this.target.destination);

        var status = flight.getStatus()
          , flightNumber = this.logger.format('%s/%s', i+1, len).magenta
          , executionTime = prettyTime(status.executionTime).magenta;

        if(flight.isAborted()) {
          var crashReason = !status.crashRecordings ? ''
                                          : this.logger.format('when %s', status.crashRecordings);
          this.logger.error('Flight'.error, flightNumber, 'aborted after'.error
                                                                    , executionTime, crashReason);
          this.logger.space();
          break;
        }
        this.logger.success('Flight'.success, flightNumber, 'landed after'.success, executionTime);
        this.logger.space();
      }

      this.status.executionTime = process.hrtime(t);

      if(this.isAborted()) {
        this.logger.error('Flightplan aborted after'.error
                              , prettyTime(this.status.executionTime).magenta);
        this.disasterCallback();
        this.debriefingCallback();
        process.exit(1);
      } else {
        this.logger.success('Flightplan finished after'.success
                              , prettyTime(this.status.executionTime).magenta);
        this.successCallback();
        this.debriefingCallback();
        process.exit(0);
      }

    }.bind(this)).run();
  }

};

module.exports = Flightplan;