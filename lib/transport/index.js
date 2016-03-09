var format = require('util').format
  , extend = require('util-extend')
  , Future = require('fibers/future')
  , prompt = require('prompt')
  , chalk = require('chalk')
  , logger = require('../logger')
  , errors = require('../errors')
  , commands = require('./commands')
  , queue = require('../utils/queue')
  , escapeSingleQuotes = require('../utils').escapeSingleQuotes;

/**
 * A transport is the interface you use during flights. Basically they
 * offer you a set of methods to execute a chain of commands. Depending on the
 * type of flight, this is either a `Shell` object for local
 * flights, or an `SSH` for remote flights. Both transports
 * expose the same set of methods as described in this section.
 *
 * ```javascript
 * plan.local(function(local) {
 *   local.echo('Shell.echo() called');
 * });
 *
 * plan.remote(function(remote) {
 *   remote.echo('SSH.echo() called');
 * });
 * ```
 *
 * We call the Transport object `transport` in the following section to avoid
 * confusion. However, do yourself a favor and use `local` for local, and
 * `remote` for remote flights.
 *
 * #### Accessing runtime information
 *
 * Flightplan provides information during flights with the `runtime` properties:
 *
 * ```javascript
 * plan.remote(function(transport) { // applies to local flights as well
 *   // Flightplan specific information
 *   console.log(plan.runtime.task);    // 'default'
 *   console.log(plan.runtime.target);  // 'production'
 *   console.log(plan.runtime.hosts);   // [{ host: 'www1.example.com', port: 22 }, ...]
 *   console.log(plan.runtime.options); // { debug: true, ... }
 *
 *   // Flight specific information
 *   console.log(transport.runtime); // { host: 'www1.example.com', port: 22 }
 * });
 * ```
 *
 * @class Transport
 * @return {Object} transport
 */
function Transport(context) {
  this._context = context;
  this._options = {
    silent: false,
    failsafe: false
  };
  this._execWith = '';

  this._logger = logger({
    debug: this._context.options.debug,
    prefix: this._context.remote.host
  });

  this.runtime = Object.freeze(extend({}, this._context.remote)); // userland

  commands.forEach(function(command) {
    this[command] = function(args, options) {
      if(typeof args === 'object') {
        options = args;
        args = null;
      }

      var _command = format('%s%s', this._execWith, command);
      _command = args ? format('%s %s', _command, args) : _command;

      return this._exec(_command, options || {});
    };
  }, this);
}

Transport.prototype._exec = function() {
  throw new Error('This transport does not implement `_exec(command, options)`');
};

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
 * var result = transport.echo('Hello world');
 * console.log(result); // { code: 0, stdout: 'Hello world\n', stderr: null }
 * ```
 *
 * #### Advanced options
 * Flightplan uses `child_process#exec()` for executing local commands and
 * `mscdex/ssh2#exec()` for remote commands. Options passed with `exec` will
 * be forwarded to either of these functions.
 *
 * ```javascript
 * // increase maxBuffer for child_process#exec()
 * local.ls('-al', {exec: {maxBuffer: 2000*1024}});
 *
 * // enable pty for mscdex/ssh2#exec()
 * remote.ls('-al', {exec: {pty: true}});
 * ```
 *
 * @method exec(command[, options])
 * @return {Object} code: int, stdout: String, stderr: String
 */
Transport.prototype.exec = function(command, options) {
  command = command || '';
  options = options || {};

  return this._exec(format('%s%s', this._execWith, command), options);
};

/**
 * Execute a command as another user with `sudo()`. It has the same
 * signature as `exec()`. Per default, the user under which the command
 * will be executed is "root". This can be changed by passing
 * `user: "name"` with the second argument:
 *
 * ```javascript
 * // will run: echo 'echo Hello world' | sudo -u root -i bash
 * transport.sudo('echo Hello world');
 *
 * // will run echo 'echo Hello world' | sudo -u www -i bash
 * transport.sudo('echo Hello world', {user: 'www'});
 *
 * // further options passed (see `exec()`)
 * transport.sudo('echo Hello world', {user: 'www', silent: true, failsafe: true});
 * ```
 *
 * Flightplan's `sudo()` requires a certain setup on your host. In order to
 * make things work on a typical Ubuntu installation, follow these rules:
 *
 * ```bash
 * # Scenario:
 * # 'pstadler' is the user for connecting to the host and 'www' is the user
 * # under which you want to execute commands with sudo.
 *
 * # 1. 'pstadler' has to be in the sudo group:
 * $ groups pstadler
 * pstadler : pstadler sudo
 *
 * # 2. 'pstadler' needs to be able to run sudo -u 'www' without a password.
 * # In order to do this, add the following line to /etc/sudoers:
 * pstadler ALL=(www) NOPASSWD: ALL
 *
 * # 3. user 'www' needs to have a login shell (e.g. bash, sh, zsh, ...)
 * $ cat /etc/passwd | grep www
 * www:x:1002:1002::/home/www:/bin/bash   # GOOD
 * www:x:1002:1002::/home/www:/bin/false  # BAD
 * ```
 *
 * @method sudo(command[, options])
 * @return {Object} code: int, stdout: String, stderr: String
 */
Transport.prototype.sudo = function(command, options) {
  command = command || '';
  options = options || {};

  var user = options.user || 'root';

  command = format('%s%s', this._execWith, command);
  command = escapeSingleQuotes(command);
  command = format("echo '%s' | sudo -u %s -i bash", command, user);

  return this._exec(command, options);
};

/**
 * Copy a list of files to the current target's remote host(s) using
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
 * `target()` unless `fly` is called with the `-u|--username` option.
 * In this case the latter will be used. If debugging is enabled
 * (either with `target()` or with `fly --debug`), `rsync` is executed
 * in verbose mode (`-vv`).
 *
 * @method transfer(files, remoteDir[, options])
 * @return {Array} [results]
 */
Transport.prototype.transfer = function() {
  throw new Error('This transport does not implement `transfer(files, remoteDir, options)`');
};

/**
 * Prompt for user input.
 *
 * ```javascript
 * var input = transport.prompt('Are you sure you want to continue? [yes]');
 * if(input.indexOf('yes') === -1) {
 *   plan.abort('User canceled flight');
 * }
 *
 * // prompt for password (with UNIX-style hidden input)
 * var password = transport.prompt('Enter your password:', { hidden: true });
 *
 * // prompt when deploying to a specific target
 * if(plan.runtime.target === 'production') {
 *   var input = transport.prompt('Ready for deploying to production? [yes]');
 *   if(input.indexOf('yes') === -1) {
 *     plan.abort('User canceled flight');
 *   }
 * }
 * ```
 *
 * @method prompt(message[, options])
 * @return {String} input
 */
var promptQueue = queue();

Transport.prototype.prompt = function(message, options) {
  options = options || {};

  var prefix = this._context.remote.host;

  return this.waitFor(function(done) {
    promptQueue.push(function() {
      prompt.colors = false;
      prompt.delimiter = '';
      prompt.message = chalk.gray(prefix) + ' * ';
      prompt.start();

      prompt.get({
        name: 'input',
        description: chalk.blue(message),
        hidden: options.hidden || false,
        required: options.required || false
      }, function(err, result) {
        if(err) {
          throw new errors.ProcessInterruptedError('User canceled prompt');
        }

        promptQueue.done(function() {
          done(result ? result.input : null);
        });
      });
    });

    promptQueue.next();
  });
};

/**
 * Execute a function and return after the callback `done` is called.
 * This is used for running asynchronous functions in a synchronous way.
 *
 * The callback takes an optional argument which is then returned by
 * `waitFor()`.
 *
 * ```javascript
 * var result = transport.waitFor(function(done) {
 *   require('node-notifier').notify({
 *       message: 'Hello World'
 *     }, function(err, response) {
 *       done(err || 'sent!');
 *     });
 * });
 * console.log(result); // 'sent!'
 * ```
 *
 * @method waitFor(fn(done))
 * @return {} mixed
 */
Transport.prototype.waitFor = function(fn) {
  function task() {
    var future = new Future();

    fn(function(result) {
      future.return(result);
    });

    return future;
  }

  return task().wait();
};

/**
 * Execute commands with a certain context.
 *
 * ```javascript
 * transport.with('cd /tmp', function() {
 *   transport.ls('-al'); // 'cd /tmp && ls -al'
 * });
 *
 * transport.with({silent: true, failsafe: true}, function() {
 *   transport.ls('-al'); // output suppressed, fail safely
 * });
 *
 * transport.with('cd /tmp', {silent: true}, function() {
 *   transport.ls('-al'); // 'cd /tmp && ls -al', output suppressed
 * });
 * ```
 *
 * @method with(command|options[, options], fn)
 */
Transport.prototype.with = function() {
  var previousExecWith = this._execWith;
  var previousOptions = extend({}, this._options); // clone

  var args = Array.prototype.slice.call(arguments, 0);

  for(var i in args) {
    if(typeof args[i] === 'string') {
      this._execWith += args[i] + ' && ';
    } else if(typeof args[i] === 'object') {
      this._options = extend(this._options, args[i]);
    } else if(typeof args[i] === 'function') {
      args[i]();
    }
  }

  this._execWith = previousExecWith;
  this._options = previousOptions;
};

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
Transport.prototype.silent = function() {
  this._options.silent = true;
};

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
Transport.prototype.verbose = function() {
  this._options.silent = false;
};

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
Transport.prototype.failsafe = function() {
  this._options.failsafe = true;
};

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
Transport.prototype.unsafe = function() {
  this._options.failsafe = false;
};

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
Transport.prototype.log = function(message) {
  this._logger.user(message);
};

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
Transport.prototype.debug = function(message) {
  this._logger.debug(message);
};

Transport.prototype.close = function() {};

module.exports = Transport;
