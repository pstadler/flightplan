var util = require('util')
	, exec = require("child_process").exec
	, Fiber = require('fibers')
	, Transport = require('./transport');

function ShellTransport(flight) {
	ShellTransport.super_.call(this, flight);
	this.logger = this.logger.cloneWithPrefix('local');
}

util.inherits(ShellTransport, Transport);

ShellTransport.prototype.__exec = function(cmd, args, options) {
	var fiber = Fiber.current;
	var proc = null;
	var ret = {
		code : null,
		stdout: null,
		stderr: null
	};

	cmd = cmd + (args ? ' ' + args : '');
	this.logger.command(cmd);
	proc = exec(cmd);

	proc.stdout.on('data', function(data) {
		if(!options.silent) {
			this.logger.stdout(String(data));
		}
		ret.stdout = (ret.stdout || '') + data;
	}.bind(this));

	proc.stderr.on('data', function(data) {
		if(!options.silent) {
			(options.failsafe ? this.logger.stdwarn : this.logger.stderr)(String(data));
		}
		ret.stderr += data;
	}.bind(this));

	proc.on('close', function(code) {
		ret.code = code;
		if(ret.code === 0) {
				this.logger.success('ok'.success);
			} else if(options.failsafe) {
				this.logger.warn(this.logger.format('failed safely').warn, 'with exit code:', ret.code);
			} else {
				this.logger.error(this.logger.format('failed').error, 'with exit code:', ret.code);
				this.flight.abort(this.logger.format('`%s` failed on %s', cmd.white, 'local'));
			}
		fiber.run(ret);
	}.bind(this));

	// proc.on('error', function(e) {
	// fiber.throwInto(e);
	// });
	return Fiber.yield();
};

module.exports = ShellTransport;