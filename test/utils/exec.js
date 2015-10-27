var proc = require('child_process');

var EXEC_COUNT = 0;

module.exports = function (args, async) {
  var cmdPrefix = process.env.running_under_istanbul
    ? './node_modules/.bin/istanbul cover --dir coverage/fly/' + (EXEC_COUNT++) +
      ' --report lcovonly --print none '
    : '';
  var argsSeparator = process.env.running_under_istanbul
    ? ' -- '
    : ' ';

  args = cmdPrefix + './bin/fly.js' + argsSeparator + args;
  args = args.split(' ');
  var command = args.shift();

  var result = proc[async === true ? 'spawn' : 'spawnSync'](command, args, { encoding: 'utf8' });
  return result;
};