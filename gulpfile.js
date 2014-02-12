var gulp = require('gulp')
	, stylish = require('jshint-stylish')
	, jshint = require('gulp-jshint');

var sourceFiles = ['*.js', 'lib/**/*.js', 'bin/**/*.js'];

gulp.task('lint', function() {
	var jshintOptions = {
		laxcomma: true
	};
	return gulp.src(sourceFiles)
		.pipe(jshint(jshintOptions))
		.pipe(jshint.reporter(stylish));
});

gulp.task('default', ['lint']);