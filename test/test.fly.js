var execSync = require('child_process').execSync
  , expect = require('chai').expect
  , currentVersion = require('../package.json').version;

function exec(args) {
  var result = execSync('./bin/fly.js ' + args + ' + 2>&1; exit 0', { encoding: 'utf8' });
  return result;
}

describe('fly', function() {

  describe('<noargs>', function() {
    it('should complain about missing flightplan.js', function() {
      expect(exec()).to.match(/Error: .* not found/);
    });
  });

  describe('--version', function() {
    it('should display correct version', function() {
      expect(exec('--version')).to.contain(currentVersion);
      expect(exec('-v')).to.contain(currentVersion);
    });
  });

  describe('--help', function() {
    it('should display help text', function() {
      expect(exec('--help')).to.contain('Usage: fly [task:]target [options]');
      expect(exec('-h')).to.contain('Usage: fly [task:]target [options]');
    });
  });

  describe('--flightplan=foo.js', function() {
    it('should complain about missing foo.js', function() {
      expect(exec('--flightplan=foo.js')).to.contain('foo.js not found');
      expect(exec('-f foo.js')).to.contain('foo.js not found');
    });
  });

});