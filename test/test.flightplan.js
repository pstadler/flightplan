var expect = require('chai').expect
  , proxyquire = require('proxyquire')
  , sinon = require('sinon')
  , fixtures = require('./fixtures')
  , flight = require('../lib/flight')
  , errors = require('../lib/errors')
  , chalk = require('chalk');

describe('flightplan', function() {

  var LOGGER_STUB = {
    warn: sinon.stub(),
    info: sinon.stub(),
    error: sinon.stub()
  };

  var MOCKS = {
    './logger': function() {
      return LOGGER_STUB;
    }
  };

  var plan;

  before(function() {
    sinon.stub(process, 'on'); // flightplan registers SIGINT listener using process.on()
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
    var exitStub;

    beforeEach(function() {
      exitStub = sinon.stub(process, 'exit');
    });

    afterEach(function() {
      exitStub.restore();
    });

    it('should fail when target is missing', function() {
      expect(function() { plan.run(); }).to.throw(errors.InvalidTargetError);
      expect(function() { plan.run('task'); }).to.throw(errors.InvalidTargetError);
    });

    it('should fail when target is invalid', function() {
      expect(function() { plan.run('task', 'target'); }).to.throw(errors.InvalidTargetError);
    });

    it('should execute a valid target', function() {
      plan.target('target', fixtures.HOST);
      plan.local('task', function() {});

      plan.run('task', 'target');

      expect(chalk.enabled).to.be.true;
      expect(process.exit.notCalled).to.be.true;
      expect(LOGGER_STUB.info.firstCall.args[0]).to.match(/^Running task:target/);
      expect(LOGGER_STUB.info.lastCall.args[0]).to.match(/^Flightplan finished.*\d* (ms|μs)/);
    });

    it('should run the default task if none is specified', function() {
      plan.target('target', fixtures.HOST);

      var runtime;
      plan.local(function() {
        runtime = plan.runtime;
      });

      plan.run(null, 'target');

      expect(runtime.task).to.equal('default');
    });

    it('should run multiple flights in correct order', function() {
      var callStack = [];

      plan.target('target', fixtures.HOST);
      plan.local('task', function() { callStack.push(1); });
      plan.local('task', function() { callStack.push(2); });
      plan.local('anothertask', function() { callStack.push(3); });
      plan.local('task', function() { callStack.push(4); });

      plan.run('task', 'target');

      expect(callStack).to.deep.equal([1, 2, 4]);
    });

    it('should execute a valid target without tasks', function() {
      plan.target('target', fixtures.HOST);

      plan.run('task', 'target');

      expect(LOGGER_STUB.warn.lastCall.args[0]).to.contain('no work to be done');
      expect(process.exit.calledOnce).to.be.true;
      expect(process.exit.lastCall.args[0]).to.equal(1);
    });

    it('should handle options', function() {
      plan.target('target', fixtures.HOST, {
        'some-flag': true,
        'another-flag': true
      });

      var runtime;
      plan.local('task', function() {
        runtime = plan.runtime;
      });

      plan.run('task', 'target', {
        color: false,
        username: 'testuser',
        'another-flag': false
      });

      expect(chalk.enabled).to.be.false;
      expect(runtime).to.not.be.null;
      expect(runtime.options.username).to.equal('testuser');
      expect(runtime.options['some-flag']).to.be.true;
      expect(runtime.options['another-flag']).to.be.false;
      expect(runtime.hosts[0]).to.deep.equal({ host: 'example.com', username: 'testuser' });
    });

    it('should handle dynamic hosts configuration', function() {
      plan.target('target', fixtures.DYNAMIC_HOST);

      var runtime;
      plan.local('task', function() {
        runtime = plan.runtime;
      });

      plan.run('task', 'target');

      expect(runtime.hosts[0]).to.deep.equal({ host: 'example.com' });
    });

    it('should handle errors in dynamic hosts configuration', function() {
      plan.target('target', function(done) {
        done(new Error('dynamic hosts error'));
      });

      plan.local('task', function() {});

      expect(function() { plan.run('task', 'target'); })
        .to.throw(errors.AbortedError, 'dynamic hosts error');
    });
  });

  describe('Signal handlers', function() {
    var exitStub;

    beforeEach(function() {
      exitStub = sinon.stub(process, 'exit');
    });

    afterEach(function() {
      exitStub.restore();
    });

    it('should catch SIGINT and throw an error', function() {
      var fn = process.on.withArgs('SIGINT').lastCall.args[1];

      expect(function() { fn(); }).to.throw(errors.ProcessInterruptedError);
    });

    it('should catch uncaught exceptions and exit', function() {
      var fn = process.on.withArgs('uncaughtException').lastCall.args[1];

      fn(new Error('some error'));

      expect(LOGGER_STUB.error.lastCall.args[0]).to.contain('some error');
      expect(process.exit.calledOnce).to.be.true;
      expect(process.exit.lastCall.args[0]).to.equal(1);
    });
  });

});