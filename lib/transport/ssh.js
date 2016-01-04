var util = require('util')
  , extend = require('util-extend')
  , Fiber = require('fibers')
  , Connection = require('ssh2').Client
  , byline = require('byline')
  , Transport = require('./index')
  , errors = require('../errors')
  , fs = require('fs');

function SSH(context) {
  SSH.super_.call(this, context);

  var config = extend({}, context.remote); // clone

  if(config.tryKeyboard !== false) {
    config.tryKeyboard = true;
    config.readyTimeout = config.readyTimeout || 30000;
  }

  if(config.privateKey) {
    config.privateKey = fs.readFileSync(config.privateKey, { encoding: 'utf8' });
  }

  var self = this;

  var fiber = Fiber.current;

  this._connection = new Connection();

  this._connection.on('keyboard-interactive', function next(name, instructions,
                                    instructionsLang, prompts, finish, answers) {
    answers = answers || [];

    var currentPrompt = prompts[answers.length];

    if(answers.length < prompts.length) {
      new Fiber(function() {
        var answer = self.prompt(currentPrompt.prompt, { hidden: !currentPrompt.echo });
        answers.push(answer);

        next(name, instructions, instructionsLang, prompts, finish, answers);
      }).run();
    } else {
      finish(answers);
    }
  });

  this._connection.on('ready', function() {
    fiber.run();
  });

  this._connection.on('error', function(err) {
    return fiber.throwInto(err);
  });

  this._connection.connect(config);

  return Fiber.yield();
}
util.inherits(SSH, Transport);

SSH.prototype._exec = function(command, options) {
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

  self._connection.exec(command, options.exec || {}, function(err, stream) {

    stream.on('data', function(data) {
      result.stdout = (result.stdout || '') + data;
    });

    stream.stderr.on('data', function(data) {
      result.stderr = (result.stderr || '') + data;
    });

    byline(stream, { keepEmptyLines: true }).on('data', function(data) {
      if(!options.silent) {
        self._logger.stdout(data);
      }
    });

    byline(stream.stderr, { keepEmptyLines: true }).on('data', function(data) {
      self._logger[options.failsafe ? 'stdwarn' : 'stderr'](data);
    });

    stream.on('exit', function(code) {
      result.code = code;
    });

    stream.on('end', function() {
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
  });

  return Fiber.yield();
};

SSH.prototype.close = function() {
  this._connection.end();
};

module.exports = SSH;
