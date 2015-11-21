var expect = require('chai').expect
  , proxyquire = require('proxyquire')
  , sinon = require('sinon')
  , runWithinFiber = require('./utils/run-within-fiber')
  , childProcess = require('child_process')
  , errors = require('../lib/errors');

describe('transport/shell', function() {

  var LOGGER_STUB = {
    command: sinon.stub(),
    success: sinon.stub(),
    warn: sinon.stub(),
    error: sinon.stub(),
    stdout: sinon.stub(),
    stdwarn: sinon.stub(),
    stderr: sinon.stub()
  };

  var CHILD_PROCESS_SPY = sinon.spy(childProcess, 'exec');

  var Transport = proxyquire('../lib/transport', {
    '../logger': function() { return LOGGER_STUB; },
    'child_process': { exec: CHILD_PROCESS_SPY }
  });

  var MOCKS = {
    './index': Transport
  };

  var CONTEXT = {
    options: { debug: true },
    remote: { host: 'localhost' }
  };

  var Shell;

  beforeEach(function() {
    Shell = proxyquire('../lib/transport/shell', MOCKS);
  });

  afterEach(function() {
    Object.keys(LOGGER_STUB).forEach(function(k) {
      LOGGER_STUB[k].reset();
    });

    CHILD_PROCESS_SPY.reset();
  });

  describe('initialize', function() {
    it('should inherit from Transport', function() {
      var shell = new Shell(CONTEXT);

      expect(shell).to.be.instanceof(Transport);
    });

    it('should call the super constructor', function() {
      var SUPER_CALL_STUB = sinon.stub(Shell.super_, 'call');
      var shell = new Shell(CONTEXT);

      expect(SUPER_CALL_STUB.calledOnce).to.be.true;
      expect(SUPER_CALL_STUB.lastCall.args).to.deep.equal([
        shell,
        CONTEXT
      ]);

      SUPER_CALL_STUB.restore();
    });
  });

  describe('#_exec()', function() {
    it('should execute a command', function(testDone) {
      runWithinFiber(function() {
        var shell = new Shell(CONTEXT);
        var result = shell._exec('echo "hello world"');

        expect(result).to.deep.equal({
          code: 0,
          stdout: 'hello world\n',
          stderr: null
        });

        expect(LOGGER_STUB.command.calledOnce).to.be.true;
        expect(LOGGER_STUB.command.lastCall.args[0]).to.contain('echo "hello world"');
        expect(LOGGER_STUB.stdout.lastCall.args[0]).to.contain('hello world');
        expect(LOGGER_STUB.success.lastCall.args[0]).to.contain('ok');

        testDone();
      });
    });

    it('should correctly handle the silent option', function(testDone) {
      runWithinFiber(function() {
        var shell = new Shell(CONTEXT);
        var result = shell._exec('echo "silent world"', { silent: true });

        expect(result).to.deep.equal({
          code: 0,
          stdout: 'silent world\n',
          stderr: null
        });

        expect(LOGGER_STUB.command.calledOnce).to.be.true;
        expect(LOGGER_STUB.command.lastCall.args[0]).to.contain('echo "silent world"');
        expect(LOGGER_STUB.stdout.notCalled).to.be.true;
        expect(LOGGER_STUB.success.lastCall.args[0]).to.contain('ok');

        testDone();
      });
    });

    it('should correctly handle the failsafe option', function(testDone) {
      runWithinFiber(function() {
        var shell = new Shell(CONTEXT);
        var result = shell._exec('invalid-command', { failsafe: true });

        expect(result).to.deep.equal({
          code: 127,
          stdout: null,
          stderr: '/bin/sh: invalid-command: command not found\n'
        });

        expect(LOGGER_STUB.command.calledOnce).to.be.true;
        expect(LOGGER_STUB.command.lastCall.args[0]).to.contain('invalid-command');
        expect(LOGGER_STUB.stdwarn.calledOnce).to.be.true;
        expect(LOGGER_STUB.stdwarn.lastCall.args[0]).to.contain('command not found');
        expect(LOGGER_STUB.warn.lastCall.args[0]).to.contain('failed safely');

        testDone();
      });
    });

    it('should throw when a command fails', function(testDone) {
      runWithinFiber(function() {
        var shell = new Shell(CONTEXT);

        expect(function() {
          shell._exec('invalid-command');
        }).to.throw(errors.CommandExitedAbnormallyError, 'exited abnormally');

        expect(LOGGER_STUB.command.calledOnce).to.be.true;
        expect(LOGGER_STUB.command.lastCall.args[0]).to.contain('invalid-command');
        expect(LOGGER_STUB.stderr.calledOnce).to.be.true;
        expect(LOGGER_STUB.stderr.lastCall.args[0]).to.contain('command not found');
        expect(LOGGER_STUB.error.lastCall.args[0]).to.contain('failed');

        testDone();
      });
    });

    it('should handle `exec` options', function(testDone) {
      var EXEC_OPTIONS = { maxBuffer: 1337, 'some-option': 'some-value' };

      runWithinFiber(function() {
        var shell = new Shell(CONTEXT);

        shell._exec('echo "test"', { exec: EXEC_OPTIONS });

        expect(CHILD_PROCESS_SPY.calledOnce).to.be.true;
        expect(CHILD_PROCESS_SPY.lastCall.args[1]).to.deep.equal(EXEC_OPTIONS);

        testDone();
      });
    });

    it('should use a sane default `maxBuffer` size', function(testDone) {
      runWithinFiber(function() {

        var shell = new Shell(CONTEXT);

        shell._exec('echo "test"');

        expect(CHILD_PROCESS_SPY.calledOnce).to.be.true;
        expect(CHILD_PROCESS_SPY.lastCall.args[1].maxBuffer).to.equal(1000 * 1024);

        testDone();
      });
    });
  });

});
