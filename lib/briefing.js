var util = require('util');

function Briefing(flightplan, config) {
	this.flightplan = flightplan;
	this.logger = flightplan.logger;

	this.config = util._extend({
		debug: false,
		destinations: {}
	}, config);

	this.logger.enableDebug(!!this.config.debug);
}

Briefing.prototype = {

	applyOptions: function(options) {
		var destinations = this.getDestinations();
		if(options.username && destinations) {
			destinations.forEach(function(destination) {
				var hosts = this.getHostsForDestination(destination);
				for(var i=0, len=hosts.length; i < len; i++) {
					hosts[i].username = options.username;
				}
			}.bind(this));
		}
		if(options.debug) {
			this.config.debug = options.debug;
			this.flightplan.logger.enableDebug(this.config.debug);
		}
	},

	getDestinations: function() {
		return Object.keys(this.config.destinations);
	},

	getHostsForDestination: function(destination) {
		try {
			var hosts = this.config.destinations[destination];
			return (hosts instanceof Array) ? hosts : [hosts];
		} catch(e) {
			return null;
		}
	},

	hasDestination: function(destination) {
		try {
			return !!this.config.destinations[destination];
		} catch(e) {
			return false;
		}
	}
};

module.exports = Briefing;