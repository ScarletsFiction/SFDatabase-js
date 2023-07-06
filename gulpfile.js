var gulp = require('gulp');
var concat = require('gulp-concat');
var sourcemaps = require('gulp-sourcemaps');
var browserSync = require('browser-sync');
var reload = browserSync.reload;
var terser = require('gulp-terser');
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
  'src/Structures/SQLite3.js',
  'src/_foot.js'];

gulp.task('browserjs', function(){
  return gulp.src(browserjs)
    .pipe(sourcemaps.init())
    .pipe(concat('sfdatabase.min.js'))
    .pipe(babel({
      "presets": [
        [
          "@babel/preset-env",
          {
            "targets": {
              "chrome": "50"
            },
            "modules": false,
            "loose": false,
            "shippedProposals": true
          }
        ]
      ]
    }))
    .on('error', swallowError)
    .pipe(terser())
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
    .pipe(concat('sfdatabase.node.js'))
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
  gulp.watch(browserjs, gulp.parallel(['browserjs', 'nodejs']));
});

gulp.task('serve', function() {
  browserSync({
		ghostMode: false, // Use synchronization between browser?
		ui: false,
		open: false,
    server: {
      baseDir: 'example',
      routes: {
          "/dist": "dist"
      }
    }
  });

  console.log("Please modify one file from /src to trigger the first build");
  // gulp.watch(['*.html', 'src/**/*.js'], {cwd: 'example'}, reload);
  gulp.watch(['*.html', 'src/**/*.js'], gulp.parallel([
    'browserjs', 'nodejs'
  ]));
});

gulp.task('default', gulp.parallel(['browserjs', 'nodejs']));

function swallowError(error){
  console.log(error.message)
  this.emit('end')
}