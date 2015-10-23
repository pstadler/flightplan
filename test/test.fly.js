var spawnSync = require('child_process').spawnSync
  , expect = require('chai').expect
  , currentVersion = require('../package.json').version;

var COVERAGE_COUNT = 0;

function exec(args) {
  var cmdPrefix = process.env.running_under_istanbul
    ? './node_modules/.bin/istanbul cover --dir coverage/fly/' + (COVERAGE_COUNT++) +
      ' --report lcovonly --print none '
    : '';
  var argsSeparator = process.env.running_under_istanbul
    ? ' -- '
    : ' ';

  args = cmdPrefix + './bin/fly.js' + argsSeparator + args;
  args = args.split(' ');
  var command = args.shift();

  var result = spawnSync(command, args, { encoding: 'utf8' });
  return result;
}

describe('fly', function() {

  describe('<noargs>', function() {
    it('should complain about missing flightplan.js', function() {
      expect(exec().stderr).to.match(/Error: .* not found/);
      expect(exec('test').stderr).to.match(/Error: .* not found/);
    });
  });

  describe('--version', function() {
    it('should display correct version', function() {
      expect(exec('--version').stdout).to.contain(currentVersion);
      expect(exec('-v').stdout).to.contain(currentVersion);
    });
  });

  describe('--help', function() {
    it('should display help text', function() {
      expect(exec('--help').stdout).to.contain('Usage:');
      expect(exec('-h').stdout).to.contain('Usage:');
    });
  });

  describe('--flightplan=<file>', function() {
    it('should handle --flightplan', function() {
      expect(exec('--flightplan=test/fixtures/flightplan.js test').stdout)
        .to.contain('no work to be done for task');
    });

    it('should handle -f', function() {
      expect(exec('-f test/fixtures/flightplan.js test').stdout)
        .to.contain('no work to be done for task');
    });

    it('should complain about missing file', function() {
      expect(exec('--flightplan=foo.js').stderr).to.contain('foo.js not found');
    });

    it('should fail when <module>/register is not available', function() {
      expect(exec('--flightplan=test/fixtures/empty.coffee').stderr)
        .to.contain('Unable to load module "coffee-script/register"');
    });

  });

});