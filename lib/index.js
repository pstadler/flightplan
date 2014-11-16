var format = require('util').format
  , extend = require('util-extend')
  , Fiber = require('fibers')
  , logger = require('./logger')()
  , errors = require('./errors')
  , flight = require('./flight');

var DEFAULT_TASK = 'default';

function _setupFlight(type, tasksOrFn, fn) {
  var tasks;
  if(typeof tasksOrFn === 'string') {
    tasks = [tasksOrFn];
  } else if(Array.isArray(tasks)) {
    tasks = tasksOrFn;
  } else {
    tasks = [DEFAULT_TASK];
    fn = tasksOrFn;
  }
  return { type: type, tasks: tasks, fn: fn };
}

/**
 * A flightplan is a set of subsequent flights to be executed on one or more
 * hosts. The constructor doesn't take any arguments. Configuration is handled
 * with the `target()` method.
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
 * // fly deploy:<target>
 * plan.local('deploy', function(transport) {});
 *
 * // fly build:<target>
 * plan.local('build', function(transport) {});
 *
 * // fly deploy:<target> or...
 * // fly build:<target>
 * plan.local(['deploy', 'build'], function(transport) {});
 * plan.remote(['deploy', 'build'], function(transport) {});
 * ```
 *
 * If no task is specified it's implicitly set to "default". Therefore,
 * `fly <target>` is the same as `fly default:<target>`.
 *
 * ```javascript
 * // fly <target>
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
  this._targets = [];
  this._flights = [];

  this.runtime = Object.freeze({});

  process.on('SIGINT', function() {
    throw new errors.ProcessInterruptedError('Flightplan was interrupted');
  });

  process.on('uncaughtException', function(err) {
    var message = err.stack;
    if(err instanceof errors.BaseError) {
      message = err.message;
    }
    logger.error(message);
    process.exit(1);
  });
}

/**
 * Configure the flightplan's targets with `target()`. Without a
 * proper setup you can't do remote flights which require at
 * least one remote host. Each target consists of one ore more hosts.
 *
 * Values in the hosts section are passed directly to the `connect()`
 * method of [mscdex/ssh2](https://github.com/mscdex/ssh2#connection-methods)
 * with one exception: `privateKey` needs to be passed as a string
 * containing the path to the keyfile instead of the key itself.
 *
 * ```javascript
 * // run with `fly staging`
 * plan.target('staging', {
 *   // see: https://github.com/mscdex/ssh2#connection-methods
 *   host: 'staging.example.com',
 *   username: 'pstadler',
 *   agent: process.env.SSH_AUTH_SOCK
 * });
 *
 * // run with `fly production`
 * plan.target('production', [
 *   {
 *     host: 'www1.example.com',
 *     username: 'pstadler',
 *     agent: process.env.SSH_AUTH_SOCK
 *   },
 *   {
 *     host: 'www2.example.com',
 *     username: 'pstadler',
 *     agent: process.env.SSH_AUTH_SOCK
 *   }
 * ]);
 * ```
 *
 * You can override the `username` value of hosts by calling `fly` with
 * the `-u|--username` option:
 *
 * ```bash
 * fly production --username=admin
 * ```
 *
 * @method target(name, hosts)
 * @return this
 */
Flightplan.prototype.target = function(name, hosts/*, options*/) {
  if(!Array.isArray(hosts)) {
    hosts = [hosts];
  }
  this._targets[name] = { hosts: hosts/*, options: options*/ };
  return this;
};

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
Flightplan.prototype.local = function(tasksOrFn, fn) {
  this._flights.push(_setupFlight(flight.TYPE.LOCAL, tasksOrFn, fn));
  return this;
};

/**
 * Register a remote flight. Remote flights are executed on the current
 * target's remote hosts defined with `briefing()`. When `fn` gets called
 * a `Transport` object is passed with the first argument.
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
Flightplan.prototype.remote = function(tasksOrFn, fn) {
  this._flights.push(_setupFlight(flight.TYPE.REMOTE, tasksOrFn, fn));
  return this;
};

Flightplan.prototype.run = function(task, target, options) {
  options = options || {};

  if(Object.keys(this._targets).indexOf(target) === -1) {
    throw new errors.InvalidTargetError(
                format('"%s" is not a valid target', target));
  }

  // Filter flights to be executed
  var flights = this._flights.filter(function(f) {
    return f.tasks.indexOf(task) !== -1;
  });

  if(flights.length === 0) {
    logger.warn(format('"%s" is not a valid task', task));
    process.exit(1);
  }

  // Set up context
  var context = {
    options: options,
    target: target,
    task: task
  };
  if(this._targets[target].hosts) {
    context.hosts = this._targets[target].hosts.map(function(host) {
      if(options.username) {
        host.username = options.username;
      }
      return host;
    });
  }

  this.runtime = Object.freeze(extend({}, context));

  // Execute flights
  logger.info(format('Running %s:%s', task, target));
  new Fiber(function() {
    flights.forEach(function(f) {
      flight.run(f.type, f.fn, context);
    });
  }).run();
};

/**
* Manually abort the current flightplan and prevent any further commands and
* flights from being executed. An optional message can be passed which
* is displayed after the flight has been aborted.
*
* ```javascript
* plan.abort('Severe turbulences over the atlantic ocean!');
* ```
*
* @method abort([message])
*/
Flightplan.prototype.abort = function(message) {
  throw new errors.AbortedError(message || 'Flightplan aborted');
};

var instance = new Flightplan();
module.exports = instance;