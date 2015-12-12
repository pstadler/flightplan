module.exports = function(stub, event, args) {
  args = Array.isArray(args) ? args : [args];

  setImmediate(function() {
    stub.withArgs(event).lastCall.args[1].apply(null, args);
  });
};
