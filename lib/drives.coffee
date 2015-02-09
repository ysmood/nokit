kit = require './kit'
{ _, Promise } = kit
cls = kit.require 'colors/safe'
jhash = null

###*
 * The built-in plguins for warp. It's more like examples
 * to show how to use nokit efficiently.
###
Overview = 'drives'

module.exports =

	###*
	 * clean-css
	 * @param  {Object} opts
	 * @return {Function}
	###
	cleanCss: _.extend (opts = {}) ->
		clean = kit.requireOptional 'clean-css', __dirname

		->
			@deps = [@path]
			@set (new clean(opts).minify @contents).styles
			kit.log cls.cyan('clean css: ') + @dest
	, compress: ['.css']

	###*
	 * coffee-script compiler
	 * @param  {Object} opts Default is `{ bare: true }`.
	 * @return {Function}
	###
	coffee: _.extend (opts = {}) ->
		_.defaults opts,
			bare: true

		coffee = kit.requireOptional 'coffee-script', __dirname, '>=1.8.0'

		->
			opts.filename = @path
			@deps = [@path]
			@dest.ext = '.js'
			try
				@set coffee.compile @contents + '', opts
				kit.log cls.cyan('coffee: ') + @path
			catch err
				kit.err cls.red err.stack
				Promise.reject 'coffeescriptCompileError'
	, compile: ['.coffee']

	###*
	 * coffeelint processor
	 * @param  {Object} opts It extends the default config
	 * of coffeelint, properties:
	 * ```coffee
	 * {
	 * 	colorize: true
	 * 	reporter: 'default'
	 *
	 * 	# The json of the "coffeelint.json".
	 * 	# If it's null, coffeelint will try to find
	 * 	# "coffeelint.json" as its content.
	 * 	config: null | JSON | JsonFilePath
	 * }
	 * ```
	 * @return {Function}
	###
	coffeelint: _.extend (opts = {}) ->
		_.defaults opts,
			colorize: true
			reporter: 'default'

		coffeelint = kit.requireOptional 'coffeelint', __dirname

		if not opts.config
			configfinder = require 'coffeelint/lib/configfinder'
			opts.config = configfinder.getConfig()

		if _.isString opts.config
			opts.config = kit.readJsonSync opts.config

		Reporter = require 'coffeelint/lib/reporters/' + opts.reporter

		->
			@deps = [@path]
			errorReport = new coffeelint.getErrorReport()
			errorReport.lint @path, @contents, opts.config
			reporter = new Reporter errorReport, opts

			for path, errors of errorReport.paths
				kit.log cls.cyan('coffeelint: ') + _.trim reporter.reportPath(path, errors)
				if errors.length > 0
					return Promise.reject errors[0]
	, lint: ['.coffee']

	###*
	 * Parse commment from a js, coffee, or livescript file,
	 * and output a markdown string.
	 * @param  {String} path
	 * @param  {Object} opts Defaults:
	 * ```coffee
	 * {
	 * 	# Output doc path.
	 * 	out: 'readme.md'
	 *
	 * 	# jst template path.
	 * 	tpl: 'readme.jst.md'
	 *
	 * 	# Init doc info.
	 * 	doc: {}
	 *
	 * 	# Header size.
	 * 	h: 3
	 *
	 * 	parseComment: -> ...
	 * 	formatComment: -> ...
	 * }
	 * ```
	 * @return {Function}
	 * @example
	 * The nofile of nokit shows how to use it.
	###
	comment2md: (opts = {}) ->
		_.defaults opts,
			out: 'readme.md'
			tpl: 'readme.jst.md'
			doc: {}
			h: 3
			parseComment: {}
			formatComment: {}

		_.extend (file) ->
			if @isWarpEnd
				return if _.keys(opts.doc).length < @list.length

				writer = kit.drives.writer opts

				@deps = _.pluck @list, 'path'
				@deps.push opts.tpl

				@dest = kit.path.join @to, opts.out

				return kit.readFile opts.tpl, 'utf8'
				.then (tpl) ->
					file.set _.template(tpl) { doc: opts.doc }
				.then ->
					kit.log cls.cyan('comment2md: ') +
						kit.path.join(file.to, opts.out)
					writer.call file, file

			opts.formatComment.name = ({ name, line }) ->
				name = name.replace 'self.', ''
				link = "#{file.path}?source#L#{line}"
				"- #{_.repeat '#', opts.h} **[#{name}](#{link})**\n\n"

			comments = kit.parseComment @contents + '', opts.parseComment
			opts.doc[@path] = kit.formatComment comments, opts.formatComment

		, isWriter: true

	###*
	 * Auto-compiler file by extension. It will search through
	 * `kit.drives`, and find proper drive to run the task.
	 * You can extend `kit.drives` to let it support more.
	 * For example:
	 * ```coffee
	 * kit.drives.myCompiler = kit._.extend ->
	 * 	# your compile logic
	 * , compiler: ['.jsx']
	 * ```
	 * @param {String} action By default, it can be
	 * 'compile' or 'compress' or 'lint'
	 * @param  {Object} opts
	 * ```coffee
	 * {
	 * 	# If no compiler match.
	 * 	onNotFound: (fileInfo) ->
	 * }
	 * ```
	 * @return {Function}
	###
	auto: (action, opts = {}) ->
		_.defaults opts,
			onNotFound: ->

		list = _(kit.drives).map(action)
			.compact().flatten().value().join ' '
		kit.log cls.green("#{action}: ") + "[ #{list} ]"

		compilers = {}
		auto = ->
			ext = @dest.ext.toLowerCase()
			if not compilers[ext]
				d = _.find kit.drives, (drive) ->
					drive[action] and
					drive[action].indexOf(ext) > -1
				if d
					compilers[ext] = d opts[ext]
				else
					return opts.onNotFound.call @, @

			compilers[ext].call @, @

		# For hash
		_str = auto.toString
		auto.toString = ->
			hash = _str.call auto
			hash += JSON.stringify opts

		auto

	###*
	 * a batch file concat helper
	 * @param {String} name The output file path.
	 * @param {String} dir Optional. Override the dest of warp's.
	 * @return {Function}
	###
	concat: (name, dir) ->
		all = []

		_.extend ->
			if @isWarpEnd
				return if all.length < @list.length

				dir ?= @to
				@dest = kit.path.join dir, name
				@deps = _.pluck @list, 'path'
				@set all.join '\n'
				kit.drives.writer(@opts).call @, @
			else
				all.push @contents
				kit.log cls.cyan('concat: ') + @path
		, isWriter: true

	###*
	 * Lint js via `jshint`.
	 * @param  {Object} opts Properties:
	 * ```coffee
	 * {
	 * 	global: null
	 * 	config: null | JSON | JsonFilePath
	 * }
	 * ```
	 * @return {Function}
	###
	jshint: _.extend (opts = {}) ->
		_.defaults opts, {}

		{ JSHINT } = kit.requireOptional 'jshint', __dirname

		if _.isString opts.config
			opts.config = kit.readJsonSync opts.config

		(file) ->
			@deps = [@path]
			if JSHINT @contents, opts.config, opts.global
				kit.log cls.cyan('jshint: ') + @path
				return

			errs = ''
			JSHINT.errors.forEach (err) ->
				if err
					errs += """\nJshint #{cls.red err.id}: \
						#{file.path}:#{err.line}:#{err.character}
						"#{cls.cyan err.evidence}"
						#{cls.yellow err.reason}
						------------------------------------
					"""
			Promise.reject errs
	, lint: ['.js']

	###*
	 * Compile less.
	 * @param  {Object}
	 * @return {Function}
	###
	less: _.extend (opts = {}) ->
		less = kit.requireOptional 'less', __dirname, '>=2.0.0'

		(file) ->
			@dest.ext = '.css'
			opts.filename = @path
			less.render @contents + '', opts
			.then (output) ->
				file.deps = _.keys output.imports
				file.set output.css
				kit.log cls.cyan('less: ') + file.path
			, (err) ->
				if not err.line?
					return Promise.reject err
				# The error message of less is the worst.
				err.message = err.filename +
					":#{err.line}:#{err.column}\n" +
					err.extract?.join('\n') + '\n--------\n' +
					err.message
				Promise.reject err
	, compile: ['.less']

	###*
	 * LiveScript compiler.
	 * @param  {Object} opts Default is `{ bare: true }`.
	 * @return {Function}
	###
	livescript: _.extend (opts = {}) ->
		_.defaults opts, {
			bare: true
		}

		LiveScript = kit.requireOptional 'LiveScript', __dirname, '>=1.2.0'

		->
			@deps = [@path]
			opts.filename = @path
			@dest.ext = '.js'
			try
				@set LiveScript.compile @contents + '', opts
				kit.log cls.cyan('livescript: ') + @path
			catch err
				kit.err cls.red err
				Promise.reject 'livescriptCompileError'
	, compile: ['.ls']

	###*
	 * mocha test
	 * @param  {Object} opts
	 * ```
	 * {
	 * 	timeout: 5000
	 * }
	 * ```
	 * @return {Function}
	###
	mocha: (opts = {}) ->
		_.defaults opts,
			timeout: 5000

		Mocha = kit.requireOptional 'mocha', __dirname
		mocha = new Mocha opts

		_.extend ->
			if @isWarpEnd
				return new Promise (resolve, reject) ->
					mocha.run (code) ->
						if code == 0
							resolve()
						else
							reject { code }
			else
				mocha.addFile @path
				@tasks.length = 0
		, isReader: true, isWriter: true

	###*
	 * read file and set `contents`
	 * @param  {Object} opts Defaults:
	 * ```coffee
	 * {
	 * 	isCache: true
	 * 	endcoding: 'utf8'
	 * }
	 * ```
	 * @return {Function}
	###
	reader: (opts = {}) ->
		_.defaults opts, {
			isCache: true
			encoding: 'utf8'
		}

		jhash ?= new (kit.require('jhash').constructor)

		# Create a unique id for each workflow.
		hashDrives = (ds) ->
			str = _.map(ds, (d) -> d.toString()).join()
			jhash.hash(str, true) + ''

		read = ->
			kit.readFile @path, opts.encoding
			.then @set

		cacheDir = null

		_.extend (file) ->
			if cacheDir == null
				cacheDir = kit.path.join @opts.cacheDir,
					hashDrives @opts.driveList
				@opts.cacheDir = cacheDir

			return if @isDir
			if opts.isCache
				kit.depsCache
					deps: [@path]
					cacheDir: cacheDir
				.then (cache) ->
					file.deps = cache.deps
					if cache.isNewer
						kit.log cls.green('reader cache: ') +
							file.deps.join cls.grey ', '
						file.tasks.length = 0

						kit.mkdirs kit.path.dirname cache.dest
						.then ->
							kit.link cache.path, cache.dest
							.catch (err) ->
								if err.code != 'EEXIST'
									Promise.reject err
					else
						read.call file
			else
				read.call file
		, isReader: true

	###*
	 * Compile stylus.
	 * @param  {Object} opts It will use `stylus.set` to
	 * iterate `opts` and set the key-value, is the value is
	 * not a function.
	 * ```coffee
	 * {
	 * 	config: (styl) ->
	 * }
	 * ```
	 * @return {Function}
	 * @example
	 * ```coffee
	 * kit.drives.stylus {
	 * 	compress: true
	 * 	config: (styl) ->
	 * 		styl.define 'jack', 'a persion'
	 * }
	 * ```
	###
	stylus: _.extend (opts = {}) ->
		_.defaults opts,
			config: ->

		stylus = kit.requireOptional 'stylus', __dirname

		(file) ->
			@dest.ext = '.css'

			styl = stylus @contents
				.set 'filename', @path

			for k, v of opts
				continue if _.isFunction v
				styl.set k, v

			opts.config.call @, styl

			kit.promisify(styl.render, styl)()
			.then (css) ->
				file.deps = styl.deps()
				file.set css
				kit.log cls.cyan('stylus: ') + file.path
	, compile: ['.styl']

	###*
	 * uglify-js processor
	 * @param  {Object} opts Defaults:
	 * ```coffee
	 * {
	 * 	output:
	 * 		comments: (node, comment) ->
	 * 			text = comment.value
	 * 			type = comment.type
	 * 			if type == "comment2"
	 * 				return /@preserve|@license|@cc_on/i.test text
	 * }
	 * ```
	 * @return {Function}
	###
	uglifyjs: _.extend (opts = {}) ->
		uglify = kit.requireOptional 'uglify-js', __dirname, '>=2.0.0'
		opts.fromString = true
		opts.output ?=
			comments: (node, comment) ->
				text = comment.value
				type = comment.type
				if type == "comment2"
					return /@preserve|@license|@cc_on/i.test text

		->
			@deps = [@path]
			@set (uglify.minify @contents + '', opts).code
			kit.log cls.cyan('uglifyjs: ') + @dest
	, compress: ['.js']

	###*
	 * Output file by `contents` and `dest`.
	 * If the 'ext' or 'name' is not null,
	 * the 'base' will be override by the 'ext' and 'name'.
	 * @param  {Object} opts Defaults:
	 * ```coffee
	 * {
	 * 	isCache: true
	 * }
	 * ```
	 * @return {Function}
	###
	writer: (opts = {}) ->
		_.defaults opts, {
			isCache: true
		}

		write = ->
			{ dest, contents } = @
			return if not dest? or not contents?

			kit.log cls.cyan('writer: ') + @dest
			p = kit.outputFile dest + '', contents, @opts

			if not opts.isCache or not @deps
				return p

			kit.log cls.cyan('writer cache: ') + @dest
			pCache = kit.depsCache
				dest: @dest + ''
				deps: @deps
				cacheDir: @opts.cacheDir

			Promise.all [p, pCache]

		_.extend write, isWriter: true
