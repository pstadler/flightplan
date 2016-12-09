# Flightplan

[![NPM version][npm-version-image]][npm-url] [![Build Status][build-status-image]][build-status-url]
[![Build Status][coverage-image]][coverage-url] [![NPM downloads][npm-downloads-image]][npm-url] [![Dependency Status][dependencies-image]][dependencies-url]

Run sequences of shell commands against local and remote hosts.

Flightplan is a [node.js](http://nodejs.org) library for streamlining application deployment or systems administration tasks.

A complete list of changes can be found in the [Changelog](https://github.com/pstadler/flightplan/releases). Support is available on [Gitter](https://gitter.im/pstadler/flightplan).

## Installation & Usage

```bash
# install the cli tool
$ npm install -g flightplan

# use it in your project
$ npm install flightplan --save-dev

# run a flightplan (`fly --help` for more information)
$ fly [task:]<target> [--flightplan flightplan.(js|coffee)]
```

By default, the `fly` command will try to load `flightplan.js` or `flightplan.coffee`.

## Sample flightplan.js

```javascript
// flightplan.js
var plan = require('flightplan');

// configuration
plan.target('staging', {
  host: 'staging.example.com',
  username: 'pstadler',
  agent: process.env.SSH_AUTH_SOCK
});

plan.target('production', [
  {
    host: 'www1.example.com',
    username: 'pstadler',
    agent: process.env.SSH_AUTH_SOCK
  },
  {
    host: 'www2.example.com',
    username: 'pstadler',
    agent: process.env.SSH_AUTH_SOCK
  }
]);

var tmpDir = 'example-com-' + new Date().getTime();

// run commands on localhost
plan.local(function(local) {
  local.log('Run build');
  local.exec('gulp build');

  local.log('Copy files to remote hosts');
  var filesToCopy = local.exec('git ls-files', {silent: true});
  // rsync files to all the target's remote hosts
  local.transfer(filesToCopy, '/tmp/' + tmpDir);
});

// run commands on the target's remote hosts
plan.remote(function(remote) {
  remote.log('Move folder to web root');
  remote.sudo('cp -R /tmp/' + tmpDir + ' ~', {user: 'www'});
  remote.rm('-rf /tmp/' + tmpDir);

  remote.log('Install dependencies');
  remote.sudo('npm --production --prefix ~/' + tmpDir
                            + ' install ~/' + tmpDir, {user: 'www'});

  remote.log('Reload application');
  remote.sudo('ln -snf ~/' + tmpDir + ' ~/example-com', {user: 'www'});
  remote.sudo('pm2 reload example-com', {user: 'www'});
});

// run more commands on localhost afterwards
plan.local(function(local) { /* ... */ });
// ...or on remote hosts
plan.remote(function(remote) { /* ... */ });
```

# Documentation

<!-- DOCS -->

<!-- Start ../lib/index.js -->

## Flightplan

A flightplan is a set of subsequent flights to be executed on one or more
hosts. Configuration is handled with the `target()` method.

```javascript
var plan = require('flightplan');
```

### Flights
A flight is a set of commands to be executed on one or more hosts. There are
two types of flights:

#### Local flights

Commands in local flights are executed on the **localhost**.

```javascript
plan.local(function(transport) {
  transport.hostname(); // prints the hostname of localhost
});
```

#### Remote flights

Commands in remote flights are executed in **parallel** against remote hosts.

```javascript
plan.remote(function(transport) {
  transport.hostname(); // prints the hostname(s) of the remote host(s)
});
```

You can define multiple flights of each type. They will be executed in the
order of their definition. If a previous flight failed, all subsequent
flights won't get executed. For more information about what it means for
a flight to fail, see the section about `Transport`.

```javascript
// executed first
plan.local(function(transport) {});

// executed if first flight succeeded
plan.remote(function(transport) {});

// executed if second flight succeeded
plan.local(function(transport) {});

// ...
```

### Tasks
Flightplan supports optional tasks to run a subset of flights.

```javascript
// fly deploy:<target>
plan.local('deploy', function(transport) {});

// fly build:<target>
plan.local('build', function(transport) {});

// fly deploy:<target> or...
// fly build:<target>
plan.local(['deploy', 'build'], function(transport) {});
plan.remote(['deploy', 'build'], function(transport) {});
```

If no task is specified it's implicitly set to "default". Therefore,
`fly <target>` is the same as `fly default:<target>`.

```javascript
// fly <target>
plan.local(function(transport) {});
// is the same as...
plan.local('default', function(transport) {});
// "default" + other tasks:
plan.remote(['default', 'deploy', 'build'], function(transport) {});
```

### flightplan.target(name, hosts[, options]) → this

Configure the flightplan's targets with `target()`. Without a
proper setup you can't do remote flights which require at
least one remote host. Each target consists of one or more hosts.

Values in the hosts section are passed directly to the `connect()`
method of [mscdex/ssh2](https://github.com/mscdex/ssh2#connection-methods)
with one exception: `privateKey` needs to be passed as a string
containing the path to the keyfile instead of the key itself.

```javascript
// run with `fly staging`
plan.target('staging', {
  // see: https://github.com/mscdex/ssh2#connection-methods
  host: 'staging.example.com',
  username: 'pstadler',
  agent: process.env.SSH_AUTH_SOCK
});

// run with `fly production`
plan.target('production', [
  {
    host: 'www1.example.com',
    username: 'pstadler',
    agent: process.env.SSH_AUTH_SOCK
  },
  {
    host: 'www2.example.com',
    username: 'pstadler',
    agent: process.env.SSH_AUTH_SOCK
  }
]);

// run with `fly dynamic-hosts`
plan.target('dynamic-hosts', function(done, runtime) {
  var AWS = require('aws-sdk');
  AWS.config.update({accessKeyId: '...', secretAccessKey: '...'});
  var ec2 = new AWS.EC2();
  var params = {Filters: [{Name: 'instance-state-name', Values: ['running']}]};
  ec2.describeInstances(params, function(err, response) {
    if(err) {
      return done(err);
    }
    var hosts = [];
    response.data.Reservations.forEach(function(reservation) {
      reservation.Instances.forEach(function(instance) {
        hosts.push({
          host: instance.PublicIpAddress,
          username: 'pstadler',
          agent: process.env.SSH_AUTH_SOCK
        });
      });
    });
    done(hosts);
  });
});
```

Usually flightplan will abort when a host is not reachable or authentication
fails. This can be prevented by setting a property `failsafe` to `true` on
any of the host configurations:

```javascript
plan.target('production', [
  {
    host: 'www1.example.com',
    username: 'pstadler',
    agent: process.env.SSH_AUTH_SOCK
  },
  {
    host: 'www2.example.com',
    username: 'pstadler',
    agent: process.env.SSH_AUTH_SOCK,
    failsafe: true // continue flightplan even if connection to www2 fails
  }
]);
```

You can override the `username` value of hosts by calling `fly` with
the `-u|--username` option:

```bash
fly production --username=admin
```

#### Configuring remote hosts during runtime (e.g. using AWS/EC2)

Instead of having a static hosts configuration for a target you can configure
it on the fly by passing a function `fn(done)` as the second argument to
`target()`.

This function is exectued at the very beginning. Whatever is passed to
`done()` will be used for connecting to remote hosts. This can either be an
object or an array of objects depending on if you want to connect to one or
multiple hosts. Passing an `Error` object will immediately abort the current
flightplan.

```javascript
plan.target('dynamic-hosts', function(done, runtime) {
  var AWS = require('aws-sdk');
  AWS.config.update({accessKeyId: '...', secretAccessKey: '...'});
  var ec2 = new AWS.EC2();
  var params = {Filters: [{Name: 'instance-state-name', Values: ['running']}]};
  ec2.describeInstances(params, function(err, response) {
    if(err) {
      return done(err);
    }
    var hosts = [];
    response.data.Reservations.forEach(function(reservation) {
      reservation.Instances.forEach(function(instance) {
        hosts.push({
          host: instance.PublicIpAddress,
          username: 'pstadler',
          agent: process.env.SSH_AUTH_SOCK
        });
      });
    });
    done(hosts);
  });
});
```

#### Defining and using properties depending on the target

`target()` takes an optional third argument to define properties used by
this target. Values defined in this way can be accessed during runtime.

```javascript
plan.target('staging', {...}, {
  webRoot: '/usr/local/www',
  sudoUser: 'www'
});

plan.target('production', {...}, {
  webRoot: '/home/node',
  sudoUser: 'node'
});

plan.remote(function(remote) {
  var webRoot = plan.runtime.options.webRoot;   // fly staging -> '/usr/local/www'
  var sudoUser = plan.runtime.options.sudoUser; // fly staging -> 'www'
  remote.sudo('ls -al ' + webRoot, {user: sudoUser});
});
```

Properties can be set and overwritten by passing them as named options to the
 `fly` command.

```bash
$ fly staging --sudoUser=foo
# plan.runtime.options.sudoUser -> 'foo'
```

### flightplan.local([tasks, ]fn) → this

Calling this method registers a local flight. Local flights are
executed on your localhost. When `fn` gets called a `Transport` object
is passed with the first argument.

```javascript
plan.local(function(local) {
  local.echo('hello from your localhost.');
});
```

An optional first parameter of type Array or String can be passed for
defining the flight's task(s).

### flightplan.remote([tasks, ]fn) → this

Register a remote flight. Remote flights are executed on the current
target's remote hosts defined with `target()`. When `fn` gets called
a `Transport` object is passed with the first argument.

```javascript
plan.remote(function(remote) {
  remote.echo('hello from the remote host.');
});
```

An optional first parameter of type Array or String can be passed for
defining the flight's task(s).

### flightplan.abort([message])

Manually abort the current flightplan and prevent any further commands and
flights from being executed. An optional message can be passed which
is displayed after the flight has been aborted.

```javascript
plan.abort('Severe turbulences over the atlantic ocean!');
```

<!-- End ../lib/index.js -->

<!-- Start ../lib/transport/index.js -->

## Transport

A transport is the interface you use during flights. Basically they
offer you a set of methods to execute a chain of commands. Depending on the
type of flight, this is either a `Shell` object for local
flights, or an `SSH` for remote flights. Both transports
expose the same set of methods as described in this section.

```javascript
plan.local(function(local) {
  local.echo('Shell.echo() called');
});

plan.remote(function(remote) {
  remote.echo('SSH.echo() called');
});
```

We call the Transport object `transport` in the following section to avoid
confusion. However, do yourself a favor and use `local` for local, and
`remote` for remote flights.

#### Accessing runtime information

Flightplan provides information during flights with the `runtime` properties:

```javascript
plan.remote(function(transport) { // applies to local flights as well
  // Flightplan specific information
  console.log(plan.runtime.task);    // 'default'
  console.log(plan.runtime.target);  // 'production'
  console.log(plan.runtime.hosts);   // [{ host: 'www1.example.com', port: 22 }, ...]
  console.log(plan.runtime.options); // { debug: true, ... }

  // Flight specific information
  console.log(transport.runtime); // { host: 'www1.example.com', port: 22 }
});
```

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
var result = transport.echo('Hello world');
console.log(result); // { code: 0, stdout: 'Hello world\n', stderr: null }
```

#### Advanced options
Flightplan uses `child_process#exec()` for executing local commands and
`mscdex/ssh2#exec()` for remote commands. Options passed with `exec` will
be forwarded to either of these functions.

```javascript
// increase maxBuffer for child_process#exec()
local.ls('-al', {exec: {maxBuffer: 2000*1024}});

// enable pty for mscdex/ssh2#exec()
remote.ls('-al', {exec: {pty: true}});
```

### transport.sudo(command[, options]) → code: int, stdout: String, stderr: String

Execute a command as another user with `sudo()`. It has the same
signature as `exec()`. Per default, the user under which the command
will be executed is "root". This can be changed by passing
`user: "name"` with the second argument:

```javascript
// will run: echo 'echo Hello world' | sudo -u root -i bash
transport.sudo('echo Hello world');

// will run echo 'echo Hello world' | sudo -u www -i bash
transport.sudo('echo Hello world', {user: 'www'});

// further options passed (see `exec()`)
transport.sudo('echo Hello world', {user: 'www', silent: true, failsafe: true});
```

Flightplan's `sudo()` requires a certain setup on your host. In order to
make things work on a typical Ubuntu installation, follow these rules:

```bash
# Scenario:
# 'pstadler' is the user for connecting to the host and 'www' is the user
# under which you want to execute commands with sudo.

# 1. 'pstadler' has to be in the sudo group:
$ groups pstadler
pstadler : pstadler sudo

# 2. 'pstadler' needs to be able to run sudo -u 'www' without a password.
# In order to do this, add the following line to /etc/sudoers:
pstadler ALL=(www) NOPASSWD: ALL

# 3. user 'www' needs to have a login shell (e.g. bash, sh, zsh, ...)
$ cat /etc/passwd | grep www
www:x:1002:1002::/home/www:/bin/bash   # GOOD
www:x:1002:1002::/home/www:/bin/false  # BAD
```

### transport.transfer(files, remoteDir[, options]) → [results]

Copy a list of files to the current target's remote host(s) using
`rsync` with the SSH protocol. File transfers are executed in parallel.
 After finishing all transfers, an array containing results from
`transport.exec()` is returned. This method is only available on local
flights.

```javascript
var files = ['path/to/file1', 'path/to/file2'];
local.transfer(files, '/tmp/foo');
```

#### Files argument
To make things more comfortable, the `files` argument doesn't have to be
passed as an array. Results from previous commands and zero-terminated
strings are handled as well:

```javascript
// use result from a previous command
var files = local.git('ls-files', {silent: true}); // get list of files under version control
local.transfer(files, '/tmp/foo');

// use zero-terminated result from a previous command
var files = local.exec('(git ls-files -z;find node_modules -type f -print0)', {silent: true});
local.transfer(files, '/tmp/foo');

// use results from multiple commands
var result1 = local.git('ls-files', {silent: true}).stdout.split('\n');
var result2 = local.find('node_modules -type f', {silent: true}).stdout.split('\n');
var files = result1.concat(result2);
files.push('path/to/another/file');
local.transfer(files, '/tmp/foo');
```

`transfer()` will use the current host's username defined with
`target()` unless `fly` is called with the `-u|--username` option.
In this case the latter will be used. If debugging is enabled
(either with `target()` or with `fly --debug`), `rsync` is executed
in verbose mode (`-vv`).

### transport.prompt(message[, options]) → input

Prompt for user input.

```javascript
var input = transport.prompt('Are you sure you want to continue? [yes]');
if(input.indexOf('yes') === -1) {
  plan.abort('User canceled flight');
}

// prompt for password (with UNIX-style hidden input)
var password = transport.prompt('Enter your password:', { hidden: true });

// prompt when deploying to a specific target
if(plan.runtime.target === 'production') {
  var input = transport.prompt('Ready for deploying to production? [yes]');
  if(input.indexOf('yes') === -1) {
    plan.abort('User canceled flight');
  }
}
```

### transport.waitFor(fn(done)) → {} mixed

Execute a function and return after the callback `done` is called.
This is used for running asynchronous functions in a synchronous way.

The callback takes an optional argument which is then returned by
`waitFor()`.

```javascript
var result = transport.waitFor(function(done) {
  require('node-notifier').notify({
      message: 'Hello World'
    }, function(err, response) {
      done(err || 'sent!');
    });
});
console.log(result); // 'sent!'
```

### transport.with(command|options[, options], fn)

Execute commands with a certain context.

```javascript
transport.with('cd /tmp', function() {
  transport.ls('-al'); // 'cd /tmp && ls -al'
});

transport.with({silent: true, failsafe: true}, function() {
  transport.ls('-al'); // output suppressed, fail safely
});

transport.with('cd /tmp', {silent: true}, function() {
  transport.ls('-al'); // 'cd /tmp && ls -al', output suppressed
});
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
Output of commands will be printed to stdout.

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
transport.log('Previous command failed, but flight was not aborted');
```

### transport.unsafe()

Calling `unsafe()` reverts the behavior introduced with `failsafe()`.
The flight will be aborted if a subsequent command fails (i.e. returns
a non-zero exit code). This is the default behavior.

```javascript
transport.failsafe();
transport.ls('foo'); // ls: foo: No such file or directory
transport.log('Previous command failed, but flight was not aborted');
transport.unsafe();
transport.ls('foo'); // ls: foo: No such file or directory
// flight aborted
```

### transport.log(message)

Print a message to stdout. Flightplan takes care that the message
is formatted correctly within the current context.

```javascript
transport.log('Copying files to remote hosts');
```

### transport.debug(message)

Print a debug message to stdout if debug mode is enabled. Flightplan
takes care that the message is formatted correctly within the current
context.

```javascript
transport.debug('Copying files to remote hosts');
```

<!-- End ../lib/transport/index.js -->

<!-- ENDDOCS -->

[npm-url]: https://npmjs.com/package/flightplan
[npm-version-image]: https://img.shields.io/npm/v/flightplan.svg?style=flat-square
[npm-downloads-image]: https://img.shields.io/npm/dm/flightplan.svg?style=flat-square

[dependencies-url]: https://david-dm.org/pstadler/flightplan
[dependencies-image]: https://david-dm.org/pstadler/flightplan.svg?style=flat-square

[build-status-url]: https://travis-ci.org/pstadler/flightplan
[build-status-image]: https://img.shields.io/travis/pstadler/flightplan/master.svg?style=flat-square

[coverage-url]: https://coveralls.io/github/pstadler/flightplan?branch=master
[coverage-image]: https://img.shields.io/coveralls/pstadler/flightplan/master.svg?style=flat-square
