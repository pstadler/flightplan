function Briefing(flightplan, config) {
  this.flightplan = flightplan;
  config = config || {};
  this.debug = config.debug || false;
  this.destinations = config.destinations || {};
  this.flightplan.logger.enableDebug(this.debug);
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
    if(options.debug !== undefined && options.debug !== null) {
      this.debug = options.debug;
      this.flightplan.logger.enableDebug(this.debug);
    }
  },

  getDestinations: function() {
    return Object.keys(this.destinations);
  },

  getHostsForDestination: function(destination) {
    try {
      var hosts = this.destinations[destination];
      return (hosts instanceof Array) ? hosts : [hosts];
    } catch(e) {
      return null;
    }
  },

  hasDestination: function(destination) {
    try {
      return !!this.destinations[destination];
    } catch(e) {
      return false;
    }
  }
};

module.exports = Briefing;