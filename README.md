# Flightplan ✈ [![NPM version][npm-image]][npm-url]

Run a sequence of commands against local and remote hosts.

Flightplan ~~is~~ *will be* a feature complete [node.js](http://nodejs.org) library for streamlining application deployment or systems administration tasks, similar to Python's [Fabric](http://fabfile.org).

**What's in the works?**

- Documentation
- Tests
- Catch errors in fibers
- Handlers for `uncaughtException` and `SIGINT`
- Simple interface for file transport to remote hosts (e.g. `rsync`)
- Interactive session for remote hosts (e.g. to enter password / passphrase)

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

var plan = new Flightplan();
plan.briefing({
	debug: false,
	destinations: {
		'test': [{
			// See: https://github.com/mscdex/ssh2#connection-methods
			host: 'pstadler.sh',
			username: 'pstadler',
			privateKey: require('fs').readFileSync('/Users/pstadler/.ssh/id_rsa')
		}]
	}
});

// run commands on localhost
plan.domestic(function(local) {
});

// run commands on remote hosts (destinations)
plan.international(function(remote) {
});

// run more commands on localhost
plan.domestic(function(local) {
});

// executed if flightplan succeeded
plan.success(function() {
});

// executed if flightplan failed
plan.disaster(function() {
});

// always executed
plan.debriefing(function() {
});
```

[npm-url]: https://npmjs.org/package/flightplan
[npm-image]: https://badge.fury.io/js/flightplan.png