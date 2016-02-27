var expect = require('chai').expect
  , proxyquire = require('proxyquire')
  , sinon = require('sinon')
  , path = require('path')
  , exec = require('./utils/exec')
  , currentVersion = require('../package.json').version;

describe('fly', function() {

  describe('<noargs>', function() {
    it('should complain about missing flightplan.js', function() {
      expect(exec().stderr).to.match(/Error: .* not found/);
      expect(exec('test').stderr).to.match(/Error: .* not found/);
    });

    it('should complain about missing target', function() {
      expect(exec('--flightplan=test/fixtures/flightplan.js').stderr)
        .to.contain('Error: No target specified')
        .to.match(/Available targets[\s\S]*test/);
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

  describe('--targets', function() {
    it('should display targets', function() {
      expect(exec('-f test/fixtures/flightplan.js --targets').stdout)
        .to.match(/Available targets[\s\S]*test/);
      expect(exec('-f test/fixtures/flightplan.js -t').stdout)
        .to.match(/Available targets[\s\S]*test/);
    });
  });

  describe('--tasks', function() {
    it('should display tasks', function() {
      expect(exec('-f test/fixtures/flightplan.js --tasks').stdout)
        .to.match(/Available tasks[\s\S]*default/);
      expect(exec('-f test/fixtures/flightplan.js -T').stdout)
        .to.match(/Available tasks[\s\S]*default/);
    });
  });

  describe('--flightplan', function() {
    it('should handle --flightplan', function() {
      expect(exec('--flightplan=test/fixtures/flightplan.js test').stdout)
        .to.contain('Flightplan finished');
    });

    it('should handle -f', function() {
      expect(exec('-f test/fixtures/flightplan.js test').stdout)
        .to.contain('Flightplan finished');
    });

    it('should handle <task>:<target>', function() {
      expect(exec('-f test/fixtures/flightplan.js foo:test').stdout)
        .to.match(/no work to be done for task .*foo/);
    });

    it('should complain about missing file', function() {
      expect(exec('--flightplan=foo.js').stderr).to.contain('foo.js not found');
    });

    it('should fail when <module>/register is not available', function() {
      expect(exec('--flightplan=test/fixtures/empty.ts').stderr)
        .to.match(/Unable to load module ".*\/register"/);
    });
  });

  describe('invocation', function() {
    it('should pass arguments to flightplan', function(testDone) {
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

        testDone();
      });

      process.argv = restoreProcessArgv;
    });
  });

});
