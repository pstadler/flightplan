var util = require('util')
  , Fiber = require('fibers')
  , Future = require('fibers/future')
  , Flight = require('./flight')
  , SSHTransport = require('./transport/ssh');

function RemoteFlight(flightplan, fn) {
  RemoteFlight.super_.call(this, flightplan, SSHTransport, fn);

  if(!this.flightplan.briefing()) {
    this.abort("You can't do remote flights without a briefing.");
  }
}

util.inherits(RemoteFlight, Flight);

RemoteFlight.prototype.__start = function() {
  var task = function(host) {
    var future = new Future();
    var flight = new RemoteFlight(this.flightplan, this.fn);
    new Fiber(function() {
      var t = process.hrtime();

      var transport = new flight.transportClass(flight, host);
      try {
        flight.fn(transport);
      } catch(e) {
        this.abort(e.message);
      } finally {
        transport.close();

        flight.status.executionTime = process.hrtime(t);
        this.status.executionTime = flight.status.executionTime;

        return future.return();
      }
    }.bind(this)).run();

    return future;
  }.bind(this);

  var tasks = [];
  for(var i=0, len=this.hosts.length; i < len; i++) {
    tasks.push(task(this.hosts[i]));
  }
  Future.wait(tasks);

  return this.status;
};



module.exports = RemoteFlight;