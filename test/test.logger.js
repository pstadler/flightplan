var expect = require('chai').expect
  , sinon = require('sinon')
  , logger = require('../lib/logger');

describe('logger', function() {

  var LOG_METHODS = ['user', 'info', 'success', 'warn', 'error',
                      'command', 'stdout', 'stdwarn', 'stderr', 'debug'];

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

    LOG_METHODS.forEach(function(method) {
      var STDOUT_STUB = sinon.stub(process.stdout, 'write');

      _logger[method]('test');

      STDOUT_STUB.restore();

      expect(STDOUT_STUB.calledTwice, method).to.be.true;
      expect(STDOUT_STUB.firstCall.args[0]).to.contain('test-prefix');
      expect(STDOUT_STUB.lastCall.args[0]).to.contain('test');
    });
  });

  it('displays a list of available log types and their styles at this place', function() {
    require('chalk').enabled = true; // eslint-disable-line global-require

    var _logger = logger({ debug: true, prefix: 'prefix' });

    LOG_METHODS.forEach(function(method) {
      _logger[method]('#' + method + '()');
    });
  });

});
