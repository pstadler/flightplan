var plan = require('../../index');

plan.target('test', {
  host: 'example.com',
});

plan.local(async function (local) {
  await local.exec('test ""');
});
