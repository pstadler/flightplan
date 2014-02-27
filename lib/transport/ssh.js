var util = require('util')
	, Fiber = require('fibers')
	, Connection = require('ssh2')
	, Transport = require('./transport');

function SSHTransport(flight, target) {
	SSHTransport.super_.call(this, flight);
	this.target = target;
	this.logger = this.logger.cloneWithPrefix(this.target.host);

	this.connection = new Connection();

	var _fiber = Fiber.current;

	this.connection.on('ready', function() {
		_fiber.run();
	});

	this.connection.on('close', function() {
		// TODO
	});

	this.connection.connect(this.target);

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
	cmd = cmd + (args ? ' ' + args : '');

	this.logger.command(cmd);
	var execOpts = options.exec || this.config.exec || {};
	this.connection.exec(cmd, execOpts, function(err, stream) {
		if(err) {
			// TODO
		}

		stream.on('data', function(data, extended) {
			if(extended === 'stderr') {
				ret.stderr = (ret.stderr || '') + data;
				if(!options.silent) {
					var logFn = (options.failsafe ? this.logger.stdwarn : this.logger.stderr);
					logFn(String(data));
				}
			} else {
				ret.stdout = (ret.stdout || '') + data;
				if(!options.silent) {
					this.logger.stdout(data);
				}
			}
		}.bind(this));

		stream.on('exit', function(code, signal) {
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