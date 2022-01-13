var extend = require('util-extend'),
  Connection = require('ssh2').Client,
  byline = require('byline'),
  Transport = require('./index'),
  errors = require('../errors'),
  fs = require('fs');

class SSH extends Transport {
  static async create(context) {
    var ssh = new SSH(context);
    var config = extend({}, context.remote); // clone

    if (config.tryKeyboard !== false) {
      config.tryKeyboard = true;
      config.readyTimeout = config.readyTimeout || 30000;
    }

    if (config.privateKey) {
      config.privateKey = fs.readFileSync(config.privateKey, { encoding: 'utf8' });
    }

    var hasFailed = false;

    ssh._connection = new Connection();

    ssh._connection.on(
      'keyboard-interactive',
      async function next(name, instructions, instructionsLang, prompts, finish, answers) {
        answers = answers || [];

        while (answers.length < prompts.length && !hasFailed) {
          var currentPrompt = prompts[answers.length];
          var answer = await ssh.prompt(currentPrompt.prompt, { hidden: !currentPrompt.echo });
          answers.push(answer);
        }

        finish(answers);
      }
    );

    return new Promise((resolve, reject) => {
      ssh._connection.on('ready', function () {
        resolve(ssh);
      });

      ssh._connection.on('error', function (err) {
        hasFailed = true;
        reject(err);
      });

      ssh._connection.connect(config);
    });
  }

  async _exec(command, options) {
    options = options || {};

    var self = this;

    options = extend(extend({}, self._options), options); // clone and extend

    var result = {
      code: 0,
      stdout: null,
      stderr: null,
    };

    self._logger.command(command);

    return new Promise((resolve, reject) => {
      self._connection.exec(command, options.exec || {}, function (err, stream) {
        stream.on('data', function (data) {
          result.stdout = (result.stdout || '') + data;
        });

        stream.stderr.on('data', function (data) {
          result.stderr = (result.stderr || '') + data;
        });

        byline(stream, { keepEmptyLines: true }).on('data', function (data) {
          if (!options.silent) {
            self._logger.stdout(data);
          }
        });

        byline(stream.stderr, { keepEmptyLines: true }).on('data', function (data) {
          self._logger[options.failsafe ? 'stdwarn' : 'stderr'](data);
        });

        stream.on('exit', function (code) {
          result.code = code;
        });

        stream.on('end', function () {
          if (result.code === 0) {
            self._logger.success('ok');
          } else if (options.failsafe) {
            self._logger.warn('failed safely (' + result.code + ')');
          } else {
            self._logger.error('failed (' + result.code + ')');

            var error = new errors.CommandExitedAbnormallyError(
              'Command exited abnormally on ' + self._context.remote.host
            );

            return reject(error);
          }

          resolve(result);
        });
      });
    });
  }
  close() {
    this._connection.end();
  }
}

module.exports = SSH;
