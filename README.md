# Flightplan ✈ [![NPM version][npm-image]][npm-url]

Run a sequence of commands against local and remote hosts.

Flightplan ~~is~~ *will be* a feature complete [node.js](http://nodejs.org) library for streamlining application deployment or systems administration tasks, similar to Python's [Fabric](http://fabfile.org).

**What's in the works?**

- Documentation
- Tests
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
	remote.sudo('ln -sf ~/' + tmpDir + ' ~/pstadler-sh', { user: 'www' });
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

// always executed
plan.debriefing(function() {
});
```

[npm-url]: https://npmjs.org/package/flightplan
[npm-image]: https://badge.fury.io/js/flightplan.png