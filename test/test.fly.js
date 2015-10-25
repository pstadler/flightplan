var spawnSync = require('child_process').spawnSync
  , path = require('path')
  , proxyquire = require('proxyquire')
  , sinon = require('sinon')
  , expect = require('chai').expect
  , currentVersion = require('../package.json').version;

var EXEC_COUNT = 0;

function exec(args) {
  var cmdPrefix = process.env.running_under_istanbul
    ? './node_modules/.bin/istanbul cover --dir coverage/fly/' + (EXEC_COUNT++) +
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

    it('should complain about missing target', function() {
      expect(exec('--flightplan=test/fixtures/flightplan.js').stderr)
        .to.contain('Error: No target specified');
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

    it('should handle <task>:<target>', function() {
      expect(exec('-f test/fixtures/flightplan.js foo:test').stdout)
        .to.match(/no work to be done for task .*foo/);
    });

    it('should complain about missing file', function() {
      expect(exec('--flightplan=foo.js').stderr).to.contain('foo.js not found');
    });

    it('should fail when <module>/register is not available', function() {
      expect(exec('--flightplan=test/fixtures/empty.coffee').stderr)
        .to.contain('Unable to load module "coffee-script/register"');
    });
  });

  describe('invocation', function() {
    it('should pass arguments to flightplan', function(done) {
      var restoreProcessArgv = process.argv
        , runSpy = sinon.spy()
        , MOCKS = {};

      process.argv = [
        'node', 'fly',
        '--flightplan=test/fixtures/flightplan.js',
        '--username=testuser',
        '--no-color',
        '-d',
        '--custom-var=custom',
        'task:target'
      ];

      MOCKS[path.resolve(__dirname, '..', 'index.js')] = {
        run: runSpy
      };

      proxyquire('../bin/fly.js', MOCKS);
      // wait a cycle until invoke was called
      setImmediate(function() {
        expect(runSpy.calledOnce).to.be.true;

        var args = runSpy.lastCall.args;
        expect(args[0]).to.equal('task');
        expect(args[1]).to.equal('target');
        expect(args[2]).to.have.property('flightplan', 'test/fixtures/flightplan.js');
        expect(args[2]).to.have.property('username', 'testuser');
        expect(args[2]).to.have.property('color', false);
        expect(args[2]).to.have.property('debug', true);
        expect(args[2]).to.have.property('custom-var', 'custom');
        done();
      });

      process.argv = restoreProcessArgv;
    });
  });

});