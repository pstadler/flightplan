var fs = require('fs')
	, gulp = require('gulp')
	, stylish = require('jshint-stylish')
	, jshint = require('gulp-jshint')
	, markdox = require('markdox');

var sourceFiles = ['*.js', 'lib/**/*.js', 'bin/**/*.js'];

gulp.task('lint', function() {
	var jshintOptions = {
		laxcomma: true
	};
	return gulp.src(sourceFiles)
		.pipe(jshint(jshintOptions))
		.pipe(jshint.reporter(stylish));
});

gulp.task('docs', function(taskFinished) {
	var files = ['lib/flightplan.js', 'lib/transport/transport.js'];
	var options = {
		output: 'docs/API.md',
		template: 'docs/template.md.ejs'
	};

	markdox.process(files, options, function() {
		var apidocs = fs.readFileSync(options.output, 'utf8');

		apidocs = apidocs.replace(/&#39;/g, "'").replace(/&quot;/g, '"');

		fs.writeFileSync(options.output, apidocs);

		var readme = fs.readFileSync('README.md', 'utf8');
		readme = readme.replace(/<!-- DOCS -->(?:\r|\n|.)+<!-- ENDDOCS -->/gm, '<!-- DOCS -->' + apidocs +'<!-- ENDDOCS -->');

		fs.writeFileSync('README.md', readme);
		console.log('Documentation generated.');
		taskFinished();
	});
});

gulp.task('default', ['lint']);