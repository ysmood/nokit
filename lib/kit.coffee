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
 *
 * [Offline Documentation](?gotoDoc=fs-more/readme.md)
 * [fs-more]: https://github.com/ysmood/fs-more
 * @example
 * ```coffee
 * kit.readFile('test.txt', 'utf8').then (str) ->
 * 	console.log str
 *
 * kit.outputFile 'a.txt', 'test'
 * .then -> kit.log 'done'
 *
 * kit.fs.writeJSONSync 'b.json', { a: 10 }
 * .then -> kit.log 'done'
 *
 * kit.fs.mkdirsP 'b.json', { a: 10 }
 * .then -> kit.log 'done'
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
	 * An throttled version of `Promise.all`, it runs all the tasks under
	 * a concurrent limitation.
	 * To run tasks sequentially, use `kit.compose`.
	 * @param  {Int} limit The max task to run at a time. It's optional.
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
	 * Besides, it can also accept async function that returns promise.
	 * It's more powerful than `_.compose`, and it use reverse order for
	 * passing argument from one function to another.
	 * See `kit.async`, if you need concurrent support.
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
	 * Daemonize a program. Just a shortcut usage of `kit.spawn`.
	 * @param  {Object} opts Defaults:
	 * ```coffee
	 * {
	 * 	bin: 'node'
	 * 	args: ['app.js']
	 * 	stdout: 'stdout.log' # Can also be a stream
	 * 	stderr: 'stderr.log' # Can also be a stream
	 * }
	 * ```
	 * @return {Porcess} The daemonized process.
	###
	daemonize: (opts = {}) ->
		_.defaults opts, {
			bin: 'node'
			args: ['app.js']
			stdout: 'stdout.log'
			stderr: 'stderr.log'
		}

		if _.isString opts.stdout
			outLog = kit.fs.openSync(opts.stdout, 'a')
		if _.isString opts.stderr
			errLog = kit.fs.openSync(opts.stderr, 'a')

		p = kit.spawn(opts.bin, opts.args, {
			detached: true
			stdio: [ 'ignore', outLog, errLog ]
		}).process
		p.unref()
		p

	###*
	 * A simple decrypt helper. Cross-version of node.
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
	 * A simple encrypt helper. Cross-version of node.
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
	 * A error log shortcut for `kit.log(msg, 'error', opts)`
	 * @param  {Any} msg
	 * @param  {Object} opts
	###
	err: (msg, opts = {}) ->
		kit.log msg, 'error', opts

	###*
	 * A better `child_process.exec`. This function require your current
	 * version of node support `stream.Transform` API.
	 * @param  {String} cmd   Shell commands.
	 * @param  {String} shell Shell name. Such as `bash`, `zsh`. Optinal.
	 * @return {Promise} Resolves when the process's stdio is drained.
	 * The resolve value is like:
	 * ```coffee
	 * {
	 * 	code: 0
	 * 	signal: null
	 * 	stdout: 'hello world'
	 * 	stderr: ''
	 * }
	 * ```
	 * @example
	 * ```coffee
	 * kit.exec("""
	 * 	a='hello world'
	 *  echo $a
	 * """).then ({code, stdout}) ->
	 * 	kit.log code # output => 0
	 * 	kit.log stdout # output => "hello world"
	 *
	 * # Bash doesn't support "**" recusive match pattern.
	 * kit.exec """
	 * 	echo **\/*.css
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
	 *
	 * [Offline Documentation](?gotoDoc=fs-more/readme.md)
	 * [fs-more]: https://github.com/ysmood/fs-more
	###
	fs: fs

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
	 * A handy file system search tool.
	 * See the https://github.com/isaacs/node-glob
	 *
	 * [Offline Documentation](?gotoDoc=glob/readme.md)
	 * @param {String | Array} patterns Minimatch pattern.
	 * @param {Object} opts The glob options.
	 * @return {Promise} Contains the path list.
	 * @example
	 * ```coffee
	 * glob('*.js').then (paths) -> kit.log paths
	 *
	 * glob('*.js', { cwd: 'test' }).then (paths) -> kit.log paths
	 *
	 * glob(['*.js', '*.css']).then (paths) -> kit.log paths
	 *
	 * # The 'statCache' is also saved.
	 * glob('*.js', { dot: true }).then (paths) ->
	 * 	kit.log paths.statCache
	 * ```
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
			if opts and opts.sync
				try
					g = new glob.Glob pattern, opts
					paths = g.found
					paths.glob = g
					resolve paths
				catch err
					reject err
			else
				g = glob pattern, opts, (err, paths) ->
					paths.glob = g
					if err
						reject err
					else
						resolve paths

	###*
	 * A fast helper to hash string or binary file.
	 * See my [jhash][jhash] project.
	 *
	 * [Offline Documentation](?gotoDoc=jhash/readme.md)
	 * [jhash]: https://github.com/ysmood/jhash
	 * @example
	 * ```coffee
	 * var jhash = require('jhash');
	 * jhash.hash('test'); // output => '349o'
	 *
	 * var fs = require('fs');
	 * jhash.hash(fs.readFileSync('a.jpg'));
	 *
	 * // Control the hash char set.
	 * jhash.setSymbols('abcdef');
	 * jhash.hash('test'); // output => 'decfddfe'
	 *
	 * // Control the max length of the result hash value. Unit is bit.
	 * jhash.setMaskLen(10);
	 * jhash.hash('test'); // output => 'ede'
	 * ```
	###
	jhash: require 'jhash'

	###*
	 * It inserts the fnB in between the fnA and concatenates the result.
	 * @param  {Any} fnA
	 * @param  {Any} fnB
	 * @return {Array}
	 * @example
	 * ```coffee
	 * kit.join([1, 2, 3, 4], 'sep')
	 * # output => [1, 'sep', 2, 'sep', 3, 'sep', 4]
	 *
	 * iter = ->
	 * 	i = 0
	 * 	-> i++
	 * kit.join([1, 2, 3, 4], new iter)
	 * # output => [1, 'sep', 2, 'sep', 3, 'sep', 4]
	 * ```
	###
	join: (fnA, fnB) ->
		arr = []
		iterA = kit.iter fnA
		iterB = kit.iter fnB

		val = iterA().value
		while val != undefined
			arr.push val

			nextVal = iterA().value

			if nextVal != undefined
				arr.push iterB().value

			val = nextVal

		arr

	###*
	 * Generate a iterator from a value.
	 * @param  {Any} val
	 * @return {Function} The every time when the function been
	 * called, it returns a object looks like:
	 * ```coffee
	 * { key: 10, value: 'hello world' }
	 * ```
	 * The `key` can be `undefined`, `number` or `string`.
	 * @example
	 * ```coffee
	 * iter = kit.iter [1, 2, 3]
	 * iter() # output => { key: 0, value: 1 }
	 *
	 * iter = kit.iter 'test'
	 * iter() # output => { key: 0, value: 't' }
	 *
	 * iter = kit.iter { a: 1, b: 2, c: 3 }
	 * iter() # output => { key: 'a', value: 1 }
	 * ```
	###
	iter: (val) ->
		if _.isArray(val)
			i = 0
			-> { key: i, value: val[i++] }
		else if _.isFunction val
			-> { value: val.apply undefined, arguments }
		else if _.isObject val
			i = 0
			keys = _.keys val
			->
				key = keys[i++]
				{ key, value: val[key] }
		else
			-> { value: val }

	###*
	 * For debugging. Dump a colorful object.
	 * @param  {Object} obj Your target object.
	 * @param  {Object} opts Options. Default:
	 * ```coffee
	 * { colors: true, depth: 5 }
	 * ```
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
	 * Use terminal command like `logReg='pattern' node app.js` to
	 * filter the log info.
	 *
	 * Use `logTrace='on' node app.js` to force each log end with a
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
	 * Even when the monitored app exit with error, the monitor will still wait
	 * for your file change to restart the application.
	 * It will print useful infomation when it application unexceptedly.
	 * @param  {Object} opts Defaults:
	 * ```coffee
	 * {
	 * 	bin: 'node'
	 * 	args: ['app.js']
	 * 	watchList: ['app.js'] # Extra files to watch.
	 * 	opts: {} # Same as the opts of 'kit.spawn'.
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

				if code != null and code != 0 and code != 130
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
	 * String padding helper. It is use in the `kit.log`.
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
	 * Used to generate documentation from source code automatically.
	 * It will traverse through all the comments of a coffee file.
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
	 * Node native module `path`.
	###
	path: require 'path'

	###*
	 * The promise lib. Now, it uses Bluebird as ES5 polyfill.
	 * In the future, the Bluebird will be replaced with native
	 * ES6 Promise. Please don't use any API other than the ES6 spec.
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
	 * Much faster than the native require of node, but you should
	 * follow some rules to use it safely.
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
	 * A handy extended combination of `http.request` and `https.request`.
	 * @param  {Object} opts The same as the [http.request](http://nodejs.org/api/http.html#httpHttpRequestOptionsCallback),
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
	 * 	# Timeout of the socket of the http connection.
	 * 	# If timeout happens, the promise will reject.
	 * 	# Zero means no timeout.
	 * 	timeout: 0
	 *
	 * 	# The key of headers should be lowercased.
	 * 	headers: {}
	 *
	 * 	host: 'localhost'
	 * 	hostname: 'localhost'
	 * 	port: 80
	 * 	method: 'GET'
	 * 	path: '/'
	 * 	auth: ''
	 * 	agent: null
	 *
	 * 	# Set "transfer-encoding" header to 'chunked'.
	 * 	setTE: false
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
	 * @return {Promise} Contains the http response object,
	 * it has an extra `body` property.
	 * You can also get the request object by using `Promise.req`, for example:
	 * ```coffee
	 * p = kit.request 'http://test.com'
	 * p.req.on 'response', (res) ->
	 * 	kit.log res.headers['content-length']
	 * p.then (body) ->
	 * 	kit.log body # html or buffer
	 *
	 * kit.request {
	 * 	url: 'https://test.com/a.mp3'
	 * 	body: false
	 * 	resProgress: (complete, total) ->
	 * 		kit.log "Progress: #{complete} / #{total}"
	 * }
	 * .then (res) ->
	 * 	kit.log res.body.length
	 * 	kit.log res.headers
	 *
	 * # Send form-data.
	 * form = new (require 'form-data')
	 * form.append 'a.jpg', new Buffer(0)
	 * form.append 'b.txt', 'hello world!'
	 * kit.request {
	 * 	url: 'a.com'
	 * 	headers: form.getHeaders()
	 * 	setTE: true
	 * 	reqPipe: form
	 * }
	 * .then (body) ->
	 * 	kit.log body
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
		delete url.host
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

		if opts.setTE
			opts.headers['transfer-encoding'] = 'chunked'

		req = null
		promise = new Promise (resolve, reject) ->
			req = request opts, (res) ->
				if opts.redirect > 0 and res.headers.location
					opts.redirect--
					url = kit.url.resolve(
						kit.url.format opts
						res.headers.location
					)
					kit.request _.extend(opts, kit.url.parse(url))
					.then resolve
					.catch reject
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
						opts.resPipe.end()
						reject err

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

			if opts.timeout > 0
				req.setTimeout opts.timeout, ->
					req.emit 'error', new Error('timeout')

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
	 * Windows or Linux. In some conditions, it may be more convenient
	 * to use the `kit.exec`.
	 * It will automatically add `node_modules/.bin` to the `PATH`
	 * environment variable.
	 * @param  {String} cmd Path or name of an executable program.
	 * @param  {Array} args CLI arguments.
	 * @param  {Object} opts Process options.
	 * Same with the Node.js official documentation.
	 * Except that it will inherit the parent's stdio.
	 * @return {Promise} The `promise.process` is the spawned child
	 * process object.
	 * Resolves when the process's stdio is drained. The resolve value
	 * is like:
	 * ```coffee
	 * {
	 * 	code: 0
	 * 	signal: null
	 * }
	 * ```
	 * @example
	 * ```coffee
	 * kit.spawn 'git', ['commit', '-m', '42 is the answer to everything']
	 * .then ({code}) -> kit.log code
	 * ```
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
	 * Node native module `url`.
	###
	url: require 'url'

	###*
	 * Walk through path pattern recursively.
	 * For more doc, see the [glob](https://github.com/isaacs/node-glob)
	 *
	 * [Offline Documentation](?gotoDoc=glob/readme.md)
	 * @param  {String}   patterns The path minimatch pattern.
	 * @param  {Object}   opts     Same with the `glob`. Optional.
	 * @param  {Function} fn       Called on each path match.
	 * @return {Promise} Same with the `kit.glob`.
	 * @example
	 * ```coffee
	 * kit.walk '.\/**\/*.js', (path) ->
	 * 	kit.log path
	 * .then (paths) ->
	 * 	kit.log paths
	 *
	 * 	# You can also get the glob object.
	 * 	kit.log paths.glob
	 * ```
	###
	walk: (pattern, opts, fn) ->
		glob = kit.require 'glob'

		if _.isFunction opts
			fn = opts
			opts = {}

		opts ?= {}

		new Promise (resolve, reject) ->
			if opts.sync
				try
					g = new glob.Glob pattern, opts
					resolve g.found
				catch err
					reject err
			else
				g = new glob.Glob pattern, opts, (err, matches) ->
					if err
						reject err
					else
						matches.glob = g
						resolve matches

			g.on 'match', fn if fn

	###*
	 * Watch a file. If the file changes, the handler will be invoked.
	 * You can change the polling interval by using `process.env.pollingWatch`.
	 * Use `process.env.watchPersistent = 'off'` to disable the persistent.
	 * Why not use `fs.watch`? Because `fs.watch` is unstable on some file
	 * systems, such as Samba or OSX.
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
	 * It is build on the top of `kit.watchFile`.
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
	 * It is build on the top of `kit.watchFile`.
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