var expect = require('chai').expect
  , proxyquire = require('proxyquire')
  , sinon = require('sinon')
  , fixtures = require('./fixtures')
  , flight = require('../lib/flight')
  , errors = require('../lib/errors');

describe('flightplan', function() {

  var LOGGER_STUB = {
    warn: sinon.stub()
  };

  var MOCKS = {
    './logger': function() {
      return LOGGER_STUB;
    }
  };

  var plan;

  before(function() {
    process.on = sinon.stub(); // flightplan registers SIGINT listener using process.on()
  });

  beforeEach(function() {
    plan = proxyquire('../lib', MOCKS);
  });

  afterEach(function() {
    Object.keys(LOGGER_STUB).forEach(function(k) {
      LOGGER_STUB[k].reset();
    });
  });

  describe('#target()', function() {
    it('should register single host targets', function() {
      plan.target('test', fixtures.HOST);

      expect(plan._targets).to.deep.equal({
        test: {
          hosts: fixtures.HOST,
          options: {}
        }
      });
    });

    it('should register multi host targets', function() {
      plan.target('test', fixtures.HOSTS);

      expect(plan._targets).to.deep.equal({
        test: {
          hosts: fixtures.HOSTS,
          options: {}
        }
      });
    });

    it('should register dynamic host targets', function() {
      plan.target('test', fixtures.HOST_FN);

      expect(plan._targets).to.deep.equal({
        test: {
          hosts: fixtures.HOST_FN,
          options: {}
        }
      });
    });

    it('should register multiple targets', function() {
      plan.target('test1', fixtures.HOST);
      plan.target('test2', fixtures.HOSTS);
      plan.target('test3', fixtures.HOST_FN);

      expect(plan._targets).to.have.keys('test1', 'test2', 'test3');
    });

    it('should handle options', function() {
      plan.target('test', fixtures.HOST, fixtures.HOST_OPTIONS);

      expect(plan._targets).to.deep.equal({
        test: {
          hosts: fixtures.HOST,
          options: fixtures.HOST_OPTIONS
        }
      });
    });
  });

  describe('#local()', function() {
    it('should register flight without task', function() {
      var FN = function() {};

      plan.local(FN);

      expect(plan._flights).to.deep.equal([
        { type: flight.TYPE.LOCAL, tasks: ['default'], fn: FN }
      ]);
    });

    it('should register flight with single task', function() {
      var FN = function() {}
        , TASK = 'task';

      plan.local(TASK, FN);

      expect(plan._flights).to.deep.equal([
        { type: flight.TYPE.LOCAL, tasks: [TASK], fn: FN }
      ]);
    });

    it('should register flight with multiple tasks', function() {
      var FN = function() {}
        , TASKS = ['task1', 'task2'];

      plan.local(TASKS, FN);

      expect(plan._flights).to.deep.equal([
        { type: flight.TYPE.LOCAL, tasks: TASKS, fn: FN }
      ]);
    });

    it('should register multiple flights', function() {
      var FN1 = function() {}
        , FN2 = function() {};

      plan.local(FN1);
      plan.local(FN2);

      expect(plan._flights).to.deep.equal([
        { type: flight.TYPE.LOCAL, tasks: ['default'], fn: FN1 },
        { type: flight.TYPE.LOCAL, tasks: ['default'], fn: FN2 }
      ]);
    });
  });

  describe('#remote()', function() {
    it('should register flight without task', function() {
      var FN = function() {};

      plan.remote(FN);

      expect(plan._flights).to.deep.equal([
        { type: flight.TYPE.REMOTE, tasks: ['default'], fn: FN }
      ]);
    });

    it('should register flight with single task', function() {
      var FN = function() {}
        , TASK = 'task';

      plan.remote(TASK, FN);

      expect(plan._flights).to.deep.equal([
        { type: flight.TYPE.REMOTE, tasks: [TASK], fn: FN }
      ]);
    });

    it('should register flight with multiple tasks', function() {
      var FN = function() {}
        , TASKS = ['task1', 'task2'];

      plan.remote(TASKS, FN);

      expect(plan._flights).to.deep.equal([
        { type: flight.TYPE.REMOTE, tasks: TASKS, fn: FN }
      ]);
    });

    it('should register multiple flights', function() {
      var FN1 = function() {}
        , FN2 = function() {};

      plan.remote(FN1);
      plan.remote(FN2);

      expect(plan._flights).to.deep.equal([
        { type: flight.TYPE.REMOTE, tasks: ['default'], fn: FN1 },
        { type: flight.TYPE.REMOTE, tasks: ['default'], fn: FN2 }
      ]);
    });
  });

  describe('#abort()', function() {
    it('should throw error', function() {
      expect(function() { plan.abort(); }).to.throw(errors.AbortedError);

      var MESSAGE = 'Custom abort message';
      expect(function() { plan.abort(MESSAGE); }).to.throw(errors.AbortedError, MESSAGE);
    });
  });

  describe('#run()', function() {
    it('should fail when target is missing', function() {
      expect(function() { plan.run(); }).to.throw(errors.InvalidTargetError);
      expect(function() { plan.run('task'); }).to.throw(errors.InvalidTargetError);
    });

    it('should fail when target is invalid', function() {
      expect(function() { plan.run('task', 'target'); }).to.throw(errors.InvalidTargetError);
    });

    it('should execute a correct target', function() {
      plan.target('target', fixtures.HOST);

      var exitStub = sinon.stub(process, 'exit');

      plan.run('task', 'target');

      expect(LOGGER_STUB.warn.lastCall.args[0]).to.contain('no work to be done');
      expect(process.exit.calledOnce).to.be.true;
      expect(process.exit.lastCall.args[0]).to.equal(1);

      exitStub.restore();
    });
  });

});