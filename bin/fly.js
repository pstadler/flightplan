#!/usr/bin/env node

var Liftoff = require('liftoff')
  , interpret = require('interpret')
  , v8flags = require('v8flags')
  , semver = require('semver')
  , cliPackage = require('../package')
  , nopt = require('nopt')
  , format = require('util').format;

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
  't': ['--targets'],
  'T': ['--tasks'],
  'v': ['--version'],
  'h': ['--help']
};

var options = nopt(knownOptions, shortHands, process.argv, 2);

if(options.help) {
  process.stdout.write(
    '\n' +
    '  Usage: fly [task:]target [options]\n\n' +
    '  Options:\n\n' +
    '    -f, --flightplan <file>  path to flightplan\n' +
    '    -u, --username <name>    user for connecting to remote hosts\n' +
    '    -d, --debug              enable debug mode\n' +
    '    -C, --no-color           disable color output\n' +
    '    -t, --targets            output available targets\n' +
    '    -T, --tasks              output available tasks\n' +
    '    -v, --version            output the version number\n' +
    '    -h, --help               output usage information\n' +
    '\n'
  );
  process.exit(1);
}

if(options.version) {
  process.stdout.write(format('%s\n', cliPackage.version));
  process.exit(1);
}

var task;
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
  process.stderr.write(format('Error: Unable to load module "%s"\n', name));
  process.exit(1);
});

var invoke = function(env) {

  if(!env.configPath) {
    process.stderr.write(format('Error: %s not found\n', (options.flightplan || 'flightplan.js')));
    process.exit(1);
  }

  if(!env.modulePath) {
    process.stderr.write(format('Error: Local flightplan package not found in %s\n', env.cwd));
    process.exit(1);
  }

  if(!semver.satisfies(env.modulePackage.version, '>=0.5.0')) {
    process.stderr.write('Error: local flightplan package version should be >=0.5.0\n');
    process.exit(1);
  }

  process.chdir(env.configBase);

  require(env.configPath); // eslint-disable-line global-require
  var instance = require(env.modulePath); // eslint-disable-line global-require

  if(options.targets) {
    process.stdout.write(
      'Available targets:\n' +
      '  ' + instance.availableTargets().join('\n  ') + '\n'
    );

    process.exit(0);
  }

  if(options.tasks) {
    process.stdout.write(
      'Available tasks:\n' +
      '  ' + instance.availableTasks().join('\n  ') + '\n'
    );

    process.exit(0);
  }

  if(!target) {
    process.stderr.write(
      'Error: No target specified. Use `--help` for more information\n\n' +
      'Available targets:\n' +
      '  ' + instance.availableTargets().join('\n  ') + '\n'
    );

    process.exit(1);
  }

  instance.run(task, target, options);
};

cli.launch({
  configPath: options.flightplan
}, invoke);
