var util = require('util')
	, commands = require('./commands');

function Transport(flight) {
	this.options = {
		silent: false,
		failsafe: false
	};
	this.flight = flight;
	this.logger = flight.logger;

	commands.forEach(function(cmd) {
		this[cmd] = function(args, opts) {
			opts = this._parseOptions(opts);
			return this._execOrSkip(cmd, args, opts);
		};
	}, this);
}

Transport.prototype = {

	__close: function() {
	},

	__exec: function() {
	},

	close: function() {
		if(this.__close) {
			this.__close();
		}
	},

	log: function() {
		this.logger.log.apply(this.logger, arguments);
	},

	debug: function() {
		this.logger.debug.apply(this.logger, arguments);
	},

	abort: function() {
		this.flight.abort.apply(this.flight, arguments);
	},

	verbose: function() {
		this.options.silent = false;
	},

	silent: function() {
		this.options.silent = true;
	},

	failsafe: function() {
		this.options.failsafe = true;
	},

	unsafe: function() {
		this.options.failsafe = false;
	},

	sudo: function(args, opts) {
		var user = opts.user ? util.format('-u %s', opts.user) : '';
		var format = "%s -i bash -c '%s'";
		args = util.format(format, user, args);
		opts = this._parseOptions(opts);
		return this._execOrSkip('sudo', args, opts);
	},

	exec: function(args, opts) {
		args = args.split(' ');
		cmd = args.shift();
		opts = this._parseOptions(opts);
		return this._execOrSkip(cmd, args.join(' '), opts);
	},

	_execOrSkip: function(cmd, args, opts) {
		if(this.flight.isAborted()) {
			return false;
		}
		var result = this.__exec(cmd, args, opts);
		this.logger.space();
		return result;
	},

	_parseOptions: function(opts) {
		var options = util._extend({}, this.options); // clone
		return util._extend(options, opts);
	}

};

module.exports = Transport;