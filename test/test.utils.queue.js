var expect = require('chai').expect
  , sinon = require('sinon')
  , queue = require('../lib/utils/queue');

describe('utils', function() {

  describe('#queue()', function() {
    var testQueue;

    beforeEach(function() {
      testQueue = queue();
    });

    it('should execute pushed functions in correct order', function() {
      var FN1 = sinon.stub()
        , FN2 = sinon.stub();

      testQueue.push(FN1);
      testQueue.push(FN2);

      testQueue.next();

      expect(FN1.calledOnce).to.be.true;
      expect(FN2.notCalled, 'should wait until queue#done() has been called').to.be.true;

      testQueue.done();

      expect(FN2.calledOnce).to.be.true;
    });

    it('should execute callbacks passed to #done()', function(testDone) {
      var DONE_FN1 = sinon.stub()
        , DONE_FN2 = sinon.stub()
        , FN1 = function() { setImmediate(function() { testQueue.done(DONE_FN1); }); }
        , FN2 = function() { setImmediate(function() { testQueue.done(DONE_FN2); }); };

      testQueue.push(FN1);
      testQueue.push(FN2);

      testQueue.next();

      setImmediate(function() {
        expect(DONE_FN1.notCalled, 'should wait until the end').to.be.true;
        expect(DONE_FN2.notCalled, 'should wait until the end').to.be.true;

        setImmediate(function() {
          expect(DONE_FN1.calledOnce).to.be.true;
          expect(DONE_FN2.calledOnce).to.be.true;

          testDone();
        });
      });
    });

    it('should be in clean state after queue has been finished', function() {
      var DONE_FN1 = sinon.stub()
        , FN1 = sinon.spy(function() { testQueue.done(DONE_FN1); });

      testQueue.push(FN1);

      testQueue.next();

      expect(FN1.calledOnce).to.be.true;
      expect(DONE_FN1.calledOnce).to.be.true;

      FN1.reset();
      DONE_FN1.reset();

      testQueue.next();

      expect(FN1.notCalled).to.be.true;
      expect(DONE_FN1.notCalled).to.be.true;
    });
  });

});
