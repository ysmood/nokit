kit = require './kit'
{ _, Promise } = kit
cls = kit.require 'colors/safe'

###*
 * The built-in plguins for warp. It's more like examples
 * to show how to use nokit efficiently.
###
Overview = 'drives'

module.exports =

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
			@dest.ext = '.js'
			try
				@set coffee.compile @contents + '', opts
				kit.log cls.cyan('compile coffee: ') + @path
			catch err
				kit.err cls.red err.stack
				Promise.reject 'coffeescriptCompileError'
	, compiler: ['.coffee']

	###*
	 * coffeelint processor
	 * @param  {Object} opts Default is `{ colorize: true }`.
	 * @return {Function}
	###
	coffeelint: (opts = {}) ->
		_.defaults opts,
			colorize: true

		coffeelint = kit.requireOptional 'coffeelint', __dirname

		if not opts.config
			configfinder = require 'coffeelint/lib/configfinder'
			opts.config = configfinder.getConfig()

		Reporter = require 'coffeelint/lib/reporters/default'

		->
			errorReport = new coffeelint.getErrorReport()
			errorReport.lint @path, @contents, opts.config
			reporter = new Reporter errorReport, opts

			for path, errors of errorReport.paths
				kit.log cls.cyan('coffeelint: ') + _.trim reporter.reportPath(path, errors)
				if errors.length > 0
					return Promise.reject errors[0]

	###*
	 * Parse commment from a js or coffee file, and output a markdown string.
	 * @param  {String} path
	 * @param  {Object} opts Defaults:
	 * ```coffee
	 * {
	 * 	parseComment: {}
	 * 	formatComment: {
	 * 		name: ({ name, line }) ->
	 * 			name = name.replace 'self.', ''
	 * 			link = "#{path}?source#L#{line}"
	 * 			"- \#\#\# **[#{name}](#{link})**\n\n"
	 * 	}
	 * }
	 * ```
	 * @return {Function}
	###
	comment2md: (opts = {}) ->
		_.defaults opts,
			out: 'readme.md'
			tpl: 'readme.tpl.md'
			h: 3
			parseComment: {}
			formatComment: {}

		doc = {}

		_.extend (file) ->
			opts.formatComment.name = ({ name, line }) ->
				name = name.replace 'self.', ''
				link = "#{file.path}?source#L#{line}"
				"- #{_.repeat '#', opts.h} **[#{name}](#{link})**\n\n"

			comments = kit.parseComment @contents, opts.parseComment
			doc[@path] = kit.formatComment comments, opts.formatComment

			@end()
		, onEnd: (file) ->
			@dest = kit.path.join @to, opts.out

			kit.readFile opts.tpl, 'utf8'
			.then (tpl) ->
				file.set _.template(tpl) { doc }

	###*
	 * Auto-compiler file by extension.
	 * Supports: `.coffee`, `.ls`, `stylus`.
	 * You can extend `kit.drives` to let it support more.
	 * ```coffee
	 * kit.drives.myCompiler = kit._.extend ->
	 * 	# your compile logic
	 * , compiler: ['.jsx']
	 * ```
	 * @param  {Object} opts
	 * @return {Function}
	###
	compiler: (opts = {}) ->
		compilers = {}
		->
			ext = @xpath.ext.toLowerCase()
			if not compilers[ext]
				d = _.find kit.drives, (drive) ->
					drive.compiler.indexOf(ext) > -1
				if d
					compilers[ext] = d opts[ext] or opts
				else
					return Promise.reject new Error "no drive
						can match extension: '#{ext}'"

			compilers[ext].call @, @

	###*
	 * a batch file concat helper
	 * @param {String} name The output file path.
	 * @param {String} dir Optional. Override the dest of warp's.
	 * @return {Function}
	###
	concat: (name, dir) ->
		all = ''

		_.extend ->
			all += @contents
			@end()
		, onEnd: ->
			dir ?= @to
			@dest = kit.path.join dir, name
			@set all

	###*
	 * livescript compiler
	 * @param  {Object} opts Default is `{ bare: true }`.
	 * @return {Function}
	###
	livescript: _.extend (opts = {}) ->
		_.defaults opts, {
			bare: true
		}

		Livescript = kit.requireOptional 'Livescript', __dirname, '>=1.2.0'

		->
			opts.filename = @path
			@dest.ext = '.js'
			try
				@set Livescript.compile @contents + '', opts
				kit.log cls.cyan('livescript coffee: ') + @path
			catch err
				kit.err cls.red err
				Promise.reject 'livescriptCompileError'
	, compiler: ['.ls']

	###*
	 * read file and set `contents`
	###
	reader: ->
		(if @isDir
			Promise.resolve()
		else
			kit.readFile @path, @opts.encoding
		).then @set

	###*
	 * compile stylus
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
				file.set css
				kit.log cls.cyan('compile stylus: ') + file.path
	, compiler: ['.styl']

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
	uglify: (opts = {}) ->
		uglify = kit.requireOptional 'uglify-js', __dirname, '>=2.0.0'
		opts.fromString = true
		opts.output ?=
			comments: (node, comment) ->
				text = comment.value
				type = comment.type
				if type == "comment2"
					return /@preserve|@license|@cc_on/i.test text

		-> @set (uglify.minify @contents, opts).code

	###*
	 * output file by `contents` and `dest`
	###
	writer: ->
		{ dest, contents } = @
		if dest? and contents?
			if _.isObject dest
				if dest.name? and dest.ext?
					dest.base = dest.name + dest.ext
				dest = kit.path.format dest

			kit.log cls.cyan('writer: ') + dest
			kit.outputFile dest, contents, @opts
