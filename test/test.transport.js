var expect = require('chai').expect
  , sinon = require('sinon')
  , proxyquire = require('proxyquire')
  , fixtures = require('./fixtures')
  , runWithinFiber = require('./utils/run-within-fiber')
  , errors = require('../lib/errors')
  , COMMANDS = require('../lib/transport/commands');

describe('transport', function() {

  var LOGGER_STUB = {
    user: sinon.stub(),
    debug: sinon.stub()
  };

  var MOCKS;

  var CONTEXT = {
    options: { debug: true },
    remote: fixtures.HOST
  };

  var transport;

  beforeEach(function() {
    MOCKS = {
      '../logger': sinon.stub().returns(LOGGER_STUB),
      'prompt': { get: sinon.stub() }
    };

    var Transport = proxyquire('../lib/transport', MOCKS);
    transport = new Transport(CONTEXT);
  });

  describe('initialize', function() {
    it('should set the correct options', function() {
      expect(transport._options.silent).to.be.false;
      expect(transport._options.failsafe).to.be.false;
    });

    it('should correctly initialize the logger', function() {
      expect(MOCKS['../logger'].calledOnce).to.be.true;
      expect(MOCKS['../logger'].lastCall.args).to.deep.equal([{
        debug: true,
        prefix: fixtures.HOST.host
      }]);
    });

    it('should set up the `runtime` property', function() {
      expect(transport.runtime).to.deep.equal(CONTEXT.remote);
    });

    it('should throw when an abstract method gets called', function() {
      expect(function() { transport._exec(); } ).to.throw(Error, 'does not implement');
      expect(function() { transport.transfer(); } ).to.throw(Error, 'does not implement');
    });
  });

  describe('#exec()', function() {
    it('should pass the correct command to #_exec()', function() {
      transport._exec = sinon.stub();

      transport.exec();

      expect(transport._exec.calledOnce).to.be.true;
      expect(transport._exec.lastCall.args).to.deep.equal([
        '',
        {}
      ]);

      transport.exec('cmd');

      expect(transport._exec.lastCall.args).to.deep.equal([
        'cmd',
        {}
      ]);
    });

    it('should pass the correct options to #_exec()', function() {
      transport._exec = sinon.stub();

      transport.exec('cmd', fixtures.COMMAND_OPTIONS);

      expect(transport._exec.calledOnce).to.be.true;
      expect(transport._exec.lastCall.args).to.deep.equal([
        'cmd',
        fixtures.COMMAND_OPTIONS
      ]);
    });
  });

  describe('#sudo()', function() {
    it('should pass the correct command to #_exec()', function() {
      transport._exec = sinon.stub();

      transport.sudo();

      expect(transport._exec.calledOnce).to.be.true;
      expect(transport._exec.lastCall.args).to.deep.equal([
        "echo '' | sudo -u root -i bash",
        {}
      ]);
    });

    it('should properly escape the command', function() {
      transport._exec = sinon.stub();

      transport.sudo('printf "hello world"');

      expect(transport._exec.lastCall.args[0])
        .to.equal("echo 'printf \"hello world\"' | sudo -u root -i bash");

      transport.sudo("printf 'hello world'");

      expect(transport._exec.lastCall.args[0])
        .to.equal("echo 'printf '\\''hello world'\\''' | sudo -u root -i bash");
    });

    it('should pass options to #_exec()', function() {
      transport._exec = sinon.stub();

      transport.sudo('cmd', fixtures.COMMAND_OPTIONS);

      expect(transport._exec.lastCall.args[1]).to.equal(fixtures.COMMAND_OPTIONS);
    });

    it('should respect the `user` option', function() {
      transport._exec = sinon.stub();

      transport.sudo('cmd', { user: 'not-root' });

      expect(transport._exec.lastCall.args[0]).to.equal("echo 'cmd' | sudo -u not-root -i bash");
    });
  });

  describe('#prompt()', function() {
    it('should display a message and wait for an answer', function(testDone) {
      runWithinFiber(function() {
        setImmediate(function() {
          MOCKS.prompt.get.lastCall.args[1](null, { input: 'answer' });
        });

        var answer = transport.prompt('question?');

        expect(MOCKS.prompt.get.calledOnce).to.be.true;
        expect(MOCKS.prompt.get.lastCall.args[0]).to.have.property('hidden', false);
        expect(MOCKS.prompt.get.lastCall.args[0]).to.have.property('required', false);
        expect(MOCKS.prompt.get.lastCall.args[0].description).to.contain('question?');
        expect(answer).to.equal('answer');

        testDone();
      });
    });

    it('should handle simultaneous prompts', function(testDone) {
      runWithinFiber(function() {
        var answer1, answer2;

        setImmediate(function() {
          runWithinFiber(function() {
            setImmediate(function() {
              MOCKS.prompt.get.secondCall.args[1](null, { input: 'answer2' });

              expect(MOCKS.prompt.get.calledTwice).to.be.true;
              expect(MOCKS.prompt.get.firstCall.args[0].description).to.contain('question1?');
              expect(MOCKS.prompt.get.secondCall.args[0].description).to.contain('question2?');
              expect(answer1).to.equal('answer1');
              expect(answer2).to.equal('answer2');
            });

            answer2 = transport.prompt('question2?');

            expect(MOCKS.prompt.get.notCalled).to.be.true;
          });

          MOCKS.prompt.get.firstCall.args[1](null, { input: 'answer1' });
        });

        answer1 = transport.prompt('question1?');

        testDone();
      });
    });

    it('should handle the `hidden` flag', function(testDone) {
      runWithinFiber(function() {
        setImmediate(function() {
          MOCKS.prompt.get.lastCall.args[1](null, { input: 'answer' });
        });

        var answer = transport.prompt('question?', { hidden: true });

        expect(MOCKS.prompt.get.lastCall.args[0]).to.have.property('hidden', true);
        expect(answer).to.equal('answer');

        testDone();
      });
    });

    it('should take empty answers', function(testDone) {
      runWithinFiber(function() {
        setImmediate(function() {
          MOCKS.prompt.get.lastCall.args[1](null, null);
        });

        var answer = transport.prompt('question?');

        expect(answer).to.be.null;

        testDone();
      });
    });

    it('should throw on interrupt', function(testDone) {
      runWithinFiber(function() {
        setImmediate(function() {
          expect(function() {
            MOCKS.prompt.get.lastCall.args[1](new Error('ctrl-c'));
          }).to.throw(errors.ProcessInterruptedError, 'canceled prompt');


          testDone();
        });

        transport.prompt('question?');
      });
    });
  });

  describe('#waitFor()', function() {
    it('should wait until done', function(testDone) {
      var RESULT = { result: 'test' };

      runWithinFiber(function() {
        var result = transport.waitFor(function(done) {
          setImmediate(function() {
            done(RESULT);
          });
        });

        expect(result).to.deep.equal(RESULT);

        testDone();
      });
    });
  });

  describe('#with()', function() {
    it('should correctly handle commands', function() {
      transport._exec = sinon.stub();

      transport.with('outer-cmd', function() {
        transport.exec('inner-cmd');

        expect(transport._exec.calledOnce).to.be.true;
        expect(transport._exec.lastCall.args).to.deep.equal([
          'outer-cmd && inner-cmd',
          {}
        ]);
      });

      transport.exec('cmd');

      expect(transport._exec.lastCall.args).to.deep.equal([
        'cmd',
        {}
      ]);
    });

    it('should correctly handle command nesting', function() {
      transport._exec = sinon.stub();

      transport.with('outer-cmd', function() {
        transport.with('another-cmd', function() {
          transport.exec('inner-cmd');

          expect(transport._exec.calledOnce).to.be.true;
          expect(transport._exec.lastCall.args).to.deep.equal([
            'outer-cmd && another-cmd && inner-cmd',
            {}
          ]);
        });
      });

    });

    it('should correctly handle options', function() {
      transport._exec = sinon.stub();

      transport.with({ outerOption1: true }, function() {
        transport.exec('inner-cmd');

        expect(transport._options.outerOption1).to.be.true;
        expect(transport._exec.calledOnce).to.be.true;
        expect(transport._exec.lastCall.args).to.deep.equal([
          'inner-cmd',
          {}
        ]);
      });

      expect(transport._options.outerOption1).to.be.undefined;
    });

    it('should correctly handle options nesting', function() {
      transport._exec = sinon.stub();

      transport.with({ outerOption1: true, outerOption2: true }, function() {
        transport.with({ outerOption1: false, innerOption1: true }, function() {
          expect(transport._options.outerOption1).to.be.false;
          expect(transport._options.outerOption2).to.be.true;
          expect(transport._options.innerOption1).to.be.true;
        });

        expect(transport._options.outerOption1).to.be.true;
      });

      expect(transport._options.outerOption1).to.be.undefined;
    });

    it('should handle commands and options', function() {
      transport._exec = sinon.stub();

      transport.with('outer-cmd', { outerOption1: true }, function() {
        transport.exec('inner-cmd');

        expect(transport._options.outerOption1).to.be.true;
        expect(transport._exec.calledOnce).to.be.true;
        expect(transport._exec.lastCall.args).to.deep.equal([
          'outer-cmd && inner-cmd',
          {}
        ]);
      });
    });
  });

  describe('#silent()', function() {
    it('should set the correct flag', function() {
      transport.silent();

      expect(transport._options.silent).to.be.true;
    });
  });

  describe('#verbose()', function() {
    it('should set the correct flag', function() {
      transport.silent();
      transport.verbose();

      expect(transport._options.silent).to.be.false;
    });
  });

  describe('#failsafe()', function() {
    it('should set the correct flag', function() {
      transport.failsafe();

      expect(transport._options.failsafe).to.be.true;
    });
  });

  describe('#unsafe()', function() {
    it('should set the correct flag', function() {
      transport.failsafe();
      transport.unsafe();

      expect(transport._options.failsafe).to.be.false;
    });
  });

  describe('#log()', function() {
    it('should log messages', function() {
      transport.log('test message');

      expect(LOGGER_STUB.user.calledOnce).to.be.true;
      expect(LOGGER_STUB.user.lastCall.args[0]).to.equal('test message');
    });
  });

  describe('#debug()', function() {
    it('should log debug messages', function() {
      transport.debug('test message');

      expect(LOGGER_STUB.debug.calledOnce).to.be.true;
      expect(LOGGER_STUB.debug.lastCall.args[0]).to.equal('test message');
    });
  });

  describe('#close()', function() {
    it('should be an function', function() {
      expect(transport.close).to.be.a('function');
      expect(transport.close()).to.be.undefined;
    });
  });

  describe('command shortcuts', function() {
    it('should be exposed', function() {
      COMMANDS.forEach(function(command) {
        expect(transport[command]).to.be.a('function');
      });
    });

    it('should pass the correct command to #_exec()', function() {
      transport._exec = sinon.stub();

      transport[COMMANDS[0]]();

      expect(transport._exec.calledOnce).to.be.true;
      expect(transport._exec.lastCall.args).to.deep.equal([
        COMMANDS[0],
        {}
      ]);
    });

    it('should pass arguments to #_exec()', function() {
      transport._exec = sinon.stub();

      transport[COMMANDS[0]]('args');

      expect(transport._exec.calledOnce).to.be.true;
      expect(transport._exec.lastCall.args).to.deep.equal([
        COMMANDS[0] + ' args',
        {}
      ]);
    });

    it('should pass options to #_exec()', function() {
      transport._exec = sinon.stub();

      transport[COMMANDS[0]](fixtures.COMMAND_OPTIONS);

      expect(transport._exec.calledOnce).to.be.true;
      expect(transport._exec.lastCall.args).to.deep.equal([
        COMMANDS[0],
        fixtures.COMMAND_OPTIONS
      ]);
    });

    it('should pass arguments and options to #_exec()', function() {
      transport._exec = sinon.stub();

      transport[COMMANDS[0]]('args', fixtures.COMMAND_OPTIONS);

      expect(transport._exec.calledOnce).to.be.true;
      expect(transport._exec.lastCall.args).to.deep.equal([
        COMMANDS[0] + ' args',
        fixtures.COMMAND_OPTIONS
      ]);
    });
  });

});
