var
log          = require( "fancy-log" ),
chalk        = require( "chalk" ),
notifier     = require( "node-notifier" ),
argv         = require( "minimist" )( process.argv.slice( 2 ) ),

gulp         = require( "gulp" ),
plumber      = require( "gulp-plumber" ),
jshint       = require( "gulp-jshint" ),
uglify       = require( "gulp-uglify" ),
concat       = require( "gulp-concat" ),

sassglob     = require( "gulp-sass-glob" ),
sass         = require( "gulp-sass" ),
postcss      = require( "gulp-postcss" ),

autoprefixer = require( "autoprefixer" ),
mqpacker     = require( "css-mqpacker" ),
pixrem       = require( "pixrem" ),
rgba         = require( "postcss-color-rgba-fallback" ),
reporter     = require( "postcss-reporter" );

var stream = (function () {
	function onError( error ) {
		notifier.notify({
			title  : error.plugin || "Error",
			message: error.message
		});

		log( error.message );
	}

	return function stream( args ) {
		var src = gulp.src( args.src, { base: args.base } ).pipe( plumber( onError ) );

		if ( args.pipes ) {
			args.pipes.forEach(function ( pipe ) {
				if ( pipe )
					src = src.pipe( pipe );
			});
		}

		if ( args.dest )
			src = src.pipe( gulp.dest( args.dest ) );

		return src;
	};
})();

var tasks = {
	styles: function ( args ) {
		return stream({
			src  : "src/styles/style.scss",
			base : "src",
			dest : "dist",
			pipes: [
				sassglob(),
				sass({
					sourceComments: args.minify,
					outputStyle   : args.minify ? "compressed" : "expanded",
					indentType    : "tab",
					indentWidth   : 1
				}),
				postcss([
					autoprefixer({
						browsers: [ "> 0.1%" ]
					}),
					mqpacker({ sort: true }),
					pixrem( 16, { atrules: true } ),
					rgba(),
					reporter()
				])
			]
		});
	},

	script: function ( args ) {
		return stream({
			src  : [ "src/js/vendor/*.js", "src/js/**/*.js", "src/js/*.js" ],
			base : "src/js",
			dest : "dist/js",
			pipes: [
				jshint(),
				jshint.reporter( "jshint-stylish" ),
				jshint.reporter( "fail" ),
				concat( "main.js" ),
				args.minify ? uglify() : null
			]
		});
	}
};

gulp.task( "script", function () {
	return tasks.script({ minify: argv.minify });
});

gulp.task( "styles", function () {
	return tasks.styles({ minify: argv.minify });
});

gulp.task( "build", function () {
	var args = {
		minify: argv.minify || this.seq.indexOf( "package" ) !== -1
	};

	return require( "merge-stream" )(
		tasks.script( args ),
		tasks.styles( args )
	);
});

gulp.task( "package", [ "build" ], function () {
	return stream({
		dest: "_package",
		src : [
			"**",
			"!.*",
			"!*.md",
			"!*.log",
			"!build{,/**}",
			"!gulpfile.js",
			"!browserSync.json",
			"!node_modules{,/**}"
		]
	});
});

gulp.task( "watch", function () {
	var browserSync;
	var opts;

	try {
		opts        = require( "./browserSync.json" );
		browserSync = require( "browser-sync" ).create();
		browserSync.init( opts );
	} catch ( error ) {}

	gulp.watch("*.html", function() {
		log("Reloading HTML");
		if(browserSync) {
			browserSync.reload();
		}
	});

	gulp.watch( "src/styles/**/*.scss", function () {
		log( "Starting", chalk.magenta( "styles" ) );

		tasks.styles({ minify: false }).on( "end", function () {
			log( "Finished", chalk.magenta( "styles" ) );

			if(browserSync) {
				browserSync.reload( "dist/styles/style.css" );
			}
		});
	});

	gulp.watch( "src/js/**/*.js", function () {
		log( "Starting", chalk.magenta( "script" ) );

		tasks.script({ minify: false }).on( "end", function () {
			log( "Finished", chalk.magenta( "script" ) );

			if(browserSync) {
				browserSync.reload();
			}
		});
	});
});

gulp.task( "default", [ "build", "watch" ] );
