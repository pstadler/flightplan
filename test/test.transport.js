var expect = require('chai').expect
  , sinon = require('sinon')
  , proxyquire = require('proxyquire')
  , fixtures = require('./fixtures')
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
      '../logger': sinon.stub().returns(LOGGER_STUB)
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

      transport.exec('cmd');

      expect(transport._exec.calledOnce).to.be.true;
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
        "sudo -u root -i bash -c ''",
        {}
      ]);
    });

    it('should properly escape the command', function() {
      transport._exec = sinon.stub();

      transport.sudo('"cmd"');

      expect(transport._exec.lastCall.args[0]).to.equal("sudo -u root -i bash -c '\"cmd\"'");

      transport.sudo("'cmd'");

      expect(transport._exec.lastCall.args[0]).to.equal("sudo -u root -i bash -c ''\\''cmd'\\'''");
    });

    it('should pass options to #_exec()', function() {
      transport._exec = sinon.stub();

      transport.sudo('cmd', fixtures.COMMAND_OPTIONS);

      expect(transport._exec.lastCall.args[1]).to.equal(fixtures.COMMAND_OPTIONS);
    });

    it('should respect the `user` option', function() {
      transport._exec = sinon.stub();

      transport.sudo('cmd', { user: 'not-root' });

      expect(transport._exec.lastCall.args[0]).to.equal("sudo -u not-root -i bash -c 'cmd'");
    });
  });

  describe('#prompt()', function() {
  });

  describe('#waitFor()', function() {
  });

  describe('#with()', function() {
    it('should handle commands', function() {
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

    it('should handle command nesting', function() {
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

    it('should handle options', function() {
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

    it('should handle options nesting', function() {
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
