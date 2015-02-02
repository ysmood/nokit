'use strict'

_ = require './lodash'
fs = require 'nofs'
{ Promise } = fs

###*
 * All the async functions in `kit` return promise object.
 * Most time I use it to handle files and system staffs.
 * @type {Object}
###
kit = {}

###*
 * kit extends all the functions of [nofs](https://github.com/ysmood/nofs).
 * You can use it as same as nofs. For more info, see the doc:
 *
 * [Offline Documentation](?gotoDoc=nofs/readme.md)
 * @example
 * ```coffee
 * kit.readFile('test.txt', 'utf8').then (str) ->
 * 	console.log str
 *
 * kit.outputFile 'a.txt', 'test'
 * .then -> kit.log 'done'
 *
 * kit.writeJSON 'b.json', { a: 10 }
 * .then -> kit.log 'done'
 *
 * kit.mkdirs 'b.json', { a: 10 }
 * .then -> kit.log 'done'
 * ```
###
extend_nofs = 'nofs'


_.extend kit, fs,

	###*
	 * The [lodash](https://lodash.com) lib.
	 * @type {Object}
	 * @example
	 * ```coffee
	 * kit._.map [1, 2, 3]
	 * ```
	###
	_: _

	requireCache: {}

	###*
	 * An throttled version of `Promise.all`, it runs all the tasks under
	 * a concurrent limitation.
	 * To run tasks sequentially, use `kit.flow`.
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
		resutls = []
		running = 0
		isIterDone = false

		if not _.isNumber limit
			progress = saveResutls
			saveResutls = list
			list = limit
			limit = Infinity

		saveResutls ?= true

		if _.isArray list
			iter = ->
				el = list.pop()
				if _.isFunction el then el() else el

		else if _.isFunction list
			iter = list
		else
			Promise.reject new Error('unknown list type: ' + typeof list)

		new Promise (resolve, reject) ->
			addTask = ->
				task = iter()
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
	 * The [colors](https://github.com/Marak/colors.js) lib
	 * makes it easier to print colorful info in CLI.
	 * You must `kit.require 'colors'` before using it.
	 * Sometimes use `kit.require 'colors/safe'` will be better.
	 * @type {Object}
	###
	colors: null
	'colors/safe': null

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
		crypto = kit.require 'crypto', __dirname
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
		crypto = kit.require 'crypto', __dirname
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
	 * A better `child_process.exec`. Supports multi-line shell script.
	 * For supporting old node version, it will create 3 temp files,
	 * the temp files will be removed after the execution.
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
		os = kit.require 'os', __dirname

		shell ?= process.env.SHELL or
			process.env.ComSpec or
			process.env.COMSPEC

		randName = Date.now() + Math.random()

		paths = ['.in', '.out', '.err']
		.map (type) ->
			kit.path.join os.tmpDir(), 'nobone-' + randName + type

		[ stdinPath, stdoutPath, stderrPath ] = paths

		fileHandlers = []

		clean = ->
			Promise.all fileHandlers.map (f) -> kit.close f
			.then ->
				Promise.all paths.map (p) -> kit.remove p

		promise = kit.outputFile stdinPath, cmd + '\n'
		.then ->
			Promise.all [
				kit.fs.open stdinPath, 'r'
				kit.fs.open stdoutPath, 'w'
				kit.fs.open stderrPath, 'w'
			]
		.then (stdio) ->
			fileHandlers = fileHandlers.concat stdio
			kit.spawn shell, [], { stdio }
		.then (msg) ->
			kit.readFile stdoutPath, 'utf8'
			.then (stdout) ->
				_.extend msg, { stdout }
		.catch (msg) ->
			kit.readFile stderrPath, 'utf8'
			.then (stderr) ->
				_.extend msg, { stderr }
				Promise.reject msg

		promise.then(clean).catch(clean)

		promise

	###*
	 * Creates a function that is the composition of the provided functions.
	 * Besides, it can also accept async function that returns promise.
	 * See `kit.async`, if you need concurrent support.
	 * @param  {Function | Array} fns Functions that return
	 * promise or any value.
	 * And the array can also contains promises.
	 * @return {Function} `(val) -> Promise` A function that will return a promise.
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
	 * download = kit.flow createUrl, curl, save
	 * # same as "download = kit.flow [createUrl, curl, save]"
	 *
	 * download 'home'
	 * ```
	###
	flow: (fns...) -> (val) ->
		fns = fns[0] if _.isArray fns[0]

		fns.reduce (preFn, fn) ->
			if _.isFunction fn.then
				preFn.then -> fn
			else
				preFn.then fn
		, Promise.resolve(val)

	###*
	 * Format the parsed comments array to a markdown string.
	 * @param  {Array}  comments
	 * @param  {Object} opts Defaults:
	 * ```coffee
	 * {
	 * 	indent: 0
	 * 	name: ({ name }) ->
	 * 		name = name.replace 'self.', ''
	 * 		"- \#\#\#\# #{name}\n\n"
	 * 	tag: ({ tagName, name, type }) ->
	 * 		tname = if name then " `#{name}`" else ''
	 * 		ttype = if type then " { _#{type}_ }" else ''
	 * 		"- **<u>#{tagName}</u>**:#{tname}#{ttype}"
	 * }
	 * ```
	 * @return {String}
	###
	formatComment: (comments, opts = {}) ->
		_.defaults opts, {
			indent: 0
			name: ({ name }) ->
				name = name.replace 'self.', ''
				"- #### #{name}\n\n"
			tag: ({ tagName, name, type }) ->
				tname = if name then " `#{name}`" else ''
				ttype = if type then " { _#{type}_ }" else ''
				"- **<u>#{tagName}</u>**:#{tname}#{ttype}"
		}

		all = ''
		for cmt in comments
			if _.any(cmt.tags, { tagName: 'private' })
				continue

			cmtStr = opts.name cmt

			if cmt.description
				cmtStr += kit.indent cmt.description, 4
				cmtStr += '\n\n'

			for tag in cmt.tags
				cmtStr += kit.indent opts.tag(tag), 4
				cmtStr += '\n\n'
				if tag.description
					cmtStr += kit.indent tag.description, 8
					cmtStr += '\n\n'

			all += cmtStr

		# Remove tailing space
		all = all.replace /[ \t]+$/mg, ''

		kit.indent all, opts.indent

	###*
	 * See my project [nofs](https://github.com/ysmood/nofs).
	 *
	 * [Offline Documentation](?gotoDoc=nofs/readme.md)
	###
	fs: fs

	###*
	 * Fuzzy search a string list by a key word.
	 * @param  {String} keys The key word.
	 * @param  {Array} list The list of string to search.
	 * @return {String} The best matched one. If not found,
	 * return undefined.
	###
	fuzzySearch: (key, list, opts) ->
		_ list
		.map (word) ->
			distance = 0
			len = key.length
			for c, i in key
				index = word.indexOf c
				if index < 0
					return { distance: Infinity }
				else
					distance += index * (len - i)
			{ word, distance }
		.min 'distance'
		.word

	###*
	 * Generate a list of module paths from a name and a directory.
	 * @param  {String} moduleName The module name.
	 * @param  {String} dir        The root path. Default is current working dir.
	 * @param  {String} modDir     Default is 'node_modules'.
	 * @return {Array} Paths
	###
	genModulePaths: (moduleName, dir = process.cwd(), modDir) ->
		modDir ?= 'node_modules'
		names = []
		while true
			names.push kit.path.join(dir, modDir, moduleName)
			pDir = kit.path.dirname dir

			break if dir == pDir
			dir = pDir
		names.push moduleName
		names

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
	 * Indent a text block.
	 * @param {String} text
	 * @param {Int} num
	 * @param {String} char
	 * @param {RegExp} reg Default is `/^/mg`.
	 * @return {String} The indented text block.
	 * @example
	 * ```coffee
	 * # Increase
	 * kit.indent "one\ntwo", 2
	 * # => "  one\n  two"
	 *
	 * # Decrease
	 * kit.indent "--one\n--two", 0, '', /^--/mg
	 * # => "one\ntwo"
	 * ```
	###
	indent: (text, num = 0, char = ' ', reg = /^/mg) ->
		prefix = _.repeat char, num
		text.replace reg, prefix

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
	 * A fast helper to hash string or binary file.
	 * See my [jhash](https://github.com/ysmood/jhash) project.
	 * You must `kit.require 'jhash'` before using it.
	 *
	 * [Offline Documentation](?gotoDoc=jhash/readme.md)
	 * @example
	 * ```coffee
	 * kit.require 'jhash'
	 * kit.jhash.hash 'test' # output => '349o'
	 *
	 * jhash.hash kit.readFileSync('a.jpg')
	 *
	 * # Control the hash char set.
	 * kit.jhash.setSymbols 'abcdef'
	 * kit.jhash.hash 'test' # output => 'decfddfe'
	 *
	 * # Control the max length of the result hash value. Unit is bit.
	 * jhash.setMaskLen 10
	 * jhash.hash 'test' # output => 'ede'
	 * ```
	###
	jhash: null

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
	 * A better log for debugging, it uses the `kit.xinspect` to log.
	 *
	 * Use terminal command like `logReg='pattern' node app.js` to
	 * filter the log info.
	 *
	 * Use `logTrace='on' node app.js` to force each log end with a
	 * stack trace.
	 * @param  {Any} msg Your log message.
	 * @param  {String} action 'log', 'error', 'warn'.
	 * @param  {Object} opts Default is same with `kit.xinspect`,
	 * but with some extra options:
	 * ```coffee
	 * {
	 * 	isShowTime: true
	 * }
	 * ```
	 * @example
	 * ```coffee
	 * # To achieve "console.log A, B"
	 * kit.log [A, B]
	 * ```
	###
	log: (msg, action = 'log', opts = {}) ->
		cs = kit.require 'colors/safe', ->
			if kit.isDevelopment()
				cs.mode = 'none'

		if _.isObject action
			opts = action
			action = 'log'

		_.defaults opts, {
			isShowTime: true
		}

		if not kit.lastLogTime
			kit.lastLogTime = new Date
			if process.env.logReg
				kit.logReg = new RegExp(process.env.logReg)

		if opts.isShowTime
			time = new Date()
			timeDelta = cs.magenta(+time - +kit.lastLogTime) + 'ms'
			kit.lastLogTime = time
			time = cs.grey [
				[
					_.padLeft time.getFullYear(), 4, '0'
					_.padLeft time.getMonth() + 1, 2, '0'
					_.padLeft time.getDate(), 2, '0'
				].join('-')
				[
					_.padLeft time.getHours(), 2, '0'
					_.padLeft time.getMinutes(), 2, '0'
					_.padLeft time.getSeconds(), 2, '0'
				].join(':')
			].join(' ')

		log = ->
			str = _.toArray(arguments).join ' '

			if kit.logReg and not kit.logReg.test(str)
				return

			console[action] str

			if process.env.logTrace == 'on'
				err = cs.grey (new Error).stack
					.replace(/.+\n.+\n.+/, '\nStack trace:')
				console.log err

		if _.isObject msg
			if opts.isShowTime
				log "[#{time}] ->\n" + kit.xinspect(msg, opts), timeDelta
			else
				log kit.xinspect(msg, opts), timeDelta
		else
			if opts.isShowTime
				log "[#{time}] " + msg, timeDelta
			else
				log msg, timeDelta

		if action == 'error'
			process.stdout.write "\u0007"

		return

	###*
	 * Monitor an application and automatically restart it when file changed.
	 * Even when the monitored app exit with error, the monitor will still wait
	 * for your file change to restart the application. Not only nodejs, but also
	 * other programs like ruby or python.
	 * It will print useful infomation when it application unexceptedly.
	 * @param  {Object} opts Defaults:
	 * ```coffee
	 * {
	 * 	bin: 'node'
	 * 	args: ['index.js']
	 * 	watchList: [] # By default, the same with the "args".
	 * 	isNodeDeps: true
	 * 	opts: {} # Same as the opts of 'kit.spawn'.
	 *
	 * 	# The option of `kit.parseDependency`
	 * 	parseDependency: {}
	 *
	 * 	onStart: ->
	 * 		kit.log "Monitor: " + opts.watchList
	 * 	onRestart: (path) ->
	 * 		kit.log "Reload app, modified: " + path
	 * 	onWatchFiles: (paths) ->
	 * 		kit.log 'Watching:' + paths.join(', ')
	 * 	onNormalExit: ({ code, signal }) ->
	 * 		kit.log 'EXIT' +
	 * 			" code: #{code} signal: #{signal}"
	 * 	onErrorExit: ({ code, signal }) ->
	 * 		kit.err 'EXIT' +
	 * 		" code: #{code} signal: #{signal}\n" +
	 * 		'Process closed. Edit and save
	 * 			the watched file to restart.'
	 * 	sepLine: ->
	 * 		process.stdout.write _.repeat('*', process.stdout.columns)
	 * }
	 * ```
	 * @return {Promise} It has a property `process`, which is the monitored
	 * child process.
	 * @example
	 * ```coffee
	 * kit.monitorApp {
	 * 	bin: 'coffee'
	 * 	args: ['main.coffee']
	 * }
	 *
	 * kit.monitorApp {
	 * 	bin: 'ruby'
	 * 	args: ['app.rb', 'lib\/**\/*.rb']
	 * 	isNodeDeps: false
	 * }
	 * ```
	###
	monitorApp: (opts) ->
		cs = kit.require 'colors/safe'
		_.defaults opts, {
			bin: 'node'
			args: ['index.js']
			watchList: null
			isNodeDeps: true
			parseDependency: {}
			opts: {}
			onStart: ->
				kit.log cs.yellow("Monitor: ") + opts.watchList
			onRestart: (path) ->
				kit.log cs.yellow("Reload app, modified: ") + path
			onWatchFiles: (paths) ->
				kit.log cs.yellow('Watching: ') + paths.join(', ')
			onNormalExit: ({ code, signal }) ->
				kit.log cs.yellow('EXIT') +
					" code: #{cs.cyan code} signal: #{cs.cyan signal}"
			onErrorExit: ({ code, signal }) ->
				kit.err cs.yellow('EXIT') +
				" code: #{cs.cyan code} " +
				"signal: #{cs.cyan signal}\n" +
				cs.red 'Process closed. Edit and save
				the watched file to restart.'
			sepLine: ->
				process.stdout.write cs.yellow _.repeat(
					'*', process.stdout.columns
				)
		}

		opts.watchList ?= opts.args

		childPromise = null
		start = ->
			opts.sepLine()

			childPromise = kit.spawn(
				opts.bin
				opts.args
				opts.opts
			)

			childPromise.then (msg) ->
				opts.onNormalExit msg
			.catch (err) ->
				if err.stack
					return Promise.reject err.stack
				opts.onErrorExit err

		watcher = (path, curr, prev) ->
			if curr.mtime != prev.mtime
				opts.onRestart path

				childPromise.catch(->).then(start)
				childPromise.process.kill 'SIGINT'

		process.on 'SIGINT', ->
			childPromise.process.kill 'SIGINT'
			process.exit()

		if opts.isNodeDeps
			kit.parseDependency opts.watchList, opts.parseDependency
			.then (paths) ->
				opts.onWatchFiles paths
				kit.watchFiles paths, { handler: watcher }
		else
			kit.watchFiles opts.watchList, { handler: watcher }

		opts.onStart()

		start()

		childPromise

	###*
	 * Node version. Such as `v0.10.23` is `0.1023`, `v0.10.1` is `0.1001`.
	 * @type {Float}
	###
	nodeVersion: ->
		ms = process.versions.node.match /(\d+)\.(\d+)\.(\d+)/
		str = ms[1] + '.' + _.padLeft(ms[2], 2, '0') + _.padLeft(ms[3], 2, '0')
		+str

	###*
	 * A helper for arguments type based function override.
	 * @param  {Array | Object} args The arguments to set.
	 * @param  {Object} defaults The default argument settings.
	 * The key value of the setting is the argument name, the value
	 * is an object, and the key is the type of the argument, the
	 * value is the default value of the argument.
	 * @return {Object}
	 * @example
	 * ```coffee
	 * foo = ->
	 * 	args = kit.defaultArgs arguments, {
	 * 		name: { String: 'A' }
	 * 		colors: { Array: [] }
	 * 		family: { String: null }
	 * 		isReal: { Boolean: false }
	 * 		fn: { Function: -> 'callback' }
	 * 	}
	 *
	 * kit.log foo('test', false, ['red'], -> 'nothing')
	 * # Here the logged value will deeply equal:
	 * { name: 'test', colors: ['red'], family: null, fn: -> 'nothing' }
	 * ```
	###
	defaultArgs: (args, defaults) ->
		set = _(args).toArray().groupBy (e) ->
			e.constructor.name
		.value()

		ret = {}
		for name, val of defaults
			[type] = _.keys val
			ret[name] = if set[type]
				v = set[type].shift()
				if v then v else val[type]
			else
				val[type]
		ret

	###*
	 * A comments parser for javascript and coffee-script.
	 * Used to generate documentation from source code automatically.
	 * It will traverse through all the comments of a coffee file.
	 * @param  {String} code Coffee source code.
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
	 * 	name: 'parseComment'
	 * 	description: 'A comments parser for coffee-script.'
	 * 	tags: [
	 * 		{
	 * 			tagName: 'param'
	 * 			type: 'string'
	 * 			name: 'code'
	 * 			description: 'The name of the module it belongs to.'
	 * 			index: 256 # The target char index in the file.
	 * 			line: 32 # The line number of the target in the file.
	 * 		}
	 * 	]
	 * }
	 * ```
	###
	parseComment: (code, opts = {}) ->
		_.defaults opts, {
			commentReg: ///
				# comment
				(?:\#\#\# | \/\*)\*
				([\s\S]+?)
				(?:\#\#\#|\*\/)
				# "var" and space
				\s+(?:var\s+)?
				# variable name
				([\w\.-]+)
			///g
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
				name: m[2]
				description: info.description
				tags: info.tags
				index: opts.commentReg.lastIndex
				line: _.reduce(code[...opts.commentReg.lastIndex]
				, (count, char) ->
					count++ if char == '\n'
					count
				, 1)
			}

		return comments

	###*
	 * Parse commment from a js or coffee file, and output a markdown string.
	 * @param  {String} path
	 * @param  {Object} opts Defaults:
	 * ```coffee
	 * {
	 * 		parseComment: {}
	 * 		formatComment: {
	 * 			name: ({ name, line }) ->
	 * 				name = name.replace 'self.', ''
	 * 				link = "#{path}?source#L#{line}"
	 * 				"- \#\#\# **[#{name}](#{link})**\n\n"
	 * 		}
	 * }
	 * ```
	 * @return {Promise} Resolve a markdown string.
	###
	parseFileComment: (path, opts = {}) ->
		_.defaults opts, {
			parseComment: {}
			formatComment: {
				name: ({ name, line }) ->
					name = name.replace 'self.', ''
					link = "#{path}?source#L#{line}"
					"- ### **[#{name}](#{link})**\n\n"
			}
		}

		kit.readFile path, 'utf8'
		.then (str) ->
			kit.parseComment str, opts.parseComment
		.then (comments) ->
			ret = kit.formatComment comments, opts.formatComment
			ret

	###*
	 * Parse dependency tree by regex. The dependency relationships
	 * is not a tree, but a graph. To avoid dependency cycle, this
	 * function only return an linear array of the dependencies,
	 * from which you won't get the detail relationshops between files.
	 * @param  {String | Array} entryPaths The file to begin with.
	 * @param  {Object} opts Defaults:
	 * ```coffee
	 * {
	 * 	depReg: /require\s*\(?['"](.+)['"]\)?/gm
	 * 	depRoots: ['']
	 * 	extensions: ['.js', '.coffee', 'index.js', 'index.coffee']
	 *
	 * 	# It will handle all the matched paths.
	 * 	# Return false value if you don't want this match.
	 * 	handle: (path) ->
	 * 		path.replace(/^[\s'"]+/, '').replace(/[\s'";]+$/, '')
	 * }
	 * ```
	 * @return {Promise} It resolves the dependency path array.
	 * @example
	 * ```coffee
	 * kit.parseDependency 'main.', {
	 * 	depReg: /require\s*\(?['"](.+)['"]\)?/gm
	 * 	handle: (path) ->
	 * 		return path if path.match /^(?:\.|\/|[a-z]:)/i
	 * }
	 * .then (markdownStr) ->
	 * 	kit.log markdownStr
	 * ```
	###
	parseDependency: (entryPaths, opts = {}, depPaths = {}) ->
		_.defaults opts, {
			depReg: /require\s*\(?['"](.+)['"]\)?/g
			depRoots: ['']
			extensions: ['.js', '.coffee', '/index.js', '/index.coffee']
			handle: (path) ->
				return path if path.match /^(?:\.|\/|[a-z]:)/i
		}

		winSep = /\\/g

		if _.isString entryPaths
			entryPaths = [entryPaths]

		entryPaths = entryPaths.reduce (s, p) ->
			if kit.path.extname p
				s.concat [p]
			else
				s.concat opts.extensions.map (ext) ->
					p + ext
		, []

		if opts.depRoots.indexOf('') == -1
			opts.depRoots.push ''

		entryPaths = entryPaths.reduce (s, p) ->
			s.concat opts.depRoots.map (root) ->
				kit.path.join root, p
		, []

		# Parse file.
		Promise.all entryPaths.map (entryPath) ->
			(if entryPath.indexOf('*') > -1
				kit.glob entryPaths
			else
				kit.fileExists entryPath
				.then (exists) ->
					if exists then [entryPath] else []
			).then (paths) ->
				Promise.all paths.map (path) ->
					# Prevent the recycle dependencies.
					return if depPaths[path]

					kit.readFile path, 'utf8'
					.then (str) ->
						# The point to add path to watch list.
						depPaths[path.replace winSep, '/'] = true
						dir = kit.path.dirname path

						entryPaths = []
						str.replace opts.depReg, (m, p) ->
							p = opts.handle p
							return if not p
							entryPaths.push p
							entryPaths.push kit.path.join(dir, p)

						kit.parseDependency entryPaths, opts, depPaths
		.then ->
			_.keys depPaths

	###*
	 * io.js native module `path`. See `nofs` for more information.
	###
	path: fs.path

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
	 * @example
	 * ```coffee
	 * readFile = kit.promisify fs.readFile, fs
	 * readFile('a.txt').then kit.log
	 * ```
	###
	promisify: fs.promisify

	###*
	 * Much faster than the native require of node, but you should
	 * follow some rules to use it safely.
	 * Use it to load nokit's internal module.
	 * @param {String} moduleName The module path or name.
	 * @param {String} dir Current file path. Not optional, expect when
	 * requiring nokit's internal modules.
	 * On most times, just pass `__dirname` to it is enough.
	 * @param {Function} loaded Run only the first time after the module loaded.
	 * @return {Module} The module that you require.
	 * @example
	 * Use it to load nokit's internal module.
	 * ```coffee
	 * kit.require 'jhash'
	 * # Then you can use the module, or it will be null.
	 * kit.jhash.hash 'test'
	 * ```
	 * To load a relative path, or you own module,
	 * the second parameter 'dir' is required.
	 * ```coffee
	 * mod = kit.require './mod', __dirname
	 *
	 * # Or load your own 'jhash', rather than nokit's.
	 * jhash = kit.require 'jhash', __dirname
	 * ```
	###
	require: (moduleName, dir, loaded) ->
		if _.isFunction dir
			loaded = dir
			dir = null

		key = moduleName + if dir then '@' + dir else ''

		return kit.requireCache[key] if kit.requireCache[key]

		if not dir?
			if moduleName[0] == '.' or kit[moduleName] != null
				err = new Error "argument 'dir' is not defined"
				err.source = 'nokit'
				throw err

			try return kit[moduleName] =
				kit.requireCache[key] =
				require './' + moduleName

			return kit[moduleName] =
				kit.requireCache[key] =
				require moduleName

		names = if moduleName[0] == '.'
			[kit.path.join dir, moduleName]
		else
			kit.genModulePaths moduleName, dir
			.concat if process.env.NODE_PATH
				for p in process.env.NODE_PATH.split kit.path.delimiter
					kit.path.join p, moduleName
			else []


		for name in names
			try
				kit.requireCache[key] = require name
				loaded? kit.requireCache[key]
				break

		if not kit.requireCache[key]
			throw new Error('Module not found: ' + moduleName)

		if kit[moduleName] == null
			kit[moduleName] = kit.requireCache[key]

		kit.requireCache[key]

	###*
	 * Require an optional package. If not found, it will
	 * warn the user to npm install it, and exit the process.
	 * @param {String} name Package name
	 * @param {String} dir Current file path. Not optional.
	 * On most times, just pass `__dirname` to it is enough.
	 * @param  {String} semver Specify what version you need,
	 * such as `^0.3.1` or `>=1.2.3`, ect.
	 * @return {Any} The required package.
	###
	requireOptional: (name, dir, semver) ->
		key = name + if dir then '@' + dir else ''
		return kit.requireCache[key] if kit.requireCache[key]

		try
			if semver
				kit.require 'semver'
				{ version } = kit.require name + '/package.json', dir
				if not kit.semver.satisfies version, semver
					info = "expect #{name} version " +
						"'#{semver}', but get '#{version}'"
					name = "#{name}@\"#{semver}\""
					throw new Error info

			kit.require name, dir
		catch err
			throw err if err.source == 'nokit'

			cs = kit.require 'colors/safe'
			kit.err(
				(cs.red "Optional module required.\n" +
				cs.red "If current module is installed globally, run " +
				cs.green "'npm install -g #{name}'" +
				cs.red " first, else run " +
				cs.green "'npm install #{name}'" + cs.red " first.\n") +
				err.stack
			, { isShowTime: false })
			process.exit 1

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
	 * You can also get the request object by using `Promise.req`.
	 * @example
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
		kit.require 'url'

		if _.isString opts
			opts = { url: opts }

		if _.isObject opts.url
			opts.url.protocol ?= 'http:'
		else
			if opts.url.indexOf('http') != 0
				opts.url = 'http://' + opts.url
			url = kit.url.parse opts.url
			url.protocol ?= 'http:'
		delete url.host

		request = null
		switch url.protocol
			when 'http:'
				{ request } = kit.require 'http', __dirname
			when 'https:'
				{ request } = kit.require 'https', __dirname
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
								unzip = kit.require 'zlib', __dirname
									.createGunzip()
							when 'deflate'
								unzip = kit.require 'zlib', __dirname
									.createInflat()
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
							if opts.resEncoding == 'auto'
								encoding = 'utf8'
								cType = res.headers['content-type']
								if _.isString cType
									m = cType.match(/charset=(.+);?/i)
									if m and m[1]
										encoding = m[1].toLowerCase()
										if encoding == 'utf-8'
											encoding = 'utf8'
									if !/^(text)|(application)\//.test(cType)
										encoding = null
							else
								encoding = opts.resEncoding

							decode = (buf) ->
								if not encoding
									return buf
								try
									if encoding == 'utf8'
										buf.toString()
									else
										kit.requireOptional 'iconv-lite'
										.decode buf, encoding
								catch err
									reject err

							if opts.autoUnzip
								switch res.headers['content-encoding']
									when 'gzip'
										unzip = kit.require 'zlib', __dirname
											.gunzip
									when 'deflate'
										unzip = kit.require 'zlib', __dirname
											.inflate
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
	 * The semantic versioner for npm, known as [semver](https://github.com/npm/node-semver).
	 * You must `kit.require 'semver'` before using it.
	 * @type {Object}
	###
	semver: null

	###*
	 * Sleep for awhile.
	 * @param  {Integer} time Time to sleep, millisecond.
	 * @return {Promise}
	###
	sleep: (time = 0) ->
		new Promise (resolve) ->
			setTimeout ->
				resolve()
			, time

	###*
	 * A safer version of `child_process.spawn` to cross-platform run
	 * a process. In some conditions, it may be more convenient
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
	 * **Resolves** when the process's stdio is drained and the exit
	 * code is either `0` or `130`. The resolve value
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
			kit.require 'whichSync'
			cmd = kit.whichSync cmd
			if cmd.slice(-3).toLowerCase() == 'cmd'
				cmdSrc = kit.fs.readFileSync(cmd, 'utf8')
				m = cmdSrc.match(/node\s+"%~dp0\\(\.\.\\.+)"/)
				if m and m[1]
					cmd = kit.path.join cmd, '..', m[1]
					cmd = kit.path.normalize cmd
					args = [cmd].concat args
					cmd = 'node'

		{ spawn } = kit.require 'child_process', __dirname

		ps = null
		promise = new Promise (resolve, reject) ->
			try
				ps = spawn cmd, args, opts
			catch err
				reject err

			ps.on 'error', (err) ->
				reject err

			ps.on 'close', (code, signal) ->
				if code == null or code == 0 or code == 130
					resolve { code, signal }
				else
					reject { code, signal }

		promise.process = ps
		promise

	###*
	 * Sequencing and executing tasks and dependencies concurrently.
	 * @param  {String}   name The task name.
	 * @param  {Object}   opts Optional. Defaults:
	 * ```coffee
	 * {
	 * 	deps: String | Array
	 * 	description: String
	 * 	log: ->
	 * 		kit.log 'Run Task >> ' +
	 * 			"[ #{name} ] " + this.description
	 *
	 * 	# Whether to run dependency in a row.
	 * 	isSequential: false
	 * }
	 * ```
	 * @param  {Function} fn `(val) -> Promise | Any` The task function.
	 * If it is a async task, it should return a promise.
	 * It will get its dependency tasks' resolved values.
	 * @property {Function} run Use it to start tasks. Each task will only run once.
	 * `(names = 'default', opts) ->`. The `names` can be a string or array.
	 * The default opts:
	 * ```coffee
	 * {
	 * 	isSequential: false
	 *
	 * 	# Will be passed as the first task's argument.
	 * 	init: undefined
	 *
	 * 	# To stop the run currently in process. Set the `$stop`
	 * 	# reference to true. It will reject a "runStopped" error.
	 * 	warp: { $stop: false }
	 * }
	 * ```
	 * @property {Object} list The defined task functions.
	 * @return {Promise} Resolve with the last task's resolved value.
	 * When `isSequential == true`, it resolves a value, else it resolves
	 * an array.
	 * @example
	 * ```coffee
	 * kit.task 'default', { deps: 'build' }, ->
	 * 	kit.log 'run defaults...'
	 *
	 * kit.task 'build', { deps: ['clean'] }, (isFull) ->
	 * 	if isFull
	 * 		'do something'
	 * 	else
	 * 		'do something else'
	 *
	 * kit.task 'clean', (opts) ->
	 * 	if opts.isForce
	 * 		kit.remove 'dist/**', { isForce: true }
	 * 	else
	 * 		kit.remove 'dist/**'
	 *
	 * kit.task.run()
	 * .then ->
	 * 	kit.log 'All Done!'
	 * ```
	###
	task: (name, opts, fn) ->
		cs = require 'colors/safe'
		if _.isFunction opts
			fn = opts
			opts = {}

		_.defaults opts, {
			isSequential: false
			description: ''
			log: ->
				kit.log cs.cyan('Run Task >> ') +
					cs.green("[#{name}] ") + @description
		}

		if _.isString opts.deps
			opts.deps = [opts.deps]

		kit.task.list ?= {}

		# Here we use some curry functions to deal with the race condition.
		runTask = (warp) -> (name) -> (val) ->
			if warp[name]
				warp[name]
			else
				warp[name] = kit.task.list[name](warp)(val)

		kit.task.list[name] = (warp) -> (val) ->
			if warp.$stop
				return Promise.reject new Error('runStopped')

			opts.log()

			if not opts.deps or opts.deps.length < 1
				return Promise.resolve fn(val)

			depTasks = opts.deps.map runTask(warp)

			(if opts.isSequential
				kit.flow(depTasks)(val)
			else
				Promise.all depTasks.map (task) -> task val
			).then fn

		kit.task.list[name].opts = opts

		kit.task.run ?= (names = 'default', opts = {}) ->
			if _.isString names
				names = [names]

			_.defaults opts, {
				isSequential: false
				init: undefined
				warp: { $stop: false }
			}

			task = runTask opts.warp

			if opts.isSequential
				kit.flow(names.map task) opts.init
			else
				Promise.all names.map (name) ->
					task(name) opts.init

	###*
	 * The `url` module of [io.js](iojs.org).
	 * You must `kit.require 'url'` before using it.
	###
	url: null

	###*
	 * Works much like `gulp.src`, but with Promise instead.
	 * The warp control and error handling is more pleasant.
	 * @param  {String} from Glob pattern string.
	 * @param  {Object} opts It extends the options of `nofs.glob`, but
	 * with some extra proptereis. Defaults:
	 * ```coffee
	 * {
	 * 	# The base directory of the pattern.
	 * 	baseDir: String
	 *
	 * 	# The encoding of the contents.
	 * 	# Set null if you want raw buffer.
	 * 	encoding: 'utf8'
	 *
	 * 	# Default `set` used in the `fileInfo` object.
	 * 	set: (contents) -> this
	 *
	 * 	# Default file reader plugin. Override it if you don't want
	 * 	# warp read file contents automatically.
	 * 	reader: (fileInfo) -> fileInfo
	 *
	 * 	# Default file writer plugin. Override it if you don't want
	 * 	# warp write file contents automatically.
	 * 	writer: (fileInfo) -> fileInfo
	 * }
	 * ```
	 * @return {Object} The returned warp object has these members:
	 * ```coffee
	 * {
	 * 	pipe: (handler) -> fileInfo | null
	 * 	to: (path) -> Promise
	 * }
	 * ```
	 * Each piped handler will recieve a
	 * object that extends `nofs`'s fileInfo object:
	 * ```coffee
	 * {
	 * 	# Set the contents and return self.
	 * 	set: (String | Buffer) -> fileInfo
	 *
	 * 	# The source path.
	 * 	path: String
	 *
	 * 	# The dest root path.
	 *  to: String
	 *
	 * 	# The destination path.
	 * 	# Alter it if you want to change the output file's location.
	 * 	# You can set it to string if you don't want "path.format".
	 * 	dest: {
	 * 		# These properties are parsed via io.js 'path.parse'.
	 *  	root: String
	 *  	dir: String
	 *
	 * 		# If the 'ext' or 'name' is not null,
	 * 		# the 'base' will be override by the 'ext' and 'name'.
	 *  	base: String
	 *  	ext: String
	 *  	name: String
	 * 	}
	 *
	 * 	# The file content.
	 * 	contents: String | Buffer
	 *
	 * 	isDir: Boolean
	 *
	 * 	stats: fs.Stats
	 *
	 * 	# All the globbed files.
	 * 	list: Array
	 *
	 * 	# The opts you passed to "nofs.glob".
	 * 	opts: Object
	 * }
	 * ```
	 * The handler can have a `onEnd` function, which will be called after the
	 * whole warp ended.
	 * The handler can have a `isReader` property, which will make the handler
	 * override the default file reader.
	 * @example
	 * ```coffee
	 * # Define a simple workflow.
	 * kit.warp 'src/**\/*.js'
	 * .pipe (fileInfo) ->
	 * 	fileInfo.set '/* Lisence Info *\/' + fileInfo.contents
	 * .pipe jslint()
	 * .pipe minify()
	 * .to 'build/minified'
	 *
	 * # Override warp's file reader with a custom one.
	 * myReader = (fileInfo) ->
	 * 	kit.readFile fileInfo.path, 'hex'
	 * 	.then fileInfo.set
	 *
	 * # This will tell warp you want use your own reader.
	 * myReader.isReader = true
	 *
	 * kit.warp 'src/**\/*.js'
	 * .pipe myReader
	 * .to 'dist'
	 * ```
	###
	warp: (from, opts = {}) ->
		_.defaults opts, {
			encoding: 'utf8'

			set: (contents) ->
				@contents = contents
				@

			reader: (fileInfo) ->
				(if fileInfo.isDir
					Promise.resolve()
				else
					kit.readFile fileInfo.path, opts.encoding
				).then fileInfo.set

			writer: (fileInfo) ->
				return if not fileInfo
				{ dest, contents } = fileInfo
				if dest? and contents?
					if _.isObject dest
						if dest.name? and dest.ext?
							dest.base = dest.name + dest.ext
						dest = kit.path.format dest

					fs.outputFile dest, contents, fileInfo.opts
		}

		pipeList = []
		onEndList = []

		opts.iter = (fileInfo, list) ->
			list.push fileInfo
			kit.flow(pipeList)(fileInfo)

		runTask = (task) -> (fileInfo) ->
			return if not fileInfo
			Promise.resolve task fileInfo
			.then (val) ->
				if not val? or val == fileInfo
					val
				else
					err = new Error 'wrong return value => ' + task
					Promise.reject err

		mapper =
			pipe: (task) ->
				if task.isReader
					opts.reader = task
				else
					pipeList.push runTask(task)

				if _.isFunction task.onEnd
					onEndList.push runTask(task.onEnd)
				mapper
			to: (to) ->
				pipeList.unshift (fileInfo) ->
					fileInfo.baseDir = opts.baseDir if opts.baseDir
					opts.reader _.extend(fileInfo, {
						to
						dest: kit.path.parse kit.path.join to,
							kit.path.relative fileInfo.baseDir, fileInfo.path
						set: opts.set.bind fileInfo
						opts
					})

				pipeList.push opts.writer
				onEndList.push opts.writer if onEndList.length > 0

				kit.glob(from, opts).then (list) ->
					kit.flow(onEndList)({ set: opts.set, to, list, opts })

	###*
	 * Same as the unix `which` command.
	 * You must `kit.require 'which'` before using it.
	 * @param {String} name The command.
	 * @return {Promise}
	###
	which: null

	###*
	 * Sync version of `which`.
	 * You must `kit.require 'whichSync'` before using it.
	 * @type {Function}
	###
	whichSync: null

	###*
	 * For debugging. Dump a colorful object.
	 * @param  {Object} obj Your target object.
	 * @param  {Object} opts Options. Default:
	 * ```coffee
	 * { colors: true, depth: 5 }
	 * ```
	 * @return {String}
	###
	xinspect: (obj, opts) ->
		util = kit.require 'util', __dirname

		_.defaults opts, {
			colors: kit.isDevelopment()
			depth: 5
		}

		str = util.inspect obj, opts

	###*
	 * Open a thing that your system can recognize.
	 * Now only support Windows, OSX or system that installed 'xdg-open'.
	 * @param  {String | Array} cmds  The thing you want to open.
	 * @param  {Object} opts The options of the node native
	 * `child_process.exec`.
	 * @return {Promise} When the child process exists.
	 * @example
	 * ```coffee
	 * # Open a webpage with the default browser.
	 * kit.open 'http://ysmood.org'
	 * ```
	###
	xopen: (cmds, opts = {}) ->
		(Promise.resolve switch process.platform
			when 'darwin'
				'open'
			when 'win32'
				'start'
			else
				try
					kit.require 'which'
					kit.which 'xdg-open'
				catch
					null
		).then (starter) ->
			return if not starter

			if _.isString cmds
				cmds = [cmds]

			kit.spawn starter, cmds

# Some debug options.
if kit.isDevelopment()
	Promise.longStackTraces()

module.exports = kit