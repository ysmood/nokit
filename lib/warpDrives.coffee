kit = require './kit'
{ _, Promise } = kit

module.exports =

	coffee: (opts) ->
		coffee = kit.requireOptional 'coffee-script', __dirname, '>1.8.0'

		->
			@dest.ext = '.js'
			@set coffee.compile @contents + '', opts

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
				process.stdout.write reporter.reportPath(path, errors)
				if errors.length > 0
					return Promise.reject errors[0]
