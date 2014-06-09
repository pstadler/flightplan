#!/usr/bin/env node
var path = require('path')
  , fs = require('fs')
  , program = require('commander')
  , logger = new (require('../lib/logger'))()
  , version = require('../package.json').version;

program
  .usage('[task:]destination [options]')
  .version(version)
  .option('-p, --plan <file>', 'path to flightplan (default: flightplan.js)', 'flightplan.js')
  .option('-u, --username <string>', 'user for connecting to remote hosts')
  .option('-d, --debug', 'enable debug mode')
  .parse(process.argv);

var flightFile = path.join(process.cwd(), program.plan);

if(!fs.existsSync(flightFile)) {
  if (program.plan === 'flightplan.js') {
    // Maybe using CoffeeScript?
    program.plan = 'flightplan.coffee';
    flightFile = path.join(process.cwd(), program.plan);
    if(!fs.existsSync(flightFile)) {
      logger.error(logger.format('Unable to load %s (js/coffee)', 'flightplan'.white));
      process.exit(1);
    }
  } else {
    logger.error(logger.format('Unable to load %s', program.plan.white));
    process.exit(1);
  }
}

if (flightFile.indexOf('.coffee', flightFile.length-7) !== -1) {
  try {
    // Register the CoffeeScript module loader
    require('coffee-script/register');
  } catch (err) {
    logger.error(err);
    logger.error(logger.format('Unable to load coffee-script for %s', program.plan.white));
    process.exit(1);
  }
}

var flightplan = require(flightFile)
  , options = {
    username: program.username || null,
    debug: program.debug || null
  };

var destination = program.args[0]
  , task = 'default';

if(~(destination || '').indexOf(':')) {
  var arr = destination.split(':');
  task = arr[0];
  destination = arr[1];
}

if(!flightplan.requiresDestination) {
  logger.error(logger.format('%s is not a valid flightplan', program.plan.white));
  process.exit(1);
}

if(!destination && flightplan.requiresDestination()) {
  logger.error('Missing destination. Choose one of the following:');
  console.log('  ' + flightplan.getDestinations().join('\n  ').white);
  process.exit(1);
}

flightplan.start(task, destination, options);