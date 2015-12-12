var expect = require('chai').expect
  , proxyquire = require('proxyquire')
  , sinon = require('sinon')
  , runWithinFiber = require('./utils/run-within-fiber')
  , sshEvent = require('./utils/ssh-event')
  , fixtures = require('./fixtures');

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

  var Transport = proxyquire('../lib/transport', {
    '../logger': function() { return LOGGER_STUB; }
  });

  var MOCKS = {
    './index': Transport,
    'ssh2': {
      Client: sinon.stub().returns({
        exec: SSH2_EXEC_STUB,
        on: SSH2_ON_STUB,
        connect: SSH2_CONNECT_STUB
      })
    }
  };

  var CONTEXT = {
    options: { debug: true },
    remote: { host: 'example.org', port: 22 }
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

    it('should pass correct args to connect', function(testDone) {
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

    it('should handle keyboard interactive authentications', function(testDone) {
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

});
