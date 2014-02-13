# Flightplan ✈ [![NPM version][npm-image]][npm-url]

Run a sequence of commands against local and remote hosts.

Flightplan ~~is~~ *will be* a feature complete [node.js](http://nodejs.org) library for streamlining application deployment or systems administration tasks, similar to Python's [Fabric](http://fabfile.org).

## Installation & Usage

```bash
# install the cli tool
$ npm install -g flightplan

# use it in your project
$ npm install flightplan --save-dev

# to run a flightplan (`fly --help` for more information)
$ fly <destination> [--plan flightplan.js]
```

## Sample flightplan.js

```javascript
// flightplan.js
var Flightplan = require('flightplan');

var tmpDir = 'pstadler-sh-' + new Date().getTime();

// configuration
plan.briefing({
	debug: false,
	destinations: {
		'production': [{
			// See: https://github.com/mscdex/ssh2#connection-methods
			host: 'pstadler.sh',
			username: 'pstadler',
			agent: process.env.SSH_AUTH_SOCK
		}]
	}
});

// run commands on localhost
plan.domestic(function(local) {
	local.log('Run build');
	local.exec('gulp build');

	local.log('Copy files to remote host');
	var filesToCopy = '(git ls-files -z;find assets/public -type f -print0)';
	local.exec(filesToCopy + '|rsync --files-from - -avz0 --rsh="ssh"'
				+ ' ./ pstadler@pstadler.sh:/tmp/' + tmpDir);
});

// run commands on remote hosts (destinations)
plan.international(function(remote) {
	remote.log('Move folder to web root');
	remote.sudo('cp -R /tmp/' + tmpDir + ' ~', { user: 'www' });
	remote.rm('-rf /tmp/' + tmpDir);

	remote.log('Install dependencies');
	remote.sudo('npm --production --silent --prefix ~/'
					+ tmpDir + ' install ~/' + tmpDir, { user: 'www' });

	remote.log('Reload application');
	remote.sudo('ln -snf ~/' + tmpDir + ' ~/pstadler-sh', { user: 'www' });
	remote.sudo('pm2 reload pstadler-sh', { user: 'www' });
});

// run more commands on localhost afterwards
plan.domestic(function(local) { /* ... */ });
// ...or on remote hosts
plan.domestic(function(remote) { /* ... */ });

// executed if flightplan succeeded
plan.success(function() {
});

// executed if flightplan failed
plan.disaster(function() {
});

// always executed after flightplan finished
plan.debriefing(function() {
});
```

# Documentation

<!-- DOCS -->

<!-- Start lib/flightplan.js -->

## Flightplan

A flightplan is a set of subsequent flights to be executed on one or more
hosts. The constructor doesn't take any arguments. The configuration is
handled with the `briefing()` method.

```javascript
var plan = new Flightplan();
```

#### Flights
A flight is a set of commands to be executed on one or more hosts. There are
two types of flights:

##### Domestic flights

Commands in domestic flights are executed on the **local host**.

```javascript
plan.domestic(function(transport) {
    transport.hostname(); // prints the hostname of the local host
});
```

##### International flights

Commands in international flights are executed in **parallel** against
remote hosts defined during the briefing.

```javascript
plan.international(function(transport) {
    transport.hostname(); // prints the hostname(s) of the remote host(s)
});
```

You can define multiple flights of each type. They will be executed in the
order of their definition. If a previous flight failed, all subsequent
flights won't get executed. For more information about what it means for
a flight to fail, see the section about `Transport`.

```javascript
// executed first
plan.domestic(function(transport) {});

// executed if first flight succeeded
plan.international(function(transport) {});

// executed if second flight succeeded
plan.domestic(function(transport) {});

// ...
```

### flightplan.briefing(config) → this

Configure the flightplan's destinations with `briefing()`. Without a
proper briefing you can't do international flights which require at
least one destination. Each destination consists of one ore more hosts.

Values in the hosts section are passed directly to @mscdex's
[ssh2.connect() method](https://github.com/mscdex/ssh2#connection-methods)

```javascript
plan.briefing({
    destinations: {
        // run with `fly staging`
        'staging': {
            // see: https://github.com/mscdex/ssh2#connection-methods
            host: 'staging.pstadler.sh',
            username: 'pstadler',
            agent: process.env.SSH_AUTH_SOCK
        },
        // run with `fly production`
        'production': [
            {
                host: 'www1.pstadler.sh',
                username: 'pstadler',
                agent: process.env.SSH_AUTH_SOCK
            },
            {
                host: 'www2.pstadler.sh',
                username: 'pstadler',
                agent: process.env.SSH_AUTH_SOCK
            },
        ]
    }
});
```

You can override the `username` value of all hosts by calling `fly` with
the `-u|--username` option:

```bash
fly production --username=admin
```

### flightplan.domestic(fn) → this

Calling this method registers a domestic flight. Domestic flights are
executed on your local host. When `fn` gets called a `Transport` object
is passed with the first argument.

```
plan.domestic(function(local) {
    local.echo('hello from your localhost.');
});
```

### flightplan.international(fn) → this

Calling this method registers an international flight. International
flights are executed on the current destination's remote hosts defined
with `briefing()`. When `fn` gets called a `Transport` object is passed
with the first argument.

```
plan.international(function(remote) {
    remote.echo('hello from the remote host.');
});
```

### flightplan.success(fn) → this

`fn()` is called after the flightplan (and therefore all flights)
succeeded.

### flightplan.disaster(fn) → this

`fn()` is called after the flightplan was aborted.

### flightplan.debriefing(fn)

`fn()` is called at the very end of the flightplan's execution.

### flightplan.isAborted() → Boolean

Whether the flightplan is aborted or not.

### flightplan.abort([message])

Calling this method will abort the flightplan and prevent any further
flights from being executed. An optional message can be passed which
will be displayed after the flightplan has been aborted.

```javascript
plan.abort('Severe turbulences over the atlantic ocean!');
```

<!-- End lib/flightplan.js -->

<!-- Start lib/transport/transport.js -->

## Transport

A transport is the interface you use during flights. Basically they
offer you a set of methods to execute a chain of commands. Depending on the
type of flight, this is either a `ShellTransport` object for domestic
flights, or an `SSHTransport` for international flights. Both transports
expose the same set of methods as described in this section.

```javascript
plan.domestic(function(local) {
    local.echo('ShellTransport.echo() called');
});

plan.domestic(function(remote) {
    remote.echo('SSHTransport.echo() called');
});
```

We call the Transport object `transport` in the following section to avoid
confusion. However, do yourself a favor and use `local` for domestic, and
`remote` for international flights.

### transport.exec(command[, options]) → code: int, stdout: String, stderr: String

To execute a command you have the choice between using `exec()` or one
of the handy wrappers for often used commands:
`transport.exec('ls -al')` is the same as `transport.ls('-al')`. If a
command returns a non-zero exit code, the flightplan will be aborted and
all subsequent commands and flights won't get executed.

#### Options
Options can be passed as a second argument. If `failsafe: true` is
passed, the command is allowed to fail (i.e. exiting with a non-zero
exit code), whereas `silent: true` will simply suppress its output.

```javascript
// output of `ls -al` is suppressed
transport.ls('-al', {silent: true});

// flightplan continues even if command fails with exit code `1`
transport.ls('-al foo', {failsafe: true}); // ls: foo: No such file or directory

// both options together
transport.ls('-al foo', {silent: true, failsafe: true});
```

To apply these options to multiple commands check out the docs of
`transport.silent()` and `transport.failsafe()`.

#### Return value
Each command returns an object containing `code`, `stdout` and`stderr`:

```javascript
var retval = transport.echo('Hello world');
console.log(retval); // { code: 0, stdout: 'Hello world\n', stderr: null }
```

### transport.sudo(command[, options]) → code: int, stdout: String, stderr: String

Execute a command as another user with `sudo()`. It has the same
signature as `exec()`. Per default, the user under which the command
will be executed is "root". This can be changed by passing
`user: &lt;name&gt;` with the second argument:

```javascript
// will run: sudo -u root -i bash -c 'Hello world'
transport.sudo('echo Hello world');

// will run sudo -u www -i bash -c 'Hello world'
transport.sudo('echo Hello world', {user: 'www'});

// further options passed (see `exec()`)
transport.sudo('echo Hello world', {user: 'www'});
```

### transport.log(message)

Print a message to stdout. Flightplan takes care that the message
is formatted correctly within the current context.

```javascript
transport.log('Copying files to remote host');
```

### transport.silent()

When calling `silent()` all subsequent commands are executed without
printing their output to stdout until `verbose()` is called.

```javascript
transport.ls(); // output will be printed to stdout
transport.silent();
transport.ls(); // output won't be printed to stdout
```

### transport.verbose()

Calling `verbose()` reverts the behavior introduced with `silent()`.
Output of commands will be printed to

```javascript
transport.silent();
transport.ls(); // output won't be printed to stdout
transport.verbose();
transport.ls(); // output will be printed to stdout
```

### transport.failsafe()

When calling `failsafe()`, all subsequent commands are allowed to fail
until `unsafe()` is called. In other words, the flight will continue
even if the return code of the command is not `0`. This is helpful if
either you expect a command to fail or their nature is to return a
non-zero exit code.

```javascript
transport.failsafe();
transport.ls('foo'); // ls: foo: No such file or directory
remote.log('Previous command failed, but flight was not aborted');
```

### transport.unsafe()

Calling `unsafe()` reverts the behavior introduced with `failsafe()`.
The flight will be aborted if a subsequent command fails (i.e. returns
a non-zero exit code). This is the default behavior.

```javascript
remote.failsafe();
remote.ls('foo'); // ls: foo: No such file or directory
remote.log('Previous command failed, but flight was not aborted');
remote.unsafe();
remote.ls('foo'); // ls: foo: No such file or directory -&gt; abort
```

### transport.debug(message)

Print a debug message to stdout. Flightplan takes care that the message
is formatted correctly within the current context.

```javascript
remote.debug('Copying files to remote host');
```

### transport.abort([message])

Manually abort the current flight and prevent any further commands and
flights from being executed. An optional message can be passed which
is displayed after the flight has been aborted.

```javascript
remote.abort('Severe turbulences over the atlantic ocean!');
```

<!-- End lib/transport/transport.js -->

<!-- ENDDOCS -->

## What's planned?

- Add possibility to define a `sudoUser` per host with `briefing()`.
- Add a simple interface for file transport to remote hosts (e.g. `rsync`).
- Tests will be implemented with upcoming releases. A part of this will be driven by bug reports.

[npm-url]: https://npmjs.org/package/flightplan
[npm-image]: https://badge.fury.io/js/flightplan.png