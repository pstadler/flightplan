var proc = require('child_process');

module.exports = function (args, async) {
  args = './bin/fly.js ' + args;
  args = args.split(' ');
  var command = args.shift();

  var result = proc[async === true ? 'spawn' : 'spawnSync'](command, args, { encoding: 'utf8' });
  return result;
};
