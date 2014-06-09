var fs = require('fs')
  , gulp = require('gulp')
  , stylish = require('jshint-stylish')
  , jshint = require('gulp-jshint')
  , markdox = require('markdox');

var sourceFiles = ['*.js', 'lib/**/*.js', 'bin/**/*.js'];

gulp.task('lint', function() {
  var jshintOptions = {
    laxcomma: true,
    laxbreak: true,
    node: true,
    curly: true,
    camelcase: true,
    eqeqeq: true,
    maxdepth: 3,
    maxlen: 100,
    newcap: true,
    noempty: true,
    latedef: true,
    noarg: true,
    unused: true,
    trailing: true,
    indent: 2
  };
  return gulp.src(sourceFiles)
          .pipe(jshint(jshintOptions))
          .pipe(jshint.reporter(stylish));
});

gulp.task('docs', function(taskFinished) {
  var sources = ['lib/flightplan.js', 'lib/transport/index.js']
    , readme = 'README.md'
    , tmpFile = 'docs/API.md';

  var options = {
    template: 'docs/template.md.ejs',
    output: tmpFile
  };

  markdox.process(sources, options, function() {
    var docsStr = fs.readFileSync(tmpFile, 'utf8')
      , readmeStr = fs.readFileSync(readme, 'utf8');

    docsStr = docsStr
                .replace(/&lt;/g, "<")
                .replace(/&gt;/g, ">")
                .replace(/&#39;/g, "'")
                .replace(/&quot;/g, '"')
                .replace(/&amp;/g, '&');
    readmeStr = readmeStr.replace(/(<!-- DOCS -->)(?:\r|\n|.)+(<!-- ENDDOCS -->)/gm
                                                                          , "$1" + docsStr + "$2");

    fs.writeFileSync(readme, readmeStr);
    fs.unlinkSync(tmpFile);
    console.log('Documentation generated.');
    taskFinished();
  });
});

gulp.task('default', ['lint']);