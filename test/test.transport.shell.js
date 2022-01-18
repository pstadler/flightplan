var expect = require('./utils/chai').expect,
  proxyquire = require('proxyquire'),
  sinon = require('sinon'),
  childProcess = require('child_process'),
  errors = require('../lib/errors'),
  fixtures = require('./fixtures'),
  extend = require('util')._extend;

describe('transport/shell', function () {
  var LOGGER_STUB = {
    command: sinon.stub(),
    success: sinon.stub(),
    warn: sinon.stub(),
    error: sinon.stub(),
    stdout: sinon.stub(),
    stdwarn: sinon.stub(),
    stderr: sinon.stub(),
  };

  var CHILD_PROCESS_SPY = sinon.spy(childProcess, 'exec');
  var WRITE_TEMP_FILE_STUB = sinon.stub().returns('/path/to/tmp/file');

  var Transport = proxyquire('../lib/transport', {
    '../logger': function () {
      return LOGGER_STUB;
    },
    // eslint-disable-next-line camelcase
    child_process: { exec: CHILD_PROCESS_SPY },
  });

  var MOCKS = {
    './index': Transport,
    '../utils': {
      writeTempFile: WRITE_TEMP_FILE_STUB,
    },
    fs: {
      unlinkSync: function () {},
    },
  };

  var CONTEXT = {
    options: {},
    hosts: fixtures.HOSTS,
    remote: { host: 'localhost' },
  };

  var Shell;

  beforeEach(function () {
    Shell = proxyquire('../lib/transport/shell', MOCKS);
  });

  afterEach(function () {
    Object.keys(LOGGER_STUB).forEach(function (k) {
      LOGGER_STUB[k].resetHistory();
    });

    CHILD_PROCESS_SPY.resetHistory();
    WRITE_TEMP_FILE_STUB.resetHistory();
  });

  describe('initialize', function () {
    it('should inherit from Transport', function () {
      var shell = new Shell(CONTEXT);

      expect(shell).to.be.instanceof(Transport);
    });
  });

  describe('#_exec()', function () {
    it('should execute a command', async function () {
      var shell = new Shell(CONTEXT);
      var result = await shell._exec('echo "hello world"');

      expect(result).to.deep.equal({
        code: 0,
        stdout: 'hello world\n',
        stderr: null,
      });

      expect(LOGGER_STUB.command.calledOnce).to.be.true;
      expect(LOGGER_STUB.command.lastCall.args[0]).to.contain('echo "hello world"');
      expect(LOGGER_STUB.stdout.lastCall.args[0]).to.contain('hello world');
      expect(LOGGER_STUB.success.lastCall.args[0]).to.contain('ok');
    });

    it('should correctly merge options with transport options', async function () {
      var shell = new Shell(CONTEXT);

      shell.silent();

      await shell._exec('echo "hello world"');

      expect(LOGGER_STUB.stdout.notCalled).to.be.true;

      await shell._exec('echo "hello world"', { silent: false });

      expect(LOGGER_STUB.stdout.notCalled).to.be.false;
    });

    it('should correctly handle the silent option', async function () {
      var shell = new Shell(CONTEXT);
      var result = await shell._exec('echo "silent world"', { silent: true });

      expect(result).to.deep.equal({
        code: 0,
        stdout: 'silent world\n',
        stderr: null,
      });

      expect(LOGGER_STUB.command.calledOnce).to.be.true;
      expect(LOGGER_STUB.command.lastCall.args[0]).to.contain('echo "silent world"');
      expect(LOGGER_STUB.stdout.notCalled).to.be.true;
      expect(LOGGER_STUB.success.lastCall.args[0]).to.contain('ok');
    });

    it('should correctly handle the failsafe option', async function () {
      var shell = new Shell(CONTEXT);
      var result = await shell._exec('invalid-command', { failsafe: true });

      expect(result).to.have.property('code', 127);
      expect(result).to.have.property('stdout', null);
      expect(result).to.have.property('stderr').that.contains('not found');

      expect(LOGGER_STUB.command.calledOnce).to.be.true;
      expect(LOGGER_STUB.command.lastCall.args[0]).to.contain('invalid-command');
      expect(LOGGER_STUB.stdwarn.calledOnce).to.be.true;
      expect(LOGGER_STUB.stdwarn.lastCall.args[0]).to.contain('not found');
      expect(LOGGER_STUB.warn.lastCall.args[0]).to.contain('failed safely');
    });

    it('should throw and stop when a command fails', async function () {
      var shell = new Shell(CONTEXT);

      await expect(
        shell._exec('invalid-command').then(() => shell._exec('never-called'))
      ).to.be.rejectedWith(errors.CommandExitedAbnormallyError, 'exited abnormally');

      expect(LOGGER_STUB.command.calledOnce).to.be.true;
      expect(LOGGER_STUB.command.lastCall.args[0]).to.contain('invalid-command');
      expect(LOGGER_STUB.stderr.calledOnce).to.be.true;
      expect(LOGGER_STUB.stderr.lastCall.args[0]).to.contain('not found');
      expect(LOGGER_STUB.error.lastCall.args[0]).to.contain('failed');
    });

    it('should handle `exec` options', async function () {
      var EXEC_OPTIONS = { maxBuffer: 1337, 'some-option': 'some-value' };

      var shell = new Shell(CONTEXT);

      await shell._exec('echo "test"', { exec: EXEC_OPTIONS });

      expect(CHILD_PROCESS_SPY.calledOnce).to.be.true;
      expect(CHILD_PROCESS_SPY.lastCall.args[1]).to.deep.equal(EXEC_OPTIONS);
    });

    it('should use a sane default `maxBuffer` size', async function () {
      var shell = new Shell(CONTEXT);

      await shell._exec('echo "test"');

      expect(CHILD_PROCESS_SPY.calledOnce).to.be.true;
      expect(CHILD_PROCESS_SPY.lastCall.args[1].maxBuffer).to.equal(1000 * 1024);
    });
  });

  describe('#transfer()', function () {
    var EXEC_STUB;

    beforeEach(function () {
      EXEC_STUB = sinon.stub(Shell.prototype, '_exec').returns('test');
    });

    afterEach(function () {
      EXEC_STUB.restore();
    });

    it('should upload a single file', async function () {
      var shell = new Shell(CONTEXT);

      await shell.transfer('/path/to/file', '/remote/path');

      expect(WRITE_TEMP_FILE_STUB.calledOnce).to.be.true;
      expect(WRITE_TEMP_FILE_STUB.lastCall.args[0]).to.contain('/path/to/file');
      expect(EXEC_STUB.lastCall.args[0]).to.contain('--files-from /path/to/tmp/file');
    });

    it('should upload an array of files', async function () {
      var shell = new Shell(CONTEXT);

      await shell.transfer(['/path/to/file', '/path/to/another/file'], '/remote/path');

      expect(WRITE_TEMP_FILE_STUB.calledOnce).to.be.true;
      expect(WRITE_TEMP_FILE_STUB.lastCall.args[0]).to.contain('/path/to/file');
      expect(WRITE_TEMP_FILE_STUB.lastCall.args[0]).to.contain('/path/to/another/file');
      expect(EXEC_STUB.lastCall.args[0]).to.contain('--files-from /path/to/tmp/file');
    });

    it('should upload an array of files', async function () {
      var shell = new Shell(CONTEXT);

      await shell.transfer(['/path/to/file', '/path/to/another/file'], '/remote/path');

      expect(WRITE_TEMP_FILE_STUB.calledOnce).to.be.true;
      expect(WRITE_TEMP_FILE_STUB.lastCall.args[0]).to.contain(
        '/path/to/file\n/path/to/another/file'
      );
      expect(EXEC_STUB.lastCall.args[0]).to.contain('--files-from /path/to/tmp/file');
    });

    it('should upload a zero-delimited list of files', async function () {
      var shell = new Shell(CONTEXT);

      await shell.transfer(['/path/to/file\0/path/to/another/file'], '/remote/path');

      expect(WRITE_TEMP_FILE_STUB.calledOnce).to.be.true;
      expect(WRITE_TEMP_FILE_STUB.lastCall.args[0]).to.contain(
        '/path/to/file\n/path/to/another/file'
      );
      expect(EXEC_STUB.lastCall.args[0]).to.contain('--files-from /path/to/tmp/file');
    });

    it('should upload a newline-delimited list of files', async function () {
      var shell = new Shell(CONTEXT);

      await shell.transfer(['/path/to/file\n/path/to/another/file'], '/remote/path');

      expect(WRITE_TEMP_FILE_STUB.calledOnce).to.be.true;
      expect(WRITE_TEMP_FILE_STUB.lastCall.args[0]).to.contain(
        '/path/to/file\n/path/to/another/file'
      );
      expect(EXEC_STUB.lastCall.args[0]).to.contain('--files-from /path/to/tmp/file');
    });

    it('should upload files from the result of a command', async function () {
      var shell = new Shell(CONTEXT);

      await shell.transfer({ stdout: '/path/to/file\n/path/to/another/file' }, '/remote/path');

      expect(WRITE_TEMP_FILE_STUB.calledOnce).to.be.true;
      expect(WRITE_TEMP_FILE_STUB.lastCall.args[0]).to.contain(
        '/path/to/file\n/path/to/another/file'
      );
      expect(EXEC_STUB.lastCall.args[0]).to.contain('--files-from /path/to/tmp/file');
    });

    it('should throw when passing an empty file list', async function () {
      var shell = new Shell(CONTEXT);

      await expect(shell.transfer('\n', '/remote/path')).to.be.rejectedWith(
        errors.InvalidArgumentError,
        'Empty file list'
      );

      await expect(shell.transfer([], '/remote/path')).to.be.rejectedWith(
        errors.InvalidArgumentError,
        'Empty file list'
      );

      await expect(shell.transfer({}, '/remote/path')).to.be.rejectedWith(
        errors.InvalidArgumentError,
        'Invalid object'
      );
    });

    it('should throw when remote path is empty', async function () {
      var shell = new Shell(CONTEXT);

      await expect(shell.transfer('/path/to/file')).to.be.rejectedWith(
        errors.InvalidArgumentError,
        'Missing remote path'
      );
    });

    it('should call rsync with the correct flags', async function () {
      var shell = new Shell(CONTEXT);

      await shell.transfer('/path/to/file', '/remote/path');

      expect(EXEC_STUB.calledTwice).to.be.true;
      expect(EXEC_STUB.firstCall.args[0]).to.contain(' -az ');

      var CONTEXT_WITH_DEBUG = extend(CONTEXT, { options: { debug: true } });
      shell = new Shell(CONTEXT_WITH_DEBUG);

      await shell.transfer('/path/to/file', '/remote/path');

      expect(EXEC_STUB.lastCall.args[0]).to.contain(' -azvv ');
    });

    it('should use the `username` property of the remote if specified', async function () {
      var CONTEXT_WITH_USERNAME = {
        options: {},
        remote: { host: 'localhost' },
        hosts: [
          {
            host: 'example.org',
            username: 'remote-user',
          },
        ],
      };
      var shell = new Shell(CONTEXT_WITH_USERNAME);

      await shell.transfer('/path/to/file', '/remote/path');

      expect(EXEC_STUB.lastCall.args[0]).to.contain(' remote-user@example.org:');
    });

    it('should use the path to a private key', async function () {
      var CONTEXT_WITH_PRIVATE_KEY = {
        options: {},
        remote: { host: 'localhost' },
        hosts: [
          {
            host: 'example.org',
            privateKey: fixtures.PRIVATE_KEY_PATH,
          },
        ],
      };
      var shell = new Shell(CONTEXT_WITH_PRIVATE_KEY);

      await shell.transfer('/path/to/file', '/remote/path');

      expect(EXEC_STUB.lastCall.args[0]).to.contain('-i ' + fixtures.PRIVATE_KEY_PATH);
    });

    it('should upload files to multiple remote hosts', async function () {
      var shell = new Shell(CONTEXT);

      await shell.transfer('/path/to/file', '/remote/path');

      expect(EXEC_STUB.calledTwice).to.be.true;
      expect(EXEC_STUB.firstCall.args[0]).to.match(/-p22.*\.\/.*example\.com:\/remote\/path/);
      expect(EXEC_STUB.secondCall.args[0]).to.match(/-p22022.*\.\/.*example\.org:\/remote\/path/);
    });
  });
});
