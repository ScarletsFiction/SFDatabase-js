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

var browserjs = ['src/_head.js',
  'src/QueryBuilder/IDB.js',
  'src/QueryBuilder/SQL.js',
  'src/Structures/IDB.js',
  'src/Structures/WebSQL.js',
  'src/_foot.js'];

var nodejs = ['src/_head.js',
  'src/QueryBuilder/SQL.js',
  'src/Structures/MySQL.js',
  'src/_foot.js'];

gulp.task('browserjs', function(){
  return gulp.src(browserjs)
    .pipe(sourcemaps.init())
    .pipe(concat('SFDatabase.min.js'))
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


// for debugging: npm install --save-dev source-map-support
gulp.task('nodejs', function(){
  return gulp.src(nodejs)
    .pipe(sourcemaps.init())
    .pipe(concat('SFDatabase.node.js'))
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
  gulp.watch(browserjs, ['browserjs']);
  gulp.watch(nodejs, ['nodejs']);
});

gulp.task('serve', function() {
  browserSync({
    server: {
      baseDir: 'example'
    }
  });

  gulp.watch(['*.html', 'scripts/**/*.js'], {cwd: 'example'}, reload);
});

gulp.task('default', ['browserjs']);

function swallowError(error){
  console.log(error.message)
  this.emit('end')
}