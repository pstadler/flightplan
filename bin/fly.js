#!/usr/bin/env node
var path = require('path')
	, fs = require('fs')
	, program = require('commander')
	, logger = new (require('../lib/logger'))()
	, version = require('../package.json').version;

program
	.usage('<destination> [options]')
	.version(version)
	.option('-p, --plan <file>', 'path to flightplan (default: flightplan.js)', 'flightplan.js')
	.option('-u, --username <string>', 'user for connecting to remote hosts')
	.option('-d, --debug', 'enable debug mode')
	.parse(process.argv);

var flightFile = path.join(process.cwd(), program.plan);

if(!fs.existsSync(flightFile)) {
	logger.error(logger.format('Unable to load %s', program.plan.white));
	process.exit(1);
}

var flightplan = require(flightFile)
	, options = {
		username: program.username || null,
		debug: program.debug || null
	};

var destination = program.args[0];

if(!flightplan.requiresDestination) {
	logger.error(logger.format('%s is not a valid flightplan', program.plan.white));
	process.exit(1);
}

if(!destination && flightplan.requiresDestination()) {
	logger.error('Please specfiy a destination');
	program.help();
	process.exit(1);
}

flightplan.start(destination, options);