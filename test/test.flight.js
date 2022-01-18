var expect = require('./utils/chai').expect,
  proxyquire = require('proxyquire'),
  sinon = require('sinon'),
  extend = require('util')._extend,
  fixtures = require('./fixtures'),
  Shell = require('../lib/transport/shell'),
  SSH = require('../lib/transport/ssh'),
  errors = require('../lib/errors');

describe('flight', function () {
  var MOCKS;

  var flight;

  beforeEach(function () {
    MOCKS = {
      './local': { run: sinon.stub() },
      './remote': { run: sinon.stub(), disconnect: sinon.stub() },
    };

    flight = proxyquire('../lib/flight', MOCKS);
  });

  describe('#run()', function () {
    it('should run local flights', function () {
      var FN = function () {},
        CONTEXT = {};

      flight.run(flight.TYPE.LOCAL, FN, CONTEXT);

      expect(MOCKS['./local'].run.calledOnce).to.be.true;
      expect(MOCKS['./local'].run.lastCall.args).to.deep.equal([FN, CONTEXT]);
      expect(MOCKS['./remote'].run.notCalled).to.be.true;
    });

    it('should run remote flights', function () {
      var FN = function () {},
        CONTEXT = {};

      flight.run(flight.TYPE.REMOTE, FN, CONTEXT);

      expect(MOCKS['./remote'].run.calledOnce).to.be.true;
      expect(MOCKS['./remote'].run.lastCall.args).to.deep.equal([FN, CONTEXT]);
      expect(MOCKS['./local'].run.notCalled).to.be.true;
    });
  });

  describe('#disconnect()', function () {
    it('should call remote#disconnect()', function () {
      flight.disconnect();

      expect(MOCKS['./remote'].disconnect.calledOnce).to.be.true;
    });
  });
});

describe('flight/local', function () {
  var LOGGER_STUB = {
    info: sinon.stub(),
  };

  var SHELL_STUB_INSTANCE = sinon.createStubInstance(Shell);
  var SHELL_SPY = sinon.spy(function () {
    return SHELL_STUB_INSTANCE;
  });

  var MOCKS = {
    '../logger': function () {
      return LOGGER_STUB;
    },
    '../transport/shell': SHELL_SPY,
  };

  var local;

  beforeEach(function () {
    local = proxyquire('../lib/flight/local', MOCKS);
  });

  afterEach(function () {
    Object.keys(LOGGER_STUB).forEach(function (k) {
      LOGGER_STUB[k].reset();
    });

    SHELL_SPY.resetHistory();
  });

  describe('#run()', function () {
    it('should run a given function within the correct context', async function () {
      var FN = sinon.stub(),
        CONTEXT = { 'some-var': 'some-val' };

      await local.run(FN, CONTEXT);

      expect(SHELL_SPY.calledOnce).to.be.true;
      expect(SHELL_SPY.calledWithNew()).to.be.true;
      expect(SHELL_SPY.lastCall.args).to.deep.equal([
        {
          remote: { host: 'localhost' },
          'some-var': 'some-val',
        },
      ]);

      expect(FN.calledOnce).to.be.true;
      expect(FN.lastCall.args).to.deep.equal([SHELL_STUB_INSTANCE]);
    });
  });
});

describe('flight/remote', function () {
  var LOGGER_STUB = {
    info: sinon.stub(),
    warn: sinon.stub(),
  };

  var SSH_STUB_INSTANCE = sinon.createStubInstance(SSH);
  var SSH_STUB = sinon.stub(SSH, 'create').callsFake(function () {
    SSH_STUB_INSTANCE.runtime = {};
    return SSH_STUB_INSTANCE;
  });

  var MOCKS = {
    '../logger': function () {
      return LOGGER_STUB;
    },
    '../transport/ssh': SSH,
  };

  var remote;

  beforeEach(function () {
    remote = proxyquire('../lib/flight/remote', MOCKS);
  });

  afterEach(function () {
    Object.keys(LOGGER_STUB).forEach(function (k) {
      LOGGER_STUB[k].reset();
    });

    SSH_STUB.resetHistory();
  });

  describe('#run()', function () {
    it('should run a given function within the correct context', async function () {
      var FN = sinon.stub(),
        CONTEXT = { hosts: fixtures.HOSTS, 'some-var': 'some-val' };

      await remote.run(FN, CONTEXT);

      expect(SSH_STUB.calledTwice);
      expect(SSH_STUB.calledTwice).to.be.true;
      expect(SSH_STUB.firstCall.args).to.deep.equal([
        {
          remote: fixtures.HOSTS[0],
          hosts: fixtures.HOSTS,
          'some-var': 'some-val',
        },
      ]);
      expect(SSH_STUB.lastCall.args).to.deep.equal([
        {
          remote: fixtures.HOSTS[1],
          hosts: fixtures.HOSTS,
          'some-var': 'some-val',
        },
      ]);

      expect(FN.calledTwice).to.be.true;
      expect(FN.lastCall.args).to.deep.equal([SSH_STUB_INSTANCE]);
    });

    it('should throw when unable to connect', async function () {
      var ERROR_MOCKS = extend({}, MOCKS);
      ERROR_MOCKS['../transport/ssh'] = {
        create: function () {
          throw new Error('Unable to connect');
        },
      };

      var failingRemote = proxyquire('../lib/flight/remote', ERROR_MOCKS);

      var FN = sinon.stub(),
        CONTEXT = { hosts: fixtures.HOSTS };

      expect(failingRemote.run(FN, CONTEXT)).to.be.rejectedWith(errors.ConnectionFailedError);
    });

    it('should not throw when failsafe is set', async function () {
      var ERROR_MOCKS = extend({}, MOCKS);
      ERROR_MOCKS['../transport/ssh'] = {
        create: function () {
          throw new Error('Unable to connect');
        },
      };

      var failingRemote = proxyquire('../lib/flight/remote', ERROR_MOCKS);

      var FN = sinon.stub(),
        CONTEXT = { hosts: [{ host: 'example.org', failsafe: true }] };

      await failingRemote.run(FN, CONTEXT);

      expect(LOGGER_STUB.warn.lastCall.args[0]).to.contain('Safely failed');
    });
  });

  describe('#disconnect()', function () {
    it('should disconnect from all hosts', async function () {
      var FN = function () {},
        CONTEXT = { hosts: fixtures.HOSTS };

      await remote.run(FN, CONTEXT);
      remote.disconnect();

      expect(SSH_STUB_INSTANCE.close.calledTwice).to.be.true;
    });
  });
});
