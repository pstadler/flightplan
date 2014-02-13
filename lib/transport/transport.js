var util = require('util')
	, commands = require('./commands');

/**
 * A transport is the interface you use during flights. Basically they
 * offer you a set of methods to execute a chain of commands. Depending on the
 * type of flight, this is either a `ShellTransport` object for domestic
 * flights, or an `SSHTransport` for international flights. Both transports
 * expose the same set of methods as described in this section.
 *
 * ```javascript
 * plan.domestic(function(local) {
 *     local.echo('ShellTransport.echo() called');
 * });
 *
 * plan.domestic(function(remote) {
 *     remote.echo('SSHTransport.echo() called');
 * });
 * ```
 *
 * We call the Transport object `transport` in the following section to avoid
 * confusion. However, do yourself a favor and use `local` for domestic, and
 * `remote` for international flights.
 *
 * @class Transport
 * @return transport
 */
function Transport(flight) {
	this.options = {
		silent: false,
		failsafe: false
	};
	this.flight = flight;
	this.logger = flight.logger;

	commands.forEach(function(cmd) {
		this[cmd] = function(args, opts) {
			opts = this._parseOptions(opts);
			return this._execOrSkip(cmd, args, opts);
		};
	}, this);
}

Transport.prototype = {

	/**
	 * To execute a command you have the choice between using `exec()` or one
	 * of the handy wrappers for often used commands:
	 * `transport.exec('ls -al')` is the same as `transport.ls('-al')`. If a
	 * command returns a non-zero exit code, the flightplan will be aborted and
	 * all subsequent commands and flights won't get executed.
	 *
	 * #### Options
	 * Options can be passed as a second argument. If `failsafe: true` is
	 * passed, the command is allowed to fail (i.e. exiting with a non-zero
	 * exit code), whereas `silent: true` will simply suppress its output.
	 *
	 * ```javascript
	 * // output of `ls -al` is suppressed
	 * transport.ls('-al', {silent: true});
	 *
	 * // flightplan continues even if command fails with exit code `1`
	 * transport.ls('-al foo', {failsafe: true}); // ls: foo: No such file or directory
	 *
	 * // both options together
	 * transport.ls('-al foo', {silent: true, failsafe: true});
	 * ```
	 *
	 * To apply these options to multiple commands check out the docs of
	 * `transport.silent()` and `transport.failsafe()`.
	 *
	 * #### Return value
	 * Each command returns an object containing `code`, `stdout` and`stderr`:
	 *
	 * ```javascript
	 * var retval = transport.echo('Hello world');
	 * console.log(retval); // { code: 0, stdout: 'Hello world\n', stderr: null }
	 * ```
	 *
	 * @method exec(command[, options])
	 * @return code: int, stdout: String, stderr: String
	 */
	exec: function(args, opts) {
		args = args.split(' ');
		cmd = args.shift();
		opts = this._parseOptions(opts);
		return this._execOrSkip(cmd, args.join(' '), opts);
	},

	/**
	 * Execute a command as another user with `sudo()`. It has the same
	 * signature as `exec()`. Per default, the user under which the command
	 * will be executed is "root". This can be changed by passing
	 * `user: <name>` with the second argument:
	 *
	 * ```javascript
	 * // will run: sudo -u root -i bash -c 'Hello world'
	 * transport.sudo('echo Hello world');
	 *
	 * // will run sudo -u www -i bash -c 'Hello world'
	 * transport.sudo('echo Hello world', {user: 'www'});
	 *
	 * // further options passed (see `exec()`)
	 * transport.sudo('echo Hello world', {user: 'www'});
	 * ```
	 *
	 * @method sudo(command[, options])
	 * @return code: int, stdout: String, stderr: String
	 */
	sudo: function(args, opts) {
		var user = util.format('-u %s', opts && opts.user ? opts.user : 'root');
		var format = "%s -i bash -c '%s'";
		args = util.format(format, user, args);
		opts = this._parseOptions(opts);
		return this._execOrSkip('sudo', args, opts);
	},

	/**
	 * Print a message to stdout. Flightplan takes care that the message
	 * is formatted correctly within the current context.
	 *
	 * ```javascript
	 * transport.log('Copying files to remote host');
	 * ```
	 *
	 * @method log(message)
	 */
	log: function() {
		this.logger.log.apply(this.logger, arguments);
	},

	/**
	 * When calling `silent()` all subsequent commands are executed without
	 * printing their output to stdout until `verbose()` is called.
	 *
	 * ```javascript
	 * transport.ls(); // output will be printed to stdout
	 * transport.silent();
	 * transport.ls(); // output won't be printed to stdout
	 * ```
	 *
	 * @method silent()
	 */
	silent: function() {
		this.options.silent = true;
	},

	/**
	 * Calling `verbose()` reverts the behavior introduced with `silent()`.
	 * Output of commands will be printed to
	 *
	 * ```javascript
	 * transport.silent();
	 * transport.ls(); // output won't be printed to stdout
	 * transport.verbose();
	 * transport.ls(); // output will be printed to stdout
	 * ```
	 *
	 * @method verbose()
	 */
	verbose: function() {
		this.options.silent = false;
	},

	/**
	 * When calling `failsafe()`, all subsequent commands are allowed to fail
	 * until `unsafe()` is called. In other words, the flight will continue
	 * even if the return code of the command is not `0`. This is helpful if
	 * either you expect a command to fail or their nature is to return a
	 * non-zero exit code.
	 *
	 * ```javascript
	 * transport.failsafe();
	 * transport.ls('foo'); // ls: foo: No such file or directory
	 * remote.log('Previous command failed, but flight was not aborted');
	 * ```
	 *
	 * @method failsafe()
	 */
	failsafe: function() {
		this.options.failsafe = true;
	},

	/**
	 * Calling `unsafe()` reverts the behavior introduced with `failsafe()`.
	 * The flight will be aborted if a subsequent command fails (i.e. returns
	 * a non-zero exit code). This is the default behavior.
	 *
	 * ```javascript
	 * remote.failsafe();
	 * remote.ls('foo'); // ls: foo: No such file or directory
	 * remote.log('Previous command failed, but flight was not aborted');
	 * remote.unsafe();
	 * remote.ls('foo'); // ls: foo: No such file or directory -> abort
	 * ```
	 *
	 * @method unsafe()
	 */
	unsafe: function() {
		this.options.failsafe = false;
	},

	/**
	 * Print a debug message to stdout. Flightplan takes care that the message
	 * is formatted correctly within the current context.
	 *
	 * ```javascript
	 * remote.debug('Copying files to remote host');
	 * ```
	 *
	 * @method debug(message)
	 */
	debug: function() {
		this.logger.debug.apply(this.logger, arguments);
	},

	/**
	 * Manually abort the current flight and prevent any further commands and
	 * flights from being executed. An optional message can be passed which
	 * is displayed after the flight has been aborted.
	 *
	 * ```javascript
	 * remote.abort('Severe turbulences over the atlantic ocean!');
	 * ```
	 *
	 * @method abort([message])
	 */
	abort: function() {
		this.flight.abort.apply(this.flight, arguments);
	},

	__close: function() {
	},

	__exec: function() {
	},

	close: function() {
		if(this.__close) {
			this.__close();
		}
	},

	_execOrSkip: function(cmd, args, opts) {
		if(this.flight.isAborted()) {
			return { code: 0, stdout: null, stderr: null };
		}
		var result = this.__exec(cmd, args, opts);
		this.logger.space();
		return result;
	},

	_parseOptions: function(opts) {
		var options = util._extend({}, this.options); // clone
		return util._extend(options, opts);
	}

};

module.exports = Transport;