var path = require('path');

var HOST = {
  host: 'example.com',
  port: 22
};

var HOSTS = [
  {
    host: 'example.com',
    port: 22
  },
  {
    host: 'example.org',
    port: 22022
  }
];

var DYNAMIC_HOST = function(done) {
  done(HOST);
};

var HOST_OPTIONS = {
  option1: 'value1'
};

var COMMAND_OPTIONS = {
  failsafe: true
};

var LOG_METHODS = ['user', 'info', 'success', 'warn', 'error', 'command',
                    'stdout', 'stdwarn', 'stderr', 'debug'];

var INTERACTIVE_PROMPTS = [
  {
    prompt: 'prompt1',
    echo: true
  },
  {
    prompt: 'prompt2',
    echo: false
  }
];

var PRIVATE_KEY_PATH = path.resolve(__dirname, 'private-key.txt');

module.exports = {
  HOST: HOST,
  HOSTS: HOSTS,
  DYNAMIC_HOST: DYNAMIC_HOST,
  HOST_OPTIONS: HOST_OPTIONS,
  COMMAND_OPTIONS: COMMAND_OPTIONS,
  LOG_METHODS: LOG_METHODS,
  INTERACTIVE_PROMPTS: INTERACTIVE_PROMPTS,
  PRIVATE_KEY_PATH: PRIVATE_KEY_PATH
};
