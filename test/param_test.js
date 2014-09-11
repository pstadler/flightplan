"use strict";
/*
This will startup a new stack and deploy the given app to it

fly deploy

*/

// flightplan.js
var Flightplan = require("../index");

var plan = new Flightplan();


plan.briefing({
  debug: false,
  destinations: {
  }
});


plan.local('test1', function(local) {
  console.log(plan.env);
  if (plan.env.foo == 'bar') {
  	local.echo('test1: PASSED!');
  } else {
  	console.error('foo =/= bar!')
  }
});


plan.local('test2', function(local) {
  console.log(plan.env);
  if (plan.env.foo != 'bar') {
  	local.echo('test2: PASSED!');
  } else {
  	console.error('foo == bar!')
  }
});


plan.local('test3', function(local) {
  console.log(plan.env);
  if (plan.env.foo == 'bar' &&  plan.env.foo1 == 'bar1') {
  	local.echo('test3: PASSED!');
  } else {
  	console.error('Need both foo and foo1 params')
  }
});
