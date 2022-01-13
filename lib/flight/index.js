var local = require('./local'),
  remote = require('./remote');

var TYPE = Object.freeze({
  LOCAL: 1,
  REMOTE: 2,
});

exports.TYPE = TYPE;

exports.run = function (type, fn, context) {
  switch (type) {
    case TYPE.LOCAL:
      return local.run(fn, context);

    case TYPE.REMOTE:
      return remote.run(fn, context);
  }
};

exports.disconnect = function () {
  remote.disconnect();
};
