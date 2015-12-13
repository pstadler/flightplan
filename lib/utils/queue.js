module.exports = function() {
  var queue = {}
    , items = []
    , doneCallbacks = []
    , isRunning = false;

  queue.push = function(fn) {
    items.push(fn);
  };

  queue.next = function() {
    if(isRunning || items.length === 0) {
      return;
    }

    isRunning = true;

    var fn = items.shift();
    fn();
  };

  queue.done = function(callback) {
    if(callback) {
      doneCallbacks.push(callback);
    }

    isRunning = false;

    if(items.length === 0) {
      queue.end();

      return;
    }

    queue.next();
  };

  queue.end = function() {
    doneCallbacks.forEach(function(cb) {
      cb();
    });

    doneCallbacks = [];
  };

  return queue;
};
