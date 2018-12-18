var gulp = require('gulp');
var concat = require('gulp-concat');
var sourcemaps = require('gulp-sourcemaps');
var browserSync = require('browser-sync');
var reload = browserSync.reload;
var csso = require('gulp-csso');
var uglify = require('gulp-uglify-es').default;
var autoprefixer = require('gulp-autoprefixer');
var header = require('gulp-header');
var babel = require('gulp-babel');

gulp.task('js', function(){
  return gulp.src(['src/_head.js', 'src/QueryBuilder/*.js', 'src/Structures/*.js', 'src/_foot.js'])
    .pipe(sourcemaps.init())
    .pipe(concat('sfdatabase.min.js'))
    .pipe(babel({
      "presets": [
        [
          "@babel/preset-env",
          {
            "targets": {
              "ie": "9"
            },
            "loose":true,
            "modules": false
          }
        ]
      ]
    }))
    .on('error', swallowError)
    .pipe(uglify())
    .on('error', swallowError)
    .pipe(header(`/*
  SFDatabase-js
  SFDatabase-js is a database library that can help you
  build a SQL Query and execute it to the server from
  Nodejs or local browser with WebSQL.

  https://github.com/ScarletsFiction/SFDatabase-js
*/\n`))
    .pipe(sourcemaps.write('.'))
    .pipe(gulp.dest('dist'));
});

gulp.task('watch', function() {
  gulp.watch('src/**/*.js', ['js']);
});

gulp.task('serve', function() {
  browserSync({
    server: {
      baseDir: 'example'
    }
  });

  gulp.watch(['*.html', 'scripts/**/*.js'], {cwd: 'example'}, reload);
});

gulp.task('default', ['js']);

function swallowError(error){
  console.log(error.message)
  this.emit('end')
}