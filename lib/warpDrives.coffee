kit = require './kit'
{ _, Promise } = kit
cls = kit.require 'colors/safe'

module.exports =

	reader: ->
		(if @isDir
			Promise.resolve()
		else
			kit.readFile @path, @opts.encoding
		).then @set

	writer: ->
		kit.log cls.cyan('write: ') + @path
		{ dest, contents } = @
		if dest? and contents?
			if _.isObject dest
				if dest.name? and dest.ext?
					dest.base = dest.name + dest.ext
				dest = kit.path.format dest

			kit.outputFile dest, contents, @opts

	concat: (name) ->
		all = ''

		concator = ->
			all += @contents
			@end()
		concator.onEnd = ->
			@dest = kit.path.join @to, name
			@set all
		concator

	coffee: (opts = {}) ->
		_.defaults opts, {
			bare: true
		}

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

	coffeelint: (opts = {}) ->
		_.defaults opts, {
			colorize: true
		}

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

	livescript: (opts = {}) ->
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
