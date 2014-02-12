var util = require('util');

var common = [
	'awk',
	'cat',
	'cd',
	'chgrp',
	'chmod',
	'chown',
	'cp',
	'echo',
	'find',
	'ftp',
	'grep',
	'kill',
	'ln',
	'whoami',
	'ls',
	'mkdir',
	'mv',
	'ps',
	'pwd',
	'rm',
	'rmdir',
	'scp',
	'sed',
	'tail',
	'tar',
	'touch',
	'unzip',
	'zip'
];

var extra = [
	'git',
	'hg',
	'node',
	'npm',
	'rsync',
	'svn'
];

module.exports = common.concat(extra);