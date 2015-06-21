#!/usr/bin/env node

var Liftoff = require('liftoff')
  , interpret = require('interpret')
  , v8flags = require('v8flags')
  , semver = require('semver')
  , cliPackage = require('../package')
  , nopt = require('nopt');

var knownOptions = {
  'flightplan': String,
  'username': String,
  'debug': Boolean,
  'color': Boolean,
  'version': Boolean,
  'help': Boolean
};

var shortHands = {
  'f': ['--flightplan'],
  'u': ['--username'],
  'd': ['--debug'],
  'C': ['--no-color'],
  'v': ['--version'],
  'h': ['--help']
};

var options = nopt(knownOptions, shortHands, process.argv, 2);

if(options.help) {
  console.log('\n' +
    '  Usage: fly [task:]target [options]\n\n' +
    '  Options:\n\n' +
    '    -f, --flightplan <file>  path to flightplan\n' +
    '    -u, --username <name>    user for connecting to remote hosts\n' +
    '    -d, --debug              enable debug mode\n' +
    '    -C, --no-color           disable color output\n' +
    '    -v, --version            output the version number\n' +
    '    -h, --help               output usage information\n'
  );
  process.exit(1);
}

if(options.version) {
  console.log(cliPackage.version);
  process.exit(1);
}

var task = 'default';
var target = options.argv.remain.length ? options.argv.remain[0] : null;

if(target && target.indexOf(':') !== -1) {
  target = target.split(':');
  task = target[0];
  target = target[1];
}

var cli = new Liftoff({
  name: 'flightplan',
  processTitle: 'Flightplan',
  configName: 'flightplan',
  extensions: interpret.jsVariants,
  v8flags: v8flags
});

cli.on('requireFail', function(name) {
  console.error("Error: Unable to load module '" + name + "'");
  process.exit(1);
});

var invoke = function(env) {
  if(!target) {
    console.error('Error: No target specified');
    process.exit(1);
  }

  if(!env.configPath) {
    console.error('Error: ' + (options.flightplan || 'flightplan.js') + ' not found');
    process.exit(1);
  }

  if(!env.modulePath) {
    console.error('Error: Local flightplan package not found in ' + env.cwd);
    process.exit(1);
  }

  if(!semver.satisfies(env.modulePackage.version, '>=0.5.0')) {
    console.error('Error: local flightplan package version should be >=0.5.0');
    process.exit(1);
  }

  process.chdir(env.configBase);
  require(env.configPath);
  var instance = require(env.modulePath);
  instance.run(task, target, options);
};

cli.launch({
  configPath: options.flightplan
}, invoke);