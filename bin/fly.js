#!/usr/bin/env node

var Liftoff = require('liftoff')
  , v8flags = require('v8flags')
  , semver = require('semver')
  , extend = require('util-extend')
  , cliPackage = require('../package')
  , logger = require('../lib/logger')()
  , argv = require('minimist')(process.argv.slice(2));

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

var argumentAliases = {
  file:     ['f', 'flightplan'],
  username: ['u', 'username'],
  debug:    ['d', 'debug'],
  version:  ['v', 'version'],
  help:     ['h', 'help'],
  color:    ['no-color']
};

function parseArgs(argv) {
  var parsedArgs = {
    positional: [],
    named: {}
  };

  parsedArgs.positional = argv._;
  delete argv._;

  Object.keys(argumentAliases).forEach(function(opt) {
    argumentAliases[opt].forEach(function(alias) {
      if(argv[alias]) {
        parsedArgs.named[opt] = argv[alias];
        delete argv[alias];
      }
    });
  });

  parsedArgs.named = extend(argv, parsedArgs.named);

  return parsedArgs;
}

var args = parseArgs(argv);

var task = 'default';
var target = args.positional.length ? args.positional[0] : null;

if(target && target.indexOf(':') !== -1) {
  target = target.split(':');
  task = target[0];
  target = target[1];
}

if(args.named.help) {
  var out = '\n' +
    '  Usage: fly [task:]target [options]\n\n' +
    '  Options:\n\n'  +
    '    -h, --help               show usage information\n' +
    '    -v, --version            show version number\n' +
    '    -f, --flightplan <file>  path to flightplan (default: flightplan.js)\n' +
    '    -u, --username <string>  user for connecting to remote hosts\n' +
    '    -d, --debug              enable debug mode\n' +
    '        --no-color           disable colors in output\n';
  console.log(out);
  process.exit(0);
}

if(args.named.version) {
  console.log(cliPackage.version);
  process.exit(0);
}

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
  instance.run(task, target, args.named);
};

cli.launch({
  configPath: args.named.file
}, invoke);