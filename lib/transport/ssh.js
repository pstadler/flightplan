var util = require('util')
	, Fiber = require('fibers')
	, Connection = require('ssh2')
	, Transport = require('./transport');

function SSHTransport(flight, config) {
	SSHTransport.super_.call(this, flight);
	this.config = config;
	this.connection = new Connection();
	this.logger = this.logger.cloneWithPrefix(this.config.host);

	var _fiber = Fiber.current;

	this.connection.on('ready', function() {
		_fiber.run();
	});

	this.connection.on('close', function() {
		// todo
	});

	this.connection.connect(this.config);

	return Fiber.yield();
}

util.inherits(SSHTransport, Transport);

SSHTransport.prototype.__exec = function(cmd, args, options) {
	var fiber = Fiber.current;
	var ret = {
		code : 0,
		stdout: null,
		stderr: null
	};
	cmd = cmd + (args ? ' ' + args : '');

	this.logger.command(cmd);
	this.connection.exec(cmd, function(err, stream) {
		if(err) {
			// TODO
		}

		stream.on('data', function(data, extended) {
			if(extended === 'stderr') {
				ret.code = ret.code === 0 ? 1 : ret.code;
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

		stream.on('end', function() {
			if(ret.code === 0) {
				this.logger.success('ok'.success);
			} else if(options.failsafe) {
				this.logger.warn(this.logger.format('safely failed').warn, 'with exit code:', ret.code);
			} else {
				this.logger.error(this.logger.format('failed').error, 'with exit code:', ret.code);
				this.flight.abort(this.logger.format('`%s` failed on %s', cmd.white, this.config.host.warn));
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