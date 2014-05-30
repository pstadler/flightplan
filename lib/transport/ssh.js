var util = require('util')
  , fs = require('fs')
  , Fiber = require('fibers')
  , Connection = require('./TunneledConnection')
  , Transport = require('./index');

function SSHTransport(flight, target) {
  SSHTransport.super_.call(this, flight);
  this.target = target;
  this.logger = this.logger.cloneWithPrefix(this.target.host);

  this.connection = new Connection();

  var _fiber = Fiber.current;

  this.connection.on('ready', function() {
    _fiber.run();
  });
  this.connection.on('tunnel:ready', function(host){
     console.log(host + ":: connected");
  });

  var options = util._extend({}, this.target); // clone
  delete options.exec;


  var setPrivateKey = function(o){
      if(o.tunnel){
          o.tunnel = util._extend({}, o.tunnel)
          setPrivateKey(o.tunnel);
      }
      if(o.privateKey)o.privateKey = fs.readFileSync(o.privateKey);

  }
  setPrivateKey(options);
  this.connection.connect(options);

  return Fiber.yield();
}

util.inherits(SSHTransport, Transport);

SSHTransport.prototype.__exec = function(cmd, args, options) {
  var fiber = Fiber.current;
  var ret = {
    code: 0,
    stdout: null,
    stderr: null
  };
  cmd = this._execWith + cmd + (args ? ' ' + args : '');

  this.logger.command(cmd);
  var execOpts = options.exec || this.target.exec || {};

  this.connection.exec(cmd, execOpts, function(err, stream) {

    stream.on('data', function(data, extended) {
      if(extended === 'stderr') {
        ret.stderr = (ret.stderr || '') + data;
        (options.failsafe ? this.logger.stdwarn : this.logger.stderr)(String(data));
      } else {
        ret.stdout = (ret.stdout || '') + data;
        if(!options.silent) {
          this.logger.stdout(data);
        }
      }
    }.bind(this));

    stream.on('exit', function(code) {
      ret.code = code;
    }.bind(this));

    stream.on('close', function() {
      if(ret.code === 0) {
        this.logger.success('ok'.success);
      } else if(options.failsafe) {
        this.logger.warn(this.logger.format('safely failed').warn, 'with exit code:', ret.code);
      } else {
        this.logger.error(this.logger.format('failed').error, 'with exit code:', ret.code);
        fiber.throwInto(new Error(this.logger.format('`%s` failed on %s'
                                                       , cmd.white, this.target.host.warn)));
      }
      fiber.run(ret);
    }.bind(this));

  }.bind(this));

  return Fiber.yield();
};

SSHTransport.prototype.__close = function() {
  this.connection.end();
};

module.exports = SSHTransport;