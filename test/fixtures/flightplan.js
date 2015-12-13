var plan = require('../../index');

plan.target('test', {
  host: 'example.com'
});

plan.local(function() {
  /* noop */
});