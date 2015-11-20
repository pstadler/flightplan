var expect = require('chai').expect
  , sinon = require('sinon')
  , proxyquire = require('proxyquire')
  , fixtures = require('./fixtures')
  , commands = require('../lib/transport/commands');

describe('transport', function() {

  var COMMANDS = ['exec', 'sudo', 'transfer', 'prompt', 'waitFor', 'with', 'silent',
                  'verbose', 'failsafe', 'unsafe', 'log', 'debug', 'close'].concat(commands);

  var LOGGER_STUB = {
    info: sinon.stub(),
    warn: sinon.stub(),
    error: sinon.stub()
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
    it('should expose expected methods', function() {
      COMMANDS.forEach(function(command) {
        expect(transport[command]).to.be.a('function');
      });
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

  describe('command shortcuts', function() {
    it('should pass the correct command to #_exec()', function() {
      transport._exec = sinon.stub();

      transport[commands[0]]();

      expect(transport._exec.calledOnce).to.be.true;
      expect(transport._exec.lastCall.args).to.deep.equal([
        commands[0],
        {}
      ]);
    });

    it('should pass arguments to #_exec()', function() {
      transport._exec = sinon.stub();

      transport[commands[0]]('args');

      expect(transport._exec.calledOnce).to.be.true;
      expect(transport._exec.lastCall.args).to.deep.equal([
        commands[0] + ' args',
        {}
      ]);
    });

    it('should pass options to #_exec()', function() {
      transport._exec = sinon.stub();

      transport[commands[0]](fixtures.COMMAND_OPTIONS);

      expect(transport._exec.calledOnce).to.be.true;
      expect(transport._exec.lastCall.args).to.deep.equal([
        commands[0],
        fixtures.COMMAND_OPTIONS
      ]);
    });

    it('should pass arguments and options to #_exec()', function() {
      transport._exec = sinon.stub();

      transport[commands[0]]('args', fixtures.COMMAND_OPTIONS);

      expect(transport._exec.calledOnce).to.be.true;
      expect(transport._exec.lastCall.args).to.deep.equal([
        commands[0] + ' args',
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

});
