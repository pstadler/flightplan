#!/usr/bin/env node

var path = require('path')
	, fs = require('fs')
	, ArgumentParser = require('argparse').ArgumentParser
	, logger = new (require('../lib/logger'))()
	, version = require('../package.json').version;

var parser = new ArgumentParser({
	prog: 'fly',
	description: 'Run a flightplan.',
	version: version,
	addHelp:  true
});

parser.addArgument(
	['destination'],
	{
		help: 'Name of destination.'
	}
);
parser.addArgument(
	['--plan', '-p'],
	{
		help: 'Path to flightplan.',
		defaultValue: 'flightplan.js',
		dest: 'file'
	}
);
parser.addArgument(
	['--user', '--username', '-u'],
	{
		help: 'User for connecting to remote hosts.',
		defaultValue: null,
		dest: 'username'
	}
);
parser.addArgument(
	['--debug', '-d'],
	{
		help: 'Enabled debugging.',
		action: 'storeConst',
		constant: true
	}
);

var args = parser.parseArgs()
	, flightFile = path.join(process.cwd(), args.file);

if(!fs.existsSync(flightFile)) {
	logger.error(logger.format('Unable to load %s', args.file.white));
    process.exit(1);
}

var flightplan = require(flightFile)
	, options = {
		username: args.username || null,
		debug: args.debug
	};

if(!flightplan.start) {
	logger.error(logger.format('%s is not a valid flightplan', args.file.white));
	process.exit(1);
}

flightplan.start(args.destination, options);