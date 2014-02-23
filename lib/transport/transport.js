var util = require('util')
	, Fiber = require('fibers')
	, prompt = require('prompt')
	, commands = require('./commands');

/**
 * A transport is the interface you use during flights. Basically they
 * offer you a set of methods to execute a chain of commands. Depending on the
 * type of flight, this is either a `ShellTransport` object for local
 * flights, or an `SSHTransport` for remote flights. Both transports
 * expose the same set of methods as described in this section.
 *
 * ```javascript
 * plan.local(function(local) {
 *     local.echo('ShellTransport.echo() called');
 * });
 *
 * plan.local(function(remote) {
 *     remote.echo('SSHTransport.echo() called');
 * });
 * ```
 *
 * We call the Transport object `transport` in the following section to avoid
 * confusion. However, do yourself a favor and use `local` for local, and
 * `remote` for remote flights.
 *
 * @class Transport
 * @return transport
 */
function Transport(flight) {
	this.options = {
		silent: false,
		failsafe: false
	};
	this._prefixString = '';
	this.flight = flight;
	this.logger = flight.logger;

	commands.forEach(function(cmd) {
		this[cmd] = function(args, opts) {
			opts = this._parseOptions(opts);
			return this.__exec(cmd, args, opts);
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
		return this.__exec(cmd, args.join(' '), opts);
	},

	/**
	 * Execute a command as another user with `sudo()`. It has the same
	 * signature as `exec()`. Per default, the user under which the command
	 * will be executed is "root". This can be changed by passing
	 * `user: "name"` with the second argument:
	 *
	 * ```javascript
	 * // will run: sudo -u root -i bash -c 'Hello world'
	 * transport.sudo('echo Hello world');
	 *
	 * // will run sudo -u www -i bash -c 'Hello world'
	 * transport.sudo('echo Hello world', {user: 'www'});
	 *
	 * // further options passed (see `exec()`)
	 * transport.sudo('echo Hello world', {user: 'www', silent: true, failsafe: true});
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
		return this.__exec('sudo', args, opts);
	},

	/**
	 * Copy a list of files to the current destination's remote host(s) using
	 * `rsync` with the SSH protocol. File transfers are executed in parallel.
	 *  After finishing all transfers, an array containing results from
	 * `transport.exec()` is returned. This method is only available on local
	 * flights.
	 *
	 * ```javascript
	 * var files = ['path/to/file1', 'path/to/file2'];
	 * local.transfer(files, '/tmp/foo');
	 * ```
	 *
	 * #### Files argument
	 * To make things more comfortable, the `files` argument doesn't have to be
	 * passed as an array. Results from previous commands and zero-terminated
	 * strings are handled as well:
	 *
	 * ```javascript
	 * // use result from a previous command
	 * var files = local.git('ls-files', {silent: true}); // get list of files under version control
	 * local.transfer(files, '/tmp/foo');
	 *
	 * // use zero-terminated result from a previous command
	 * var files = local.exec('(git ls-files -z;find node_modules -type f -print0)', {silent: true});
	 * local.transfer(files, '/tmp/foo');
	 *
	 * // use results from multiple commands
	 * var result1 = local.git('ls-files', {silent: true}).stdout.split('\n');
	 * var result2 = local.find('node_modules -type f', {silent: true}).stdout.split('\n');
	 * var files = result1.concat(result2);
	 * files.push('path/to/another/file');
	 * local.transfer(files, '/tmp/foo');
	 * ```
	 *
	 * `transfer()` will use the current host's username defined with
	 * `briefing()` unless `fly` is called with the `-u|--username` option.
	 * In this case the latter will be used. If debugging is enabled
	 * (either with `briefing()` or with `fly --debug`), `rsync` is executed
	 * in verbose mode (`-v`).
	 *
	 * @method transfer(files, remoteDir[, options])
	 * @return [results]
	 */
	transfer: function(files, remoteDir, options) {
		this.__transfer(files, remoteDir, options);
	},

	/**
	 * Print a message to stdout. Flightplan takes care that the message
	 * is formatted correctly within the current context.
	 *
	 * ```javascript
	 * transport.log('Copying files to remote hosts');
	 * ```
	 *
	 * @method log(message)
	 */
	log: function() {
		this.logger.log.apply(this.logger, arguments);
	},

	/**
	 * Prompt for user input.
	 *
	 * ```javascript
	 * var input = transport.prompt('Are you sure you want to continue? [yes]');
	 * if(input.indexOf('yes') === -1) {
	 *     transport.abort('user canceled flight');
	 * }
	 *
	 * // prompt for password (with UNIX-style hidden input)
	 * var password = transport.prompt('Enter your password:', { hidden: true });
	 * ```
	 *
	 * @method prompt(message[, options])
	 * @return input
	 */
	prompt: function(message, options) {
		options = options || {};
		var fiber = Fiber.current;

		prompt.delimiter = '';
		prompt.message = 'prompt'.grey;
		prompt.start();

		prompt.get([{
			name: 'input',
			description: ' ' + message.white,
			hidden: options.hidden || false,
			required: options.required || false
		}], function(err, result) {
			if(err) {
				this.logger.space();
				fiber.throwInto(new Error('user canceled prompt'));
			}
			fiber.run(result ? result.input : null);
		}.bind(this));

		return Fiber.yield();
	},

	/**
	 * Prefix every command inside callback with string.
	 * Useful when trying to set a working directory
	 *
	 * ```javascript
	 * transport.prefixCommand('cd www && ', function() {
	 *   // same as calling remote.exec('cd www && git pull')
	 *   transport.git('pull');
	 * })
	 * ```
	 *
	 * @method prefix(prefix, fn)
	 */

	prefix: function(prefix, fn) {
		var prevPrefix = this._prefixString;
		this._prefixString = prefix + this._prefixString;
		fn();
		this._prefixString = prevPrefix;
	},

	/**
	 * Shorthand for calling prefix('cd path && ', fn);
	 *
	 * ```javascript
	 * transport.chdir(path, function() {
	 * 	transport.git('pull');
	 * });
	 * ```
	 *
	 * @method chdir(path, fn)
	 */
	chdir: function(path, fn) {
		this.prefix('cd ' + path + ' && ', fn);
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
	 * Output of commands will be printed to stdout.
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
	 * transport.log('Previous command failed, but flight was not aborted');
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
	 * transport.failsafe();
	 * transport.ls('foo'); // ls: foo: No such file or directory
	 * transport.log('Previous command failed, but flight was not aborted');
	 * transport.unsafe();
	 * transport.ls('foo'); // ls: foo: No such file or directory
	 * // flight aborted
	 * ```
	 *
	 * @method unsafe()
	 */
	unsafe: function() {
		this.options.failsafe = false;
	},

	/**
	 * Print a debug message to stdout if debug mode is enabled. Flightplan
	 * takes care that the message is formatted correctly within the current
	 * context.
	 *
	 * ```javascript
	 * transport.debug('Copying files to remote hosts');
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
	 * transport.abort('Severe turbulences over the atlantic ocean!');
	 * ```
	 *
	 * @method abort([message])
	 */
	abort: function() {
		this.flight.abort.apply(this.flight, arguments);
	},

	close: function() {
		this.__close();
	},

	__close: function() {
	},

	__exec: function() {
	},

	__transfer: function() {
		throw new Error('transfer: transport does not support this method');
	},

	_parseOptions: function(opts) {
		var options = util._extend({}, this.options); // clone
		return util._extend(options, opts);
	}

};

module.exports = Transport;