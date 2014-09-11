#!/usr/bin/env bash

../bin/fly.js test1: -p param_test.js -o foo=bar

../bin/fly.js test2: -p param_test.js -o foo=bar1

../bin/fly.js test3: -p param_test.js -o foo=bar -o foo1=bar1