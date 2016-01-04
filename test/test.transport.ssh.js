var expect = require('chai').expect
  , proxyquire = require('proxyquire')
  , sinon = require('sinon')
  , runWithinFiber = require('./utils/run-within-fiber')
  , sshEvent = require('./utils/ssh-event')
  , fixtures = require('./fixtures')
  , errors = require('../lib/errors');

describe('transport/ssh', function() {

  var LOGGER_STUB = {
    command: sinon.stub(),
    success: sinon.stub(),
    warn: sinon.stub(),
    error: sinon.stub(),
    stdout: sinon.stub(),
    stdwarn: sinon.stub(),
    stderr: sinon.stub()
  };

  var SSH2_EXEC_STUB = sinon.stub();
  var SSH2_ON_STUB = sinon.stub();
  var SSH2_CONNECT_STUB = sinon.stub();
  var SSH2_END_STUB = sinon.stub();

  var Transport = proxyquire('../lib/transport', {
    '../logger': function() { return LOGGER_STUB; }
  });

  var MOCKS = {
    './index': Transport,
    'ssh2': {
      Client: sinon.stub().returns({
        exec: SSH2_EXEC_STUB,
        on: SSH2_ON_STUB,
        connect: SSH2_CONNECT_STUB,
        end: SSH2_END_STUB
      })
    },
    'byline': function(stream) {
      return {
        on: function(event, fn) {
          stream.on(event, fn);
        }
      };
    }
  };

  var CONTEXT = {
    options: { debug: true },
    remote: fixtures.HOST
  };

  var SSH;

  beforeEach(function() {
    SSH = proxyquire('../lib/transport/ssh', MOCKS);
  });

  afterEach(function() {
    Object.keys(LOGGER_STUB).forEach(function(k) {
      LOGGER_STUB[k].reset();
    });

    SSH2_EXEC_STUB.reset();
    SSH2_ON_STUB.reset();
    SSH2_CONNECT_STUB.reset();
  });

  describe('initialize', function() {
    it('should inherit from Transport', function(testDone) {
      runWithinFiber(function() {
        sshEvent(SSH2_ON_STUB, 'ready');
        var ssh = new SSH(CONTEXT);

        expect(ssh).to.be.instanceof(Transport);
        testDone();
      });
    });

    it('should call the super constructor', function(testDone) {
      runWithinFiber(function() {
        var SUPER_CALL_STUB = sinon.stub(SSH.super_, 'call');

        sshEvent(SSH2_ON_STUB, 'ready');
        var ssh = new SSH(CONTEXT);

        expect(SUPER_CALL_STUB.calledOnce).to.be.true;
        expect(SUPER_CALL_STUB.lastCall.args).to.deep.equal([
          ssh,
          CONTEXT
        ]);

        SUPER_CALL_STUB.restore();
        testDone();
      });
    });

    it('should pass correct args to ssh2#connect()', function(testDone) {
      runWithinFiber(function() {
        sshEvent(SSH2_ON_STUB, 'ready');
        new SSH(CONTEXT);

        expect(SSH2_CONNECT_STUB.calledOnce).to.be.true;
        expect(SSH2_CONNECT_STUB.lastCall.args).to.deep.equal([
          {
            host: CONTEXT.remote.host,
            port: CONTEXT.remote.port,
            readyTimeout: 30000,
            tryKeyboard: true
          }
        ]);

        testDone();
      });
    });

    it('should read the private key into a string', function(testDone) {
      runWithinFiber(function() {
        sshEvent(SSH2_ON_STUB, 'ready');
        new SSH({
          options: {},
          remote: {
            privateKey: fixtures.PRIVATE_KEY_PATH
          }
        });

        expect(SSH2_CONNECT_STUB.calledOnce).to.be.true;
        expect(SSH2_CONNECT_STUB.lastCall.args[0])
          .to.have.property('privateKey', 'private key fixture\n');

        testDone();
      });
    });

    it('should handle connection errors', function(testDone) {
      runWithinFiber(function() {
        expect(function() {
          sshEvent(SSH2_ON_STUB, 'error', new Error('test'));
          new SSH(CONTEXT);

          expect(SSH2_ON_STUB.withArgs('error').calledOnce).to.be.true;
        }).to.throw(Error, 'test');

        testDone();
      });
    });

    it('should handle keyboard interactive authentication', function(testDone) {
      runWithinFiber(function() {
        sshEvent(SSH2_ON_STUB, 'ready');
        var ssh = new SSH(CONTEXT);

        expect(SSH2_ON_STUB.withArgs('keyboard-interactive').calledOnce).to.be.true;

        var handler = SSH2_ON_STUB.withArgs('keyboard-interactive').lastCall.args[1];

        var DONE_FN = sinon.stub();
        var PROMPT_STUB = ssh.prompt = sinon.stub();
        PROMPT_STUB.onFirstCall().returns('answer1');
        PROMPT_STUB.onSecondCall().returns('answer2');

        handler('name', 'instructions', 'instructionsLang', fixtures.INTERACTIVE_PROMPTS, DONE_FN);

        expect(PROMPT_STUB.calledTwice).to.be.true;
        expect(PROMPT_STUB.firstCall.args[0]).to.equal(fixtures.INTERACTIVE_PROMPTS[0].prompt);
        expect(PROMPT_STUB.firstCall.args[1])
          .to.have.property('hidden', !fixtures.INTERACTIVE_PROMPTS[0].echo);
        expect(PROMPT_STUB.secondCall.args[0]).to.equal(fixtures.INTERACTIVE_PROMPTS[1].prompt);
        expect(PROMPT_STUB.secondCall.args[1])
          .to.have.property('hidden', !fixtures.INTERACTIVE_PROMPTS[1].echo);

        expect(DONE_FN.calledOnce).to.be.true;
        expect(DONE_FN.lastCall.args[0]).to.deep.equal(['answer1', 'answer2']);

        testDone();
      });
    });
  });

  describe('#_exec()', function() {
    var SSH2_EXEC_STREAM_MOCK;

    beforeEach(function() {
      SSH2_EXEC_STREAM_MOCK = {
        on: sinon.stub(),
        stderr: {
          on: sinon.stub()
        }
      };
    });

    it('should execute a command', function(testDone) {
      runWithinFiber(function() {
        sshEvent(SSH2_ON_STUB, 'ready');
        var ssh = new SSH(CONTEXT);

        setImmediate(function() {
          expect(SSH2_EXEC_STUB.calledOnce).to.be.true;
          expect(SSH2_EXEC_STUB.lastCall.args[0]).to.equal('command');
          expect(SSH2_EXEC_STUB.lastCall.args[1]).to.deep.equal({});

          SSH2_EXEC_STUB.lastCall.args[2](null, SSH2_EXEC_STREAM_MOCK);

          SSH2_EXEC_STREAM_MOCK.on.withArgs('data').firstCall.args[1]('output');
          SSH2_EXEC_STREAM_MOCK.on.withArgs('data').lastCall.args[1]('output'); // byline mock
          SSH2_EXEC_STREAM_MOCK.on.withArgs('exit').lastCall.args[1](0);
          SSH2_EXEC_STREAM_MOCK.on.withArgs('end').lastCall.args[1]();
        });

        var result = ssh._exec('command');

        expect(result).to.deep.equal({
          code: 0,
          stdout: 'output',
          stderr: null
        });

        expect(LOGGER_STUB.command.calledOnce).to.be.true;
        expect(LOGGER_STUB.command.lastCall.args[0]).to.contain('command');
        expect(LOGGER_STUB.stdout.lastCall.args[0]).to.contain('output');
        expect(LOGGER_STUB.success.lastCall.args[0]).to.contain('ok');

        testDone();
      });
    });

    it('should correctly merge options with transport options', function(testDone) {
      runWithinFiber(function() {
        sshEvent(SSH2_ON_STUB, 'ready');
        var ssh = new SSH(CONTEXT);

        ssh.silent();

        setImmediate(function() {
          SSH2_EXEC_STUB.lastCall.args[2](null, SSH2_EXEC_STREAM_MOCK);

          SSH2_EXEC_STREAM_MOCK.on.withArgs('data').lastCall.args[1]('output'); // byline mock
          SSH2_EXEC_STREAM_MOCK.on.withArgs('exit').lastCall.args[1](0);
          SSH2_EXEC_STREAM_MOCK.on.withArgs('end').lastCall.args[1]();
        });

        ssh._exec('echo "hello world"');

        expect(LOGGER_STUB.stdout.notCalled).to.be.true;

        setImmediate(function() {
          SSH2_EXEC_STUB.lastCall.args[2](null, SSH2_EXEC_STREAM_MOCK);

          SSH2_EXEC_STREAM_MOCK.on.withArgs('data').lastCall.args[1]('output'); // byline mock
          SSH2_EXEC_STREAM_MOCK.on.withArgs('exit').lastCall.args[1](0);
          SSH2_EXEC_STREAM_MOCK.on.withArgs('end').lastCall.args[1]();
        });

        ssh._exec('echo "hello world"', { silent: false });

        expect(LOGGER_STUB.stdout.notCalled).to.be.false;

        testDone();
      });
    });

    it('should correctly handle the silent option', function(testDone) {
      runWithinFiber(function() {
        sshEvent(SSH2_ON_STUB, 'ready');
        var ssh = new SSH(CONTEXT);

        setImmediate(function() {
          SSH2_EXEC_STUB.lastCall.args[2](null, SSH2_EXEC_STREAM_MOCK);

          SSH2_EXEC_STREAM_MOCK.on.withArgs('data').firstCall.args[1]('silent\n');
          SSH2_EXEC_STREAM_MOCK.on.withArgs('data').lastCall.args[1]('silent\n'); // byline mock
          SSH2_EXEC_STREAM_MOCK.on.withArgs('exit').lastCall.args[1](0);
          SSH2_EXEC_STREAM_MOCK.on.withArgs('end').lastCall.args[1]();
        });

        var result = ssh._exec('echo "silent"', { silent: true });

        expect(result).to.deep.equal({
          code: 0,
          stdout: 'silent\n',
          stderr: null
        });

        expect(LOGGER_STUB.command.calledOnce).to.be.true;
        expect(LOGGER_STUB.command.lastCall.args[0]).to.contain('echo "silent"');
        expect(LOGGER_STUB.stdout.notCalled).to.be.true;
        expect(LOGGER_STUB.success.lastCall.args[0]).to.contain('ok');

        testDone();
      });
    });

    it('should correctly handle the failsafe option', function(testDone) {
      runWithinFiber(function() {
        sshEvent(SSH2_ON_STUB, 'ready');
        var ssh = new SSH(CONTEXT);

        setImmediate(function() {
          SSH2_EXEC_STUB.lastCall.args[2](null, SSH2_EXEC_STREAM_MOCK);

          SSH2_EXEC_STREAM_MOCK.stderr.on.withArgs('data').firstCall.args[1]('not found\n');
          // byline mock
          SSH2_EXEC_STREAM_MOCK.stderr.on.withArgs('data').lastCall.args[1]('not found\n');
          SSH2_EXEC_STREAM_MOCK.on.withArgs('exit').lastCall.args[1](127);
          SSH2_EXEC_STREAM_MOCK.on.withArgs('end').lastCall.args[1]();
        });

        var result = ssh._exec('invalid-command', { failsafe: true });

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
        sshEvent(SSH2_ON_STUB, 'ready');
        var ssh = new SSH(CONTEXT);

        setImmediate(function() {
          SSH2_EXEC_STUB.lastCall.args[2](null, SSH2_EXEC_STREAM_MOCK);

          SSH2_EXEC_STREAM_MOCK.stderr.on.withArgs('data').firstCall.args[1]('not found\n');
           // byline mock
          SSH2_EXEC_STREAM_MOCK.stderr.on.withArgs('data').lastCall.args[1]('not found\n');
          SSH2_EXEC_STREAM_MOCK.on.withArgs('exit').lastCall.args[1](127);
          SSH2_EXEC_STREAM_MOCK.on.withArgs('end').lastCall.args[1]();
        });

        expect(function() {
          ssh._exec('invalid-command');
          ssh._exec('never-called');
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
      var EXEC_OPTIONS = { 'some-option': 'some-value' };

      runWithinFiber(function() {
        sshEvent(SSH2_ON_STUB, 'ready');
        var ssh = new SSH(CONTEXT);

        setImmediate(function() {
          SSH2_EXEC_STUB.lastCall.args[2](null, SSH2_EXEC_STREAM_MOCK);

          SSH2_EXEC_STREAM_MOCK.on.withArgs('end').lastCall.args[1]();
        });

        ssh._exec('echo "test"', { exec: EXEC_OPTIONS });

        expect(SSH2_EXEC_STUB.calledOnce).to.be.true;
        expect(SSH2_EXEC_STUB.lastCall.args[1]).to.deep.equal(EXEC_OPTIONS);

        testDone();
      });
    });
  });

  describe('#close()', function() {
    it('should close the connection', function(testDone) {
      runWithinFiber(function() {
        sshEvent(SSH2_ON_STUB, 'ready');
        var ssh = new SSH(CONTEXT);

        ssh.close();

        expect(SSH2_END_STUB.calledOnce).to.be.true;

        testDone();
      });
    });
  });

});
