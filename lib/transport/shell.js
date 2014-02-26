var util = require('util')
	, exec = require("child_process").exec
	, Fiber = require('fibers')
	, Future = require('fibers/future')
	, Transport = require('./transport');

function ShellTransport(flight) {
	ShellTransport.super_.call(this, flight);
	this.host = 'local';
	this.logger = this.logger.cloneWithPrefix(this.host);
}

util.inherits(ShellTransport, Transport);

ShellTransport.prototype.__exec = function(cmd, args, options) {
	var fiber = Fiber.current;
	var proc = null;
	var ret = {
		code: 0,
		stdout: null,
		stderr: null
	};

	cmd = this._prefixString + cmd + (args ? ' ' + args : '');
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
				fiber.throwInto(new Error(this.logger.format('`%s` failed on localhost', cmd.white)));
			}
		fiber.run(ret);
	}.bind(this));

	// proc.on('error', function(e) {
	// fiber.throwInto(e);
	// });
	return Fiber.yield();
};

ShellTransport.prototype.__transfer = function(files, remoteDir, options) {
	if(!remoteDir) {
		throw new Error('transfer: missing remote path');
	}

	if(files instanceof Array) {
		files = files.join('\n');
	} else if(files instanceof Object) {
		if(!files.hasOwnProperty('stdout')) {
			throw new Error('transfer: invalid object passed');
		}
		files = files.stdout;
	}

	files = (files || '').trim().replace(/[\r|\n|\0]/mg, '\\n');
	if(!files) {
		throw new Error('transfer: empty file list passed');
	}

	var rsyncFlags = '-az' + (this.logger.debugEnabled() ? 'v': '');
	var _results = [];
	var task = function(config) {
		var future = new Future();

		Fiber(function() {
			var cmd = util.format('(echo "%s") | rsync --files-from - %s --rsh="ssh -p%s" ./ %s@%s:%s'
							, files, rsyncFlags, config.port || 22, config.username, config.host, remoteDir);
			_results.push(this.exec(cmd, options));
			return future.return();
		}.bind(this)).run();

		return future;
	}.bind(this);

	var tasks = [];
	for(var i=0, len=this.flight.hosts.length; i < len; i++) {
		tasks.push(task(this.flight.hosts[i]));
	}
	Future.wait(tasks);
	return _results;
};

module.exports = ShellTransport;