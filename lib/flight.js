var Fiber = require('fibers')
  , Future = require('fibers/future');

function Flight(flightplan, transportClass, fn) {
  this.flightplan = flightplan;
  this.fn = fn;
  this.transportClass = transportClass;
  this.logger = flightplan.logger;
  this.hosts = null;
  this.status = {
    aborted: false,
    crashRecordings: null,
    executionTime: 0 // milliseconds
  };
}

Flight.prototype = {

  start: function(destination) {
    this.hosts = this.flightplan.briefing().getHostsForDestination(destination);
    this.__start();
    return this.getStatus();
  },

  abort: function(msg) {
    this.status.aborted = true;
    this.status.crashRecordings = msg;
    this.flightplan.abort();
    throw new Error(msg);
  },

  isAborted: function() {
    return this.status.aborted;
  },

  getStatus: function() {
    return this.status;
  },

  __start: function() {
    var future = new Future();

    var task = function() {
      new Fiber(function() {
        var t = process.hrtime();

        var transport = new this.transportClass(this);
        try {
          this.fn(transport);
        } catch(e) {
          this.abort(e.message);
        } finally {
          transport.close();

          this.status.executionTime = process.hrtime(t);

          return future.return();
        }

      }.bind(this)).run();

      return future;
    }.bind(this);

    Future.wait(task());
  }
};

module.exports = Flight;