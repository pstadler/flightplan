var util = require('util')
  , extend = require('util-extend')
  , exec = require('child_process').exec
  , byline = require('byline')
  , fs = require('fs')
  , writeTempFile = require('../utils').writeTempFile
  , Fiber = require('fibers')
  , Future = require('fibers/future')
  , Transport = require('./index')
  , errors = require('../errors');

function Shell(context) {
  Shell.super_.call(this, context);
}
util.inherits(Shell, Transport);

Shell.prototype._exec = function(command, options) {
  options = options || {};

  var self = this;

  options = extend(extend({}, self._options), options); // clone and extend

  var result = {
    code: 0,
    stdout: null,
    stderr: null
  };

  self._logger.command(command);

  var fiber = Fiber.current;

  var proc = exec(command, extend({ maxBuffer: 1000 * 1024 }, options.exec));

  proc.stdout.on('data', function(data) {
    result.stdout = (result.stdout || '') + data;
  });

  proc.stderr.on('data', function(data) {
    result.stderr = (result.stderr || '') + data;
  });

  byline(proc.stdout).on('data', function(data) {
    if(!options.silent) {
      self._logger.stdout(String(data).trim());
    }
  });

  byline(proc.stderr).on('data', function(data) {
    self._logger[options.failsafe ? 'stdwarn' : 'stderr'](String(data));
  });

  proc.on('close', function(code) {
    result.code = code;

    if(result.code === 0) {
      self._logger.success('ok');
    } else if(options.failsafe) {
      self._logger.warn('failed safely (' + result.code + ')');
    } else {
      self._logger.error('failed (' + result.code + ')');

      var error = new errors.CommandExitedAbnormallyError(
                  'Command exited abnormally on ' + self._context.remote.host);

      return fiber.throwInto(error);
    }

    fiber.run(result);
  });

  return Fiber.yield();
};

Shell.prototype.transfer = function(files, remoteDir, options) {
  options = extend(extend({}, this._options), options); // clone and extend

  if(!remoteDir) {
    throw new errors.InvalidArgumentError('Missing remote path for transfer()');
  }

  if(Array.isArray(files)) {
    files = files.join('\n');
  } else if(files instanceof Object) {
    if(!files.hasOwnProperty('stdout')) {
      throw new errors.InvalidArgumentError('Invalid object passed to transfer()');
    }

    files = files.stdout;
  }

  files = (files || '').trim().replace(/[\r|\0]/mg, '\n');

  if(!files) {
    throw new errors.InvalidArgumentError('Empty file list passed to transfer()');
  }

  var tmpFile = writeTempFile(files);

  var rsyncFlags = '-az' + (this._context.options.debug ? 'vv' : '');
  var results = [];

  var self = this;

  var task = function(remote) {
    var sshFlags = (remote.privateKey ? ' -i ' + remote.privateKey : '');
    var remoteUrl = util.format('%s%s:%s',
                              (remote.username ? remote.username + '@' : ''),
                              remote.host, remoteDir);

    var command = util.format('rsync --files-from %s %s --rsh="ssh -p%s%s" ./ %s',
                              tmpFile, rsyncFlags,
                              remote.port || 22, sshFlags, remoteUrl);

    var future = new Future();

    new Fiber(function() {
      results.push(self.exec(command, options));

      return future.return();
    }).run();

    return future;
  };

  var tasks = [];
  self._context.hosts.forEach(function(remote) {
    tasks.push(task(remote));
  });

  Future.wait(tasks);

  fs.unlink(tmpFile);

  return results;
};

module.exports = Shell;
