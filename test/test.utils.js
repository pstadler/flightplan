var expect = require('chai').expect
  , proxyquire = require('proxyquire')
  , sinon = require('sinon')
  , os = require('os');

describe('utils', function() {

  describe('#writeTempFile()', function() {
    it('should write to the global directory on *NIX', function() {
      var MOCKS = {
        os: { platform: sinon.stub().returns('linux') },
        fs: { writeFileSync: sinon.stub() }
      };

      var writeTempFile = proxyquire('../lib/utils', MOCKS).writeTempFile;

      var result = writeTempFile('content');

      expect(result).to.match(new RegExp('^' + os.tmpdir()));
      expect(MOCKS.fs.writeFileSync.calledOnce).to.be.true;
      expect(MOCKS.fs.writeFileSync.lastCall.args).to.deep.equal([result, 'content']);
    });

    it('should write to the current directory on Windows', function() {
      var MOCKS = {
        os: { platform: sinon.stub().returns('win32') },
        fs: { writeFileSync: sinon.stub() }
      };

      var writeTempFile = proxyquire('../lib/utils', MOCKS).writeTempFile;

      var result = writeTempFile('content');

      expect(result).to.match(/^[0-9a-f]{32}$/);
      expect(MOCKS.fs.writeFileSync.calledOnce).to.be.true;
      expect(MOCKS.fs.writeFileSync.lastCall.args).to.deep.equal([result, 'content']);
    });
  });

  describe('#escapeSingleQuotes()', function() {
    it('should correctly escape single quotes', function() {
      var escapeSingleQuotes = proxyquire('../lib/utils', {}).escapeSingleQuotes;

      expect(escapeSingleQuotes("'string'")).to.equal("'\\''string'\\''");
      expect(escapeSingleQuotes("\\'string\\'")).to.equal("\\'\\''string\\'\\''");
      expect(escapeSingleQuotes('')).to.equal('');
      expect(escapeSingleQuotes()).to.be.undefined;
    });
  });

});
