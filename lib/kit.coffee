colors = require 'colors'
_ = require 'lodash'
Promise = require 'bluebird'
fs = require 'fs-more'

###*
 * All the async functions in `kit` return promise object.
 * Most time I use it to handle files and system staffs.
 * @type {Object}
###
kit = {}

###*
 * kit extends all the promise functions of [fs-more][fs-more].
 * [fs-more]: https://github.com/ysmood/fs-more
 * @example
 * ```coffee
 * kit.readFile('test.txt').done (str) ->
 * 	console.log str
 *
 * kit.outputFile('a.txt', 'test').done()
 * ```
###
kitExtendsFsPromise = 'promise'
for k, v of fs
	if k.slice(-1) == 'P'
		kit[k.slice(0, -1)] = fs[k]

_.extend kit, {

	###*
	 * The lodash lib.
	 * @type {Object}
	###
	_: _

	requireCache: {}

	###*
	 * An throttle version of `Promise.all`, it runs all the tasks under
	 * a concurrent limitation.
	 * @param  {Int} limit The max task to run at the same time. It's optional.
	 * Default is Infinity.
	 * @param  {Array | Function} list
	 * If the list is an array, it should be a list of functions or promises,
	 * and each function will return a promise.
	 * If the list is a function, it should be a iterator that returns
	 * a promise, hen it returns `undefined`, the iteration ends.
	 * @param {Boolean} saveResutls Whether to save each promise's result or
	 * not. Default is true.
	 * @param {Function} progress If a task ends, the resolve value will be
	 * passed to this function.
	 * @return {Promise}
	 * @example
	 * ```coffee
	 * urls = [
	 * 	'http://a.com'
	 * 	'http://b.com'
	 * 	'http://c.com'
	 * 	'http://d.com'
	 * ]
	 * tasks = [
	 * 	-> kit.request url[0]
	 * 	-> kit.request url[1]
	 * 	-> kit.request url[2]
	 * 	-> kit.request url[3]
	 * ]
	 *
	 * kit.async(tasks).then ->
	 * 	kit.log 'all done!'
	 *
	 * kit.async(2, tasks).then ->
	 * 	kit.log 'max concurrent limit is 2'
	 *
	 * kit.async 3, ->
	 * 	url = urls.pop()
	 * 	if url
	 * 		kit.request url
	 * .then ->
	 * 	kit.log 'all done!'
	 * ```
	###
	async: (limit, list, saveResutls, progress) ->
		from = 0
		resutls = []
		iterIndex = 0
		running = 0
		isIterDone = false

		if not _.isNumber limit
			progress = saveResutls
			saveResutls = list
			list = limit
			limit = Infinity

		saveResutls ?= true

		if _.isArray list
			listLen = list.length - 1
			iter = (i) ->
				return if i > listLen
				if _.isFunction list[i]
					list[i](i)
				else
					list[i]

		else if _.isFunction list
			iter = list
		else
			Promise.reject new Error('unknown list type: ' + typeof list)

		new Promise (resolve, reject) ->
			addTask = ->
				task = iter(iterIndex++)
				if isIterDone or task == undefined
					isIterDone = true
					allDone() if running == 0
					return false

				if _.isFunction(task.then)
					p = task
				else
					p = Promise.resolve task

				running++
				p.then (ret) ->
					running--
					if saveResutls
						resutls.push ret
					progress? ret
					addTask()
				.catch (err) ->
					running--
					reject err

				return true

			allDone = ->
				if saveResutls
					resolve resutls
				else
					resolve()

			for i in [0 ... limit]
				break if not addTask()

	###*
	 * Creates a function that is the composition of the provided functions.
	 * Besides it can also accept async function that returns promise.
	 * It's more powerful than `_.compose`.
	 * @param  {Function | Array} fns Functions that return
	 * promise or any value.
	 * And the array can also contains promises.
	 * @return {Function} A composed function that will return a promise.
	 * @example
	 * ```coffee
	 * # It helps to decouple sequential pipeline code logic.
	 *
	 * createUrl = (name) ->
	 * 	return "http://test.com/" + name
	 *
	 * curl = (url) ->
	 * 	kit.request(url).then ->
	 * 		kit.log 'get'
	 *
	 * save = (str) ->
	 * 	kit.outputFile('a.txt', str).then ->
	 * 		kit.log 'saved'
	 *
	 * download = kit.compose createUrl, curl, save
	 * # same as "download = kit.compose [createUrl, curl, save]"
	 *
	 * download 'home'
	 * ```
	###
	compose: (fns...) -> (val) ->
		fns = fns[0] if _.isArray fns[0]

		fns.reduce (preFn, fn) ->
			if _.isFunction fn.then
				preFn.then -> fn
			else
				preFn.then fn
		, Promise.resolve(val)

	###*
	 * Daemonize a program.
	 * @param  {Object} opts Defaults:
	 * {
	 * 	bin: 'node'
	 * 	args: ['app.js']
	 * 	stdout: 'stdout.log'
	 * 	stderr: 'stderr.log'
	 * }
	 * @return {Porcess} The daemonized process.
	###
	daemonize: (opts = {}) ->
		_.defaults opts, {
			bin: 'node'
			args: ['app.js']
			stdout: 'stdout.log'
			stderr: 'stderr.log'
		}

		outLog = os.openSync(opts.stdout, 'a')
		errLog = os.openSync(opts.stderr, 'a')

		p = kit.spawn(opts.bin, opts.args, {
			detached: true
			stdio: [ 'ignore', outLog, errLog ]
		}).process
		p.unref()
		kit.log "Run as background daemon, PID: #{p.pid}".yellow
		p

	###*
	 * A simple decrypt helper
	 * @param  {Any} data
	 * @param  {String | Buffer} password
	 * @param  {String} algorithm Default is 'aes128'.
	 * @return {Buffer}
	###
	decrypt: (data, password, algorithm = 'aes128') ->
		crypto = kit.require 'crypto'
		decipher = crypto.createDecipher algorithm, password

		if kit.nodeVersion() < 0.10
			if Buffer.isBuffer data
				data = data.toString 'binary'
			new Buffer(
				decipher.update(data, 'binary') + decipher.final()
				'binary'
			)
		else
			if not Buffer.isBuffer data
				data = new Buffer(data)
			Buffer.concat [decipher.update(data), decipher.final()]

	###*
	 * A simple encrypt helper
	 * @param  {Any} data
	 * @param  {String | Buffer} password
	 * @param  {String} algorithm Default is 'aes128'.
	 * @return {Buffer}
	###
	encrypt: (data, password, algorithm = 'aes128') ->
		crypto = kit.require 'crypto'
		cipher = crypto.createCipher algorithm, password

		if kit.nodeVersion() < 0.10
			if Buffer.isBuffer data
				data = data.toString 'binary'
			new Buffer(
				cipher.update(data, 'binary') + cipher.final()
				'binary'
			)
		else
			if not Buffer.isBuffer data
				data = new Buffer(data)
			Buffer.concat [cipher.update(data), cipher.final()]

	###*
	 * A log error shortcut for `kit.log(msg, 'error', opts)`
	 * @param  {Any} msg
	 * @param  {Object} opts
	###
	err: (msg, opts = {}) ->
		kit.log msg, 'error', opts

	###*
	 * A better `child_process.exec`.
	 * @param  {String} cmd   Shell commands.
	 * @param  {String} shell Shell name. Such as `bash`, `zsh`. Optinal.
	 * @return {Promise} Resolves when the process's stdio is drained.
	 * @example
	 * ```coffee
	 * kit.exec """
	 * a=10
	 * echo $a
	 * """
	 *
	 * # Bash doesn't support "**" recusive match pattern.
	 * kit.exec """
	 * echo **\/*.css
	 * """, 'zsh'
	 * ```
	###
	exec: (cmd, shell) ->
		stream = kit.require 'stream'

		shell = process.env.SHELL or
			process.env.ComSpec or
			process.env.COMSPEC

		cmdStream = new stream.Transform
		cmdStream.push cmd
		cmdStream.end()

		stdout = ''
		outStream = new stream.Writable
		outStream._write = (chunk) ->
			stdout += chunk

		stderr = ''
		errStream = new stream.Writable
		errStream._write = (chunk) ->
			stderr += chunk

		p = kit.spawn shell, [], {
			stdio: 'pipe'
		}
		cmdStream.pipe p.process.stdin
		p.process.stdout.pipe outStream
		p.process.stderr.pipe errStream

		p.then (msg) ->
			_.extend msg, { stdout, stderr }

	###*
	 * See my project [fs-more][fs-more].
	 * [fs-more]: https://github.com/ysmood/fs-more
	###
	fs: fs

	###*
	 * A scaffolding helper to generate template project.
	 * The `lib/cli.coffee` used it as an example.
	 * @param  {Object} opts Defaults:
	 * ```coffee
	 * {
	 * 	srcDir: null
	 * 	patterns: '**'
	 * 	destDir: null
	 * 	data: {}
	 * 	compile: (str, data, path) ->
	 * 		compile str
	 * }
	 * ```
	 * @return {Promise}
	###
	generateBone: (opts) ->
		###
			It will treat all the files in the path as an ejs file
		###
		_.defaults opts, {
			srcDir: null
			patterns: ['**', '**/.*']
			destDir: null
			data: {}
			compile: (str, data, path) ->
				data.filename = path
				_.template str, data
		}

		kit.glob(opts.patterns, { cwd: opts.srcDir })
		.then (paths) ->
			Promise.all paths.map (path) ->
				srcPath = kit.path.join opts.srcDir, path
				destPath = kit.path.join opts.destDir, path

				kit.readFile(srcPath, 'utf8')
				.then (str) ->
					opts.compile str, opts.data, srcPath
				.then (code) ->
					kit.outputFile destPath, code
				.catch (err) ->
					if err.cause.code != 'EISDIR'
						Promise.reject err

	###*
	 * Generate a list of module paths from a name and a directory.
	 * @param  {String} moduleName The module name.
	 * @param  {String} dir        The root path. Default is current working dir.
	 * @return {Array} Paths
	###
	generateNodeModulePaths: (moduleName, dir = process.cwd()) ->
		names = [moduleName]
		while true
			names.push kit.path.join(dir, 'node_modules', moduleName)
			pDir = kit.path.dirname dir

			break if dir == pDir
			dir = pDir
		names

	###*
	 * See the https://github.com/isaacs/node-glob
	 * @param {String | Array} patterns Minimatch pattern.
	 * @param {Object} opts The glob options.
	 * @return {Promise} Contains the path list.
	###
	glob: (patterns, opts) ->
		if _.isString patterns
			patterns = [patterns]

		allPaths = []
		statCache = {}
		Promise.all patterns.map (p) ->
			kit._glob p, opts
			.then (paths) ->
				_.extend statCache, paths.glob.statCache
				allPaths = _.union allPaths, paths
		.then ->
			allPaths.statCache = statCache
			allPaths

	_glob: (pattern, opts) ->
		glob = kit.require 'glob'
		new Promise (resolve, reject) ->
			g = glob pattern, opts, (err, paths) ->
				paths.glob = g
				if err
					reject err
				else
					resolve paths

	###*
	 * See my [jhash][jhash] project.
	 * [jhash]: https://github.com/ysmood/jhash
	###
	jhash: require 'jhash'

	###*
	 * For debugging use. Dump a colorful object.
	 * @param  {Object} obj Your target object.
	 * @param  {Object} opts Options. Default:
	 * { colors: true, depth: 5 }
	 * @return {String}
	###
	inspect: (obj, opts) ->
		util = kit.require 'util'

		_.defaults opts, {
			colors: kit.isDevelopment()
			depth: 5
		}

		str = util.inspect obj, opts

	###*
	 * Nobone use it to check the running mode of the app.
	 * Overwrite it if you want to control the check logic.
	 * By default it returns the `rocess.env.NODE_ENV == 'development'`.
	 * @return {Boolean}
	###
	isDevelopment: ->
		process.env.NODE_ENV == 'development'

	###*
	 * Nobone use it to check the running mode of the app.
	 * Overwrite it if you want to control the check logic.
	 * By default it returns the `rocess.env.NODE_ENV == 'production'`.
	 * @return {Boolean}
	###
	isProduction: ->
		process.env.NODE_ENV == 'production'

	###*
	 * A better log for debugging, it uses the `kit.inspect` to log.
	 *
	 * You can use terminal command like `logReg='pattern' node app.js` to
	 * filter the log info.
	 *
	 * You can use `logTrace='on' node app.js` to force each log end with a
	 * stack trace.
	 * @param  {Any} msg Your log message.
	 * @param  {String} action 'log', 'error', 'warn'.
	 * @param  {Object} opts Default is same with `kit.inspect`
	###
	log: (msg, action = 'log', opts = {}) ->
		if not kit.lastLogTime
			kit.lastLogTime = new Date
			if process.env.logReg
				kit.logReg = new RegExp(process.env.logReg)

		time = new Date()
		timeDelta = (+time - +kit.lastLogTime).toString().magenta + 'ms'
		kit.lastLogTime = time
		time = [
			[
				kit.pad time.getFullYear(), 4
				kit.pad time.getMonth() + 1, 2
				kit.pad time.getDate(), 2
			].join('-')
			[
				kit.pad time.getHours(), 2
				kit.pad time.getMinutes(), 2
				kit.pad time.getSeconds(), 2
			].join(':')
		].join(' ').grey

		log = ->
			str = _.toArray(arguments).join ' '

			if kit.logReg and not kit.logReg.test(str)
				return

			console[action] str.replace /\n/g, '\n  '

			if process.env.logTrace == 'on'
				err = (new Error).stack
					.replace(/.+\n.+\n.+/, '\nStack trace:').grey
				console.log err

		if _.isObject msg
			log "[#{time}] ->\n" + kit.inspect(msg, opts), timeDelta
		else
			log "[#{time}]", msg, timeDelta

		if action == 'error'
			process.stdout.write "\u0007"

		return

	###*
	 * Monitor an application and automatically restart it when file changed.
	 * When the monitored app exit with error,
	 * the monitor itself will also exit.
	 * It will make sure your app crash properly.
	 * @param  {Object} opts Defaults:
	 * ```coffee
	 * {
	 * 	bin: 'node'
	 * 	args: ['app.js']
	 * 	watchList: ['app.js']
	 * 	opts: {} # Such as 'cwd', 'stdio', 'env'
	 * }
	 * ```
	 * @return {Process} The child process.
	###
	monitorApp: (opts) ->
		_.defaults opts, {
			bin: 'node'
			args: ['app.js']
			watchList: ['app.js']
			opts: {}
		}

		sepLine = ->
			console.log _.times(process.stdout.columns, -> '*').join('').yellow

		childPs = null
		start = ->
			sepLine()

			childPs = kit.spawn(
				opts.bin
				opts.args
				opts.opts
			).process

			childPs.on 'close', (code, sig) ->
				childPs.isClosed = true

				kit.log 'EXIT'.yellow +
					" code: #{(code + '').cyan} signal: #{(sig + '').cyan}"

				if code != null and code != 0
					kit.err 'Process closed. Edit and save
						the watched file to restart.'.red

		process.on 'SIGINT', ->
			childPs.kill 'SIGINT'
			process.exit()

		kit.watchFiles opts.watchList, (path, curr, prev) ->
			if curr.mtime != prev.mtime
				kit.log "Reload app, modified: ".yellow + path

				if childPs.isClosed
					start()
				else
					childPs.on 'close', start
					childPs.kill 'SIGINT'

		kit.log "Monitor: ".yellow + opts.watchList

		start()

		childPs

	###*
	 * Node version. Such as `v0.10.23` is `0.1023`, `v0.10.1` is `0.1001`.
	 * @type {Float}
	###
	nodeVersion: ->
		ms = process.versions.node.match /(\d+)\.(\d+)\.(\d+)/
		str = ms[1] + '.' + kit.pad(ms[2], 2) + kit.pad(ms[3], 2)
		+str

	###*
	 * Open a thing that your system can recognize.
	 * Now only support Windows, OSX or system that installed 'xdg-open'.
	 * @param  {String} cmd  The thing you want to open.
	 * @param  {Object} opts The options of the node native
	 * `child_process.exec`.
	 * @return {Promise} When the child process exits.
	 * @example
	 * ```coffee
	 * # Open a webpage with the default browser.
	 * kit.open 'http://ysmood.org'
	 * ```
	###
	open: (cmd, opts = {}) ->
		{ exec } = kit.require 'child_process'

		switch process.platform
			when 'darwin'
				cmds = ['open']
			when 'win32'
				cmds = ['start']
			else
				which = kit.require 'which'
				try
					cmds = [which.sync('xdg-open')]
				catch
					return Promise.resolve()

		cmds.push cmd

		new Promise (resolve, reject) ->
			exec cmds.join(' '), opts, (err, stdout, stderr) ->
				if err
					reject err
				else
					resolve { stdout, stderr }

	###*
	 * String padding helper.
	 * @param  {Sting | Number} str
	 * @param  {Number} width
	 * @param  {String} char Padding char. Default is '0'.
	 * @return {String}
	 * @example
	 * ```coffee
	 * kit.pad '1', 3 # '001'
	 * ```
	###
	pad: (str, width, char = '0') ->
		str = str + ''
		if str.length >= width
			str
		else
			new Array(width - str.length + 1).join(char) + str

	###*
	 * A comments parser for coffee-script.
	 * Used to generate documentation automatically.
	 * It will traverse through all the comments.
	 * @param  {String} moduleName The name of the module it belongs to.
	 * @param  {String} code Coffee source code.
	 * @param  {String} path The path of the source code.
	 * @param  {Object} opts Parser options:
	 * ```coffee
	 * {
	 * 	commentReg: RegExp
	 * 	splitReg: RegExp
	 * 	tagNameReg: RegExp
	 * 	typeReg: RegExp
	 * 	nameReg: RegExp
	 * 	nameTags: ['param', 'property']
	 * 	descriptionReg: RegExp
	 * }
	 * ```
	 * @return {Array} The parsed comments. Each item is something like:
	 * ```coffee
	 * {
	 * 	module: 'nobone'
	 * 	name: 'parseComment'
	 * 	description: 'A comments parser for coffee-script.'
	 * 	tags: [
	 * 		{
	 * 			tagName: 'param'
	 * 			type: 'string'
	 * 			name: 'code'
	 * 			description: 'The name of the module it belongs to.'
	 * 			path: 'http://thePathOfSourceCode'
	 * 			index: 256 # The target char index in the file.
	 * 			line: 32 # The line number of the target in the file.
	 * 		}
	 * 	]
	 * }
	 * ```
	###
	parseComment: (moduleName, code, path = '', opts = {}) ->
		_.defaults opts, {
			commentReg: /###\*([\s\S]+?)###\s+([\w\.]+)/g
			splitReg: /^\s+\* @/m
			tagNameReg: /^([\w\.]+)\s*/
			typeReg: /^\{(.+?)\}\s*/
			nameReg: /^(\w+)\s*/
			nameTags: ['param', 'property']
			descriptionReg: /^([\s\S]*)/
		}

		parseInfo = (block) ->
			# Unescape '\/'
			block = block.replace /\\\//g, '/'

			# Clean the prefix '*'
			arr = block.split(opts.splitReg).map (el) ->
				el.replace(/^[ \t]+\*[ \t]?/mg, '').trim()

			{
				description: arr[0] or ''
				tags: arr[1..].map (el) ->
					parseTag = (reg) ->
						m = el.match reg
						if m and m[1]
							el = el[m[0].length..]
							m[1]
						else
							null

					tag = {}

					tag.tagName = parseTag opts.tagNameReg

					type = parseTag opts.typeReg
					if type
						tag.type = type
						if tag.tagName in opts.nameTags
							tag.name = parseTag opts.nameReg
						tag.description = parseTag(opts.descriptionReg) or ''
					else
						tag.description = parseTag(opts.descriptionReg) or ''
					tag
			}

		comments = []
		m = null
		while (m = opts.commentReg.exec(code)) != null
			info = parseInfo m[1]
			comments.push {
				module: moduleName
				name: m[2]
				description: info.description
				tags: info.tags
				path
				index: opts.commentReg.lastIndex
				line: _.reduce(code[...opts.commentReg.lastIndex]
				, (count, char) ->
					count++ if char == '\n'
					count
				, 1)
			}

		return comments

	###*
	 * Node native module
	###
	path: require 'path'

	###*
	 * The promise lib.
	 * @type {Object}
	###
	Promise: Promise

	###*
	 * Convert a callback style function to a promise function.
	 * @param  {Function} fn
	 * @param  {Any}      this `this` object of the function.
	 * @return {Function} The function will return a promise object.
	###
	promisify: (fn, self) ->
		# We should avoid use Bluebird's promisify.
		# This one should be faster.
		(args...) ->
			new Promise (resolve, reject) ->
				args.push ->
					if arguments[0]?
						reject arguments[0]
					else
						resolve arguments[1]
				fn.apply self, args

	###*
	 * Block terminal and wait for user inputs. Useful when you need
	 * in-terminal user interaction.
	 * @param  {Object} opts See the https://github.com/flatiron/prompt
	 * @return {Promise} Contains the results of prompt.
	###
	promptGet: (opts) ->
		prompt = kit.require 'prompt', (prompt) ->
			prompt.message = '>> '
			prompt.delimiter = ''

		new Promise (resolve, reject) ->
			prompt.get opts, (err, res) ->
				if err
					reject err
				else
					resolve res

	###*
	 * Much much faster than the native require of node, but
	 * you should follow some rules to use it safely.
	 * @param  {String}   moduleName Relative moudle path is not allowed!
	 * Only allow absolute path or module name.
	 * @param  {Function} done Run only the first time after the module loaded.
	 * @return {Module} The module that you require.
	###
	require: (moduleName, done) ->
		if not kit.requireCache[moduleName]
			if moduleName[0] == '.'
				throw new Error('Relative path is not allowed: ' + moduleName)

			names = kit.generateNodeModulePaths moduleName, process.cwd()

			if process.env.NODE_PATH
				for p in process.env.NODE_PATH.split(kit.path.delimiter)
					names.push kit.path.join(p, moduleName)

			for name in names
				try
					kit.requireCache[moduleName] = require name
					done? kit.requireCache[moduleName]
					break

		if not kit.requireCache[moduleName]
			throw new Error('Module not found: ' + moduleName)

		kit.requireCache[moduleName]

	###*
	 * A powerful extended combination of `http.request` and `https.request`.
	 * @param  {Object} opts The same as the [http.request][http.request],
	 * but with some extra options:
	 * ```coffee
	 * {
	 * 	url: 'It is not optional, String or Url Object.'
	 *
	 * 	# Other than return `res` with `res.body`,return `body` directly.
	 * 	body: true
	 *
	 * 	# Max times of auto redirect. If 0, no auto redirect.
	 * 	redirect: 0
	 *
	 * 	host: 'localhost'
	 * 	hostname: 'localhost'
	 * 	port: 80
	 * 	method: 'GET'
	 * 	path: '/'
	 * 	headers: {}
	 * 	auth: ''
	 * 	agent: null
	 *
	 * 	# Set null to use buffer, optional.
	 * 	# It supports GBK, ShiftJIS etc.
	 * 	# For more info, see https://github.com/ashtuchkin/iconv-lite
	 * 	resEncoding: 'auto'
	 *
	 * 	# It's string, object or buffer, optional. When it's an object,
	 * 	# The request will be 'application/x-www-form-urlencoded'.
	 * 	reqData: null
	 *
	 * 	# auto end the request.
	 * 	autoEndReq: true
	 *
	 * 	# Readable stream.
	 * 	# If this option is set, the `headers['content-length']`
	 * 	# should also be set.
	 * 	reqPipe: null
	 *
	 * 	# Writable stream.
	 * 	resPipe: null
	 *
	 * 	# The progress of the request.
	 * 	reqProgress: (complete, total) ->
	 *
	 * 	# The progress of the response.
	 * 	resProgress: (complete, total) ->
	 * }
	 * ```
	 * And if set opts as string, it will be treated as the url.
	 * [http.request]: http://nodejs.org/api/http.html#httpHttpRequestOptionsCallback
	 * @return {Promise} Contains the http response object,
	 * it has an extra `body` property.
	 * You can also get the request object by using `Promise.req`, for example:
	 * ```coffee
	 * p = kit.request 'http://test.com'
	 * p.req.on 'response', (res) ->
	 * 	kit.log res.headers['content-length']
	 * p.done (body) ->
	 * 	kit.log body # html or buffer
	 *
	 * kit.request {
	 * 	url: 'https://test.com/a.mp3'
	 * 	body: false
	 * 	resProgress: (complete, total) ->
	 * 		kit.log "Progress: #{complete} / #{total}"
	 * }
	 * .done (res) ->
	 * 	kit.log res.body.length
	 * 	kit.log res.headers
	 * ```
	###
	request: (opts) ->
		if _.isString opts
			opts = { url: opts }

		if _.isObject opts.url
			opts.url.protocol ?= 'http:'
			opts.url = kit.url.format opts.url
		else
			if opts.url.indexOf('http') != 0
				opts.url = 'http://' + opts.url

		url = kit.url.parse opts.url
		url.protocol ?= 'http:'

		request = null
		switch url.protocol
			when 'http:'
				{ request } = kit.require 'http'
			when 'https:'
				{ request } = kit.require 'https'
			else
				Promise.reject new Error('Protocol not supported: ' + url.protocol)

		_.defaults opts, url

		_.defaults opts, {
			body: true
			resEncoding: 'auto'
			reqData: null
			autoEndReq: true
			autoUnzip: true
			reqProgress: null
			resProgress: null
		}

		opts.headers ?= {}
		if Buffer.isBuffer(opts.reqData)
			reqBuf = opts.reqData
		else if _.isString opts.reqData
			reqBuf = new Buffer(opts.reqData)
		else if _.isObject opts.reqData
			opts.headers['content-type'] ?=
				'application/x-www-form-urlencoded; charset=utf-8'
			reqBuf = new Buffer(
				_.map opts.reqData, (v, k) ->
					[encodeURIComponent(k), encodeURIComponent(v)].join '='
				.join '&'
			)
		else
			reqBuf = undefined

		if reqBuf != undefined
			opts.headers['content-length'] ?= reqBuf.length

		req = null
		promise = new Promise (resolve, reject) ->
			req = request opts, (res) ->
				if opts.redirect > 0 and res.headers.location
					opts.redirect--
					kit.request(
						_.extend opts, kit.url.parse(res.headers.location)
					)
					.catch (err) -> reject err
					.done (val) -> resolve val
					return

				if opts.resProgress
					do ->
						total = +res.headers['content-length']
						complete = 0
						res.on 'data', (chunk) ->
							complete += chunk.length
							opts.resProgress complete, total

				if opts.resPipe
					resPipeError = (err) ->
						reject err
						opts.resPipe.end()

					if opts.autoUnzip
						switch res.headers['content-encoding']
							when 'gzip'
								unzip = kit.require('zlib').createGunzip()
							when 'deflate'
								unzip = kit.require('zlib').createInflat()
							else
								unzip = null
						if unzip
							unzip.on 'error', resPipeError
							res.pipe(unzip).pipe(opts.resPipe)
						else
							res.pipe opts.resPipe
					else
						res.pipe opts.resPipe

					opts.resPipe.on 'error', resPipeError
					res.on 'error', resPipeError
					res.on 'end', -> resolve res
				else
					buf = new Buffer(0)
					res.on 'data', (chunk) ->
						buf = Buffer.concat [buf, chunk]

					res.on 'end', ->
						resolver = (body) ->
							if opts.body
								resolve body
							else
								res.body = body
								resolve res

						if opts.resEncoding
							encoding = 'utf8'
							if opts.resEncoding == 'auto'
								cType = res.headers['content-type']
								if _.isString cType
									m = cType.match(/charset=(.+);?/i)
									if m and m[1]
										encoding = m[1]
									if not /^(text)|(application)\//.test(cType)
										encoding = null

							decode = (buf) ->
								if not encoding
									return buf
								try
									if encoding == 'utf8'
										buf.toString()
									else
										kit.require('iconv-lite')
										.decode buf, encoding
								catch err
									reject err

							if opts.autoUnzip
								switch res.headers['content-encoding']
									when 'gzip'
										unzip = kit.require('zlib').gunzip
									when 'deflate'
										unzip = kit.require('zlib').inflate
									else
										unzip = null
								if unzip
									unzip buf, (err, buf) ->
										resolver decode(buf)
								else
									resolver decode(buf)
							else
								resolver decode(buf)
						else
							resolver buf

			req.on 'error', (err) ->
				# Release pipe
				opts.resPipe?.end()
				reject err

			if opts.reqPipe
				if opts.reqProgress
					do ->
						total = +opts.headers['content-length']
						complete = 0
						opts.reqPipe.on 'data', (chunk) ->
							complete += chunk.length
							opts.reqProgress complete, total

				opts.reqPipe.pipe req
			else
				if opts.autoEndReq
					req.end reqBuf

		promise.req = req
		promise

	###*
	 * A safer version of `child_process.spawn` to run a process on
	 * Windows or Linux.
	 * It will automatically add `node_modules/.bin` to the `PATH`
	 * environment variable.
	 * @param  {String} cmd Path of an executable program.
	 * @param  {Array} args CLI arguments.
	 * @param  {Object} opts Process options.
	 * Same with the Node.js official doc.
	 * Default will inherit the parent's stdio.
	 * @return {Promise} The `promise.process` is the child process object.
	 * When the child process ends, it will resolve.
	###
	spawn: (cmd, args = [], opts = {}) ->
		PATH = process.env.PATH or process.env.Path
		[
			kit.path.normalize __dirname + '/../node_modules/.bin'
			kit.path.normalize process.cwd() + '/node_modules/.bin'
		].forEach (path) ->
			if PATH.indexOf(path) < 0 and kit.fs.existsSync(path)
				PATH = [path, PATH].join kit.path.delimiter
		process.env.PATH = PATH
		process.env.Path = PATH

		_.defaults opts, {
			stdio: 'inherit'
		}

		if process.platform == 'win32'
			which = kit.require 'which'
			cmd = which.sync cmd
			if cmd.slice(-3).toLowerCase() == 'cmd'
				cmdSrc = kit.fs.readFileSync(cmd, 'utf8')
				m = cmdSrc.match(/node\s+"%~dp0\\(\.\.\\.+)"/)
				if m and m[1]
					cmd = kit.path.join cmd, '..', m[1]
					cmd = kit.path.normalize cmd
					args = [cmd].concat args
					cmd = 'node'

		{ spawn } = kit.require 'child_process'

		ps = null
		promise = new Promise (resolve, reject) ->
			try
				ps = spawn cmd, args, opts
			catch err
				reject err

			ps.on 'error', (err) ->
				reject err

			ps.on 'close', (code, signal) ->
				resolve { code, signal }

		promise.process = ps
		promise

	###*
	 * Node native module
	###
	url: require 'url'

	###*
	 * Watch a file. If the file changes, the handler will be invoked.
	 * You can change the polling interval by using `process.env.pollingWatch`.
	 * Use `process.env.watchPersistent = 'off'` to disable the persistent.
	 * For samba server, we have to choose `watchFile` other than `watch`.
	 * @param  {String}   path    The file path
	 * @param  {Function} handler Event listener.
	 * The handler has these params:
	 * - file path
	 * - current `fs.Stats`
	 * - previous `fs.Stats`
	 * - if its a deletion
	 * @param {Boolean} autoUnwatch Auto unwatch the file while file deletion.
	 * Default is true.
	 * @return {Function} The wrapped watch listeners.
	 * @example
	 * ```coffee
	 * process.env.watchPersistent = 'off'
	 * kit.watchFile 'a.js', (path, curr, prev, isDeletion) ->
	 * 	if curr.mtime != prev.mtime
	 * 		kit.log path
	 * ```
	###
	watchFile: (path, handler, autoUnwatch = true) ->
		listener = (curr, prev) ->
			isDeletion = curr.mtime.getTime() == 0
			handler(path, curr, prev, isDeletion)
			if isDeletion
				kit.fs.unwatchFile path, listener

		fs.watchFile(
			path
			{
				persistent: process.env.watchPersistent != 'off'
				interval: +process.env.pollingWatch or 300
			}
			listener
		)
		listener

	###*
	 * Watch files, when file changes, the handler will be invoked.
	 * It takes the advantage of `kit.watchFile`.
	 * @param  {Array} patterns String array with minimatch syntax.
	 * Such as `['*\/**.css', 'lib\/**\/*.js']`.
	 * @param  {Function} handler
	 * @return {Promise} It contains the wrapped watch listeners.
	 * @example
	 * ```coffee
	 * kit.watchFiles '*.js', (path, curr, prev, isDeletion) ->
	 * 	kit.log path
	 * ```
	###
	watchFiles: (patterns, handler) ->
		kit.glob(patterns).then (paths) ->
			paths.map (path) ->
				kit.watchFile path, handler

	###*
	 * Watch directory and all the files in it.
	 * It supports three types of change: create, modify, move, delete.
	 * @param  {Object} opts Defaults:
	 * ```coffee
	 * {
	 * 	dir: '.'
	 * 	pattern: '**' # minimatch, string or array
	 *
	 * 	# Whether to watch POSIX hidden file.
	 * 	dot: false
	 *
	 * 	# If the "path" ends with '/' it's a directory, else a file.
	 * 	handler: (type, path, oldPath) ->
	 * }
	 * ```
	 * @return {Promise}
	 * @example
	 * ```coffee
	 * # Only current folder, and only watch js and css file.
	 * kit.watchDir {
	 * 	dir: 'lib'
	 * 	pattern: '*.+(js|css)'
	 * 	handler: (type, path) ->
	 * 		kit.log type
	 * 		kit.log path
	 *
	 * 	# If you use watchDir recursively, you need a global watchedList
	 * 	watchedList: {}
	 * }
	 * ```
	###
	watchDir: (opts) ->
		_.defaults opts, {
			dir: '.'
			pattern: '**'
			dot: false
			handler: (type, path, oldPath) ->
			watchedList: {}
			deletedList: {}
		}

		if _.isString opts.pattern
			opts.pattern = [opts.pattern]
			opts.pattern = _.uniq opts.pattern

		opts.pattern.push '**/'
		expandPatterns = opts.pattern.map (pattern) ->
			kit.path.join opts.dir, pattern

		expandPaths = (paths) ->
			# Make sure the parent directories are also in the watch list.
			paths.push kit.path.join(opts.dir, kit.path.sep)

			# The reverse will keep the children event happen at first.
			_.uniq(paths.sort(), true).reverse()

		isSameFile = (statsA, statsB) ->
			statsA.mtime.getTime() == statsB.mtime.getTime() and
			statsA.ctime.getTime() == statsB.ctime.getTime() and
			statsA.size == statsB.size

		recursiveWatch = (path) ->
			if path[-1..] == '/'
				# Recursively watch a newly created directory.
				kit.watchDir _.defaults({
					dir: path
				}, opts)
			else
				opts.watchedList[path] = kit.watchFile path, fileWatcher

		fileWatcher = (path, curr, prev, isDelete) ->
			if isDelete
				opts.deletedList[path] = prev
			else
				opts.handler 'modify', path

		mainWatch = (path, curr, prev, isDelete) ->
			if isDelete
				opts.deletedList[path] = prev
				return

			# Each time a direcotry change happens, it will check all
			# it children files, if any child is not in the watchedList,
			# a `create` event will be triggered.
			kit.glob(
				expandPatterns
				{
					mark: true
					dot: opts.dot
					nosort: true
				}
			).then (paths) ->
				statCache = paths.statCache
				paths = expandPaths paths

				for p in paths
					if opts.watchedList[p] != undefined
						continue

					# Check if the new file is renamed from another file.
					if not _.any(opts.deletedList, (stat, dpath) ->
						if stat == 'parentMoved'
							delete opts.deletedList[dpath]
							return true

						if isSameFile(stat, statCache[p])
							# All children will be deleted, so that
							# sub-move event won't trigger.
							for k of opts.deletedList
								if k.indexOf(dpath) == 0
									opts.deletedList[k] = 'parentMoved'
									delete opts.watchedList[k]
							delete opts.deletedList[dpath]
							recursiveWatch p
							opts.handler 'move', p, dpath
							true
						else
							false
					)
						recursiveWatch p
						opts.handler 'create', p

				_.each opts.watchedList, (v, wpath) ->
					if wpath not in paths and
					wpath.indexOf(path) == 0
						delete opts.deletedList[wpath]
						delete opts.watchedList[wpath]
						opts.handler 'delete', wpath

			.catch (err) ->
				kit.err err

		kit.glob(
			expandPatterns
			{
				mark: true
				dot: opts.dot
				nosort: true
			}
		).then (paths) ->
			paths = expandPaths paths

			for path in paths
				if path[-1..] == '/'
					w = kit.watchFile path, mainWatch
				else
					w = kit.watchFile path, fileWatcher
				opts.watchedList[path] = w
			opts.watchedList

}

# Fix node bugs
kit.path.delimiter = if process.platform == 'win32' then ';' else ':'

# Some debug options.
if kit.isDevelopment()
	Promise.longStackTraces()
else
	colors.mode = 'none'

module.exports = kit