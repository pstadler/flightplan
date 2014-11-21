#!/usr/bin/env node

var Liftoff = require('liftoff')
  , v8flags = require('v8flags')
  , semver = require('semver')
  , extend = require('util-extend')
  , cliPackage = require('../package')
  , logger = require('../lib/logger')()
  , yargs = require('yargs');

var argv = yargs
  .usage('Usage: $0 [task:]destination [options]')
  .help('help').alias('help', 'h')
  .version(cliPackage.version, 'version').alias('version', 'v')
  .options('flightplan', {
    alias: 'f',
    //default: 'flightplan.js',
    describe: 'path to flightplan'
  })
  .options('username', {
    alias: 'u',
    describe: 'user for connecting to remote hosts'
  })
  .options('debug', {
    alias: 'd',
    describe: 'enable debug mode'
  })
  .options('no-color', {
    alias: 'C',
    describe: 'disable colors in output'
  }).argv;

var task = 'default';
var target = argv._ ? argv._[0] : null;

if(target && target.indexOf(':') !== -1) {
  target = target.split(':');
  task = target[0];
  target = target[1];
}

var cli = new Liftoff({
  name: 'flightplan',
  processTitle: 'Flightplan',
  configName: 'flightplan',
  extensions: {
    '.js': null,
    '.coffee': 'coffee-script/register'
  },
  nodeFlags: v8flags.fetch()
});

var invoke = function(env) {
  if(!target) {
    logger.error('Error: No target specified');
    process.exit(1);
  }

  if(!env.configPath) {
    logger.error('Error: flightplan.js not found');
    process.exit(1);
  }

  if(!env.modulePath) {
    logger.error('Error: Local flightplan package not found in ' + env.cwd);
    process.exit(1);
  }

  if(!semver.satisfies(env.modulePackage.version, '>=0.5.0')) {
    logger.error('Error: local flightplan package version should be >=0.5.0');
    process.exit(1);
  }

  process.chdir(env.configBase);
  require(env.configPath);
  var instance = require(env.modulePath);
  instance.run(task, target, argv);
};

cli.launch({
  configPath: argv.flightplan
}, invoke);