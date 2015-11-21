var expect = require('chai').expect
  , sinon = require('sinon')
  , chalk = require('chalk')
  , logger = require('../lib/logger')
  , LOG_METHODS = require('./fixtures').LOG_METHODS;

describe('logger', function() {

  it('should print prefix when set', function() {
    var _logger = logger({ prefix: 'test-prefix' });
    var STDOUT_STUB = sinon.stub(process.stdout, 'write');

    _logger.info('test');

    STDOUT_STUB.restore();

    expect(STDOUT_STUB.calledTwice).to.be.true;
    expect(STDOUT_STUB.firstCall.args[0]).to.contain('test-prefix');
    expect(STDOUT_STUB.lastCall.args[0]).to.contain('test');
  });

  it('should omit debug messages per default', function() {
    var _logger = logger();
    var LOG_STUB = sinon.stub(_logger, '_log');

    _logger.debug('test');

    expect(LOG_STUB.notCalled).to.be.true;
  });

  it('should print debug messages when option is set', function() {
    var _logger = logger({ debug: true });
    var LOG_STUB = sinon.stub(_logger, '_log');

    _logger.debug('test');

    expect(LOG_STUB.calledOnce).to.be.true;
    expect(LOG_STUB.lastCall.args[0]).to.contain('test');
  });

  it('should expose functional methods', function() {
    var _logger = logger({ prefix: 'test-prefix', debug: true });

    expect(LOG_METHODS).to.have.length(10);

    LOG_METHODS.forEach(function(method) {
      var STDOUT_STUB = sinon.stub(process.stdout, 'write');

      _logger[method]('test');

      STDOUT_STUB.restore();

      expect(STDOUT_STUB.calledTwice, method).to.be.true;
      expect(STDOUT_STUB.firstCall.args[0]).to.contain('test-prefix');
      expect(STDOUT_STUB.lastCall.args[0]).to.contain('test');
    });
  });

});

after(function() {
  chalk.enabled = true;
  var _logger = logger({ debug: true, prefix: 'prefix' });

  process.stdout.write('Logger method styles\n\n');

  LOG_METHODS.forEach(function(method) {
    process.stdout.write(method + new Array(10 - method.length).join(' '));
    _logger[method](method);
  });
});
