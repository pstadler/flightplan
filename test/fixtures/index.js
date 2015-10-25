var HOST = {
  host: 'example.com'
};

var HOSTS = [
  {
    host: 'example.com'
  },
  {
    host: 'example.org'
  }
];

var DYNAMIC_HOST = function(done) {
  done(HOST);
};

var HOST_OPTIONS = {
  option1: 'value1'
};

module.exports = {
  HOST: HOST,
  HOSTS: HOSTS,
  DYNAMIC_HOST: DYNAMIC_HOST,
  HOST_OPTIONS: HOST_OPTIONS
};