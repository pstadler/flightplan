var Fiber = require('fibers');

module.exports = function(fn) {
  new Fiber(fn).run();
};
