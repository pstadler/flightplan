var expect = require('chai').expect
  , proxyquire = require('proxyquire')
  , sinon = require('sinon')
  , runWithinFiber = require('./utils/run-within-fiber')
  , childProcess = require('child_process')
  , errors = require('../lib/errors')
  , fixtures = require('./fixtures')
  , extend = require('util')._extend;

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
  var WRITE_TEMP_FILE_STUB = sinon.stub().returns('/path/to/tmp/file');

  var Transport = proxyquire('../lib/transport', {
    '../logger': function() { return LOGGER_STUB; },
    'child_process': { exec: CHILD_PROCESS_SPY }
  });

  var MOCKS = {
    './index': Transport,
    '../utils': {
      writeTempFile: WRITE_TEMP_FILE_STUB
    },
    'fs': {
      unlink: function() {}
    }
  };

  var CONTEXT = {
    options: {},
    hosts: fixtures.HOSTS,
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
    WRITE_TEMP_FILE_STUB.reset();
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

    it('should correctly merge options with transport options', function(testDone) {
      runWithinFiber(function() {
        var shell = new Shell(CONTEXT);

        shell.silent();

        shell._exec('echo "hello world"');

        expect(LOGGER_STUB.stdout.notCalled).to.be.true;

        shell._exec('echo "hello world"', { silent: false });

        expect(LOGGER_STUB.stdout.notCalled).to.be.false;

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

        expect(result).to.have.property('code', 127);
        expect(result).to.have.property('stdout', null);
        expect(result).to.have.property('stderr').that.contains('not found');

        expect(LOGGER_STUB.command.calledOnce).to.be.true;
        expect(LOGGER_STUB.command.lastCall.args[0]).to.contain('invalid-command');
        expect(LOGGER_STUB.stdwarn.calledOnce).to.be.true;
        expect(LOGGER_STUB.stdwarn.lastCall.args[0]).to.contain('not found');
        expect(LOGGER_STUB.warn.lastCall.args[0]).to.contain('failed safely');

        testDone();
      });
    });

    it('should throw and stop when a command fails', function(testDone) {
      runWithinFiber(function() {
        var shell = new Shell(CONTEXT);

        expect(function() {
          shell._exec('invalid-command');
          shell._exec('never-called');
        }).to.throw(errors.CommandExitedAbnormallyError, 'exited abnormally');

        expect(LOGGER_STUB.command.calledOnce).to.be.true;
        expect(LOGGER_STUB.command.lastCall.args[0]).to.contain('invalid-command');
        expect(LOGGER_STUB.stderr.calledOnce).to.be.true;
        expect(LOGGER_STUB.stderr.lastCall.args[0]).to.contain('not found');
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

  describe('#transfer()', function() {
    var EXEC_STUB;

    beforeEach(function() {
      EXEC_STUB = sinon.stub(Shell.prototype, '_exec').returns('test');
    });

    afterEach(function() {
      EXEC_STUB.restore();
    });

    it('should upload a single file', function(testDone) {
      runWithinFiber(function() {

        var shell = new Shell(CONTEXT);

        shell.transfer('/path/to/file', '/remote/path');

        expect(WRITE_TEMP_FILE_STUB.calledOnce).to.be.true;
        expect(WRITE_TEMP_FILE_STUB.lastCall.args[0]).to.contain('/path/to/file');
        expect(EXEC_STUB.lastCall.args[0]).to.contain('--files-from /path/to/tmp/file');

        testDone();
      });
    });

    it('should upload an array of files', function(testDone) {
      runWithinFiber(function() {

        var shell = new Shell(CONTEXT);

        shell.transfer(['/path/to/file', '/path/to/another/file'], '/remote/path');

        expect(WRITE_TEMP_FILE_STUB.calledOnce).to.be.true;
        expect(WRITE_TEMP_FILE_STUB.lastCall.args[0]).to.contain('/path/to/file');
        expect(WRITE_TEMP_FILE_STUB.lastCall.args[0]).to.contain('/path/to/another/file');
        expect(EXEC_STUB.lastCall.args[0]).to.contain('--files-from /path/to/tmp/file');

        testDone();
      });
    });

    it('should upload an array of files', function(testDone) {
      runWithinFiber(function() {

        var shell = new Shell(CONTEXT);

        shell.transfer(['/path/to/file', '/path/to/another/file'], '/remote/path');

        expect(WRITE_TEMP_FILE_STUB.calledOnce).to.be.true;
        expect(WRITE_TEMP_FILE_STUB.lastCall.args[0])
          .to.contain('/path/to/file\n/path/to/another/file');
        expect(EXEC_STUB.lastCall.args[0]).to.contain('--files-from /path/to/tmp/file');

        testDone();
      });
    });

    it('should upload a zero-delimited list of files', function(testDone) {
      runWithinFiber(function() {

        var shell = new Shell(CONTEXT);

        shell.transfer(['/path/to/file\0/path/to/another/file'], '/remote/path');

        expect(WRITE_TEMP_FILE_STUB.calledOnce).to.be.true;
        expect(WRITE_TEMP_FILE_STUB.lastCall.args[0])
          .to.contain('/path/to/file\n/path/to/another/file');
        expect(EXEC_STUB.lastCall.args[0]).to.contain('--files-from /path/to/tmp/file');

        testDone();
      });
    });

    it('should upload a newline-delimited list of files', function(testDone) {
      runWithinFiber(function() {

        var shell = new Shell(CONTEXT);

        shell.transfer(['/path/to/file\n/path/to/another/file'], '/remote/path');

        expect(WRITE_TEMP_FILE_STUB.calledOnce).to.be.true;
        expect(WRITE_TEMP_FILE_STUB.lastCall.args[0])
          .to.contain('/path/to/file\n/path/to/another/file');
        expect(EXEC_STUB.lastCall.args[0]).to.contain('--files-from /path/to/tmp/file');

        testDone();
      });
    });

    it('should upload files from the result of a command', function(testDone) {
      runWithinFiber(function() {

        var shell = new Shell(CONTEXT);

        shell.transfer({ stdout: '/path/to/file\n/path/to/another/file' }, '/remote/path');

        expect(WRITE_TEMP_FILE_STUB.calledOnce).to.be.true;
        expect(WRITE_TEMP_FILE_STUB.lastCall.args[0])
          .to.contain('/path/to/file\n/path/to/another/file');
        expect(EXEC_STUB.lastCall.args[0]).to.contain('--files-from /path/to/tmp/file');

        testDone();
      });
    });

    it('should throw when passing an empty file list', function(testDone) {
      runWithinFiber(function() {

        var shell = new Shell(CONTEXT);

        expect(function() {
          shell.transfer('\n', '/remote/path');
        }).to.throw(errors.InvalidArgumentError, 'Empty file list');

        expect(function() {
          shell.transfer([], '/remote/path');
        }).to.throw(errors.InvalidArgumentError, 'Empty file list');

        expect(function() {
          shell.transfer({}, '/remote/path');
        }).to.throw(errors.InvalidArgumentError, 'Invalid object');

        testDone();
      });
    });

    it('should throw when remote path is empty', function(testDone) {
      runWithinFiber(function() {

        var shell = new Shell(CONTEXT);

        expect(function() {
          shell.transfer('/path/to/file');
        }).to.throw(errors.InvalidArgumentError, 'Missing remote path');

        testDone();
      });
    });

    it('should call rsync with the correct flags', function(testDone) {
      runWithinFiber(function() {

        var shell = new Shell(CONTEXT);

        shell.transfer('/path/to/file', '/remote/path');

        expect(EXEC_STUB.calledTwice).to.be.true;
        expect(EXEC_STUB.firstCall.args[0]).to.contain(' -az ');

        var CONTEXT_WITH_DEBUG = extend(CONTEXT, { options: { debug: true }});
        shell = new Shell(CONTEXT_WITH_DEBUG);

        shell.transfer('/path/to/file', '/remote/path');

        expect(EXEC_STUB.lastCall.args[0]).to.contain(' -azvv ');

        testDone();
      });
    });

    it('should use the `username` property of the remote if specified', function(testDone) {
      runWithinFiber(function() {

        var CONTEXT_WITH_USERNAME = {
          options: {},
          remote: { host: 'localhost' },
          hosts: [{
            host: 'example.org',
            username: 'remote-user'
          }]
        };
        var shell = new Shell(CONTEXT_WITH_USERNAME);

        shell.transfer('/path/to/file', '/remote/path');

        expect(EXEC_STUB.lastCall.args[0]).to.contain(' remote-user@example.org:');

        testDone();
      });
    });

    it('should use the path to a private key', function(testDone) {
      runWithinFiber(function() {

        var CONTEXT_WITH_PRIVATE_KEY = {
          options: {},
          remote: { host: 'localhost' },
          hosts: [{
            host: 'example.org',
            privateKey: fixtures.PRIVATE_KEY_PATH
          }]
        };
        var shell = new Shell(CONTEXT_WITH_PRIVATE_KEY);

        shell.transfer('/path/to/file', '/remote/path');

        expect(EXEC_STUB.lastCall.args[0]).to.contain('-i ' + fixtures.PRIVATE_KEY_PATH);

        testDone();
      });
    });

    it('should upload files to multiple remote hosts', function(testDone) {
      runWithinFiber(function() {

        var shell = new Shell(CONTEXT);

        shell.transfer('/path/to/file', '/remote/path');

        expect(EXEC_STUB.calledTwice).to.be.true;
        expect(EXEC_STUB.firstCall.args[0]).to.match(/-p22.*\.\/.*example\.com:\/remote\/path/);
        expect(EXEC_STUB.secondCall.args[0]).to.match(/-p22022.*\.\/.*example\.org:\/remote\/path/);

        testDone();
      });
    });

  });

});
