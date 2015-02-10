'use strict'

_ = require './lodash'
fs = require 'nofs'
{ Promise } = fs

kit = {}

###*
 * Nokit extends all the functions of [nofs](https://github.com/ysmood/nofs).
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
	 * a promise, when it returns `kit.async.end`, the iteration ends.
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
	 * 	else
	 * 		kit.async.end
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
				[el] = list.splice 0, 1
				if el == undefined
					kit.async.end
				else if _.isFunction el
					el()
				else
					el

		else if _.isFunction list
			iter = list
		else
			return Promise.reject new Error 'wrong argument type: ' + list

		kit.async.end ?= {}

		new Promise (resolve, reject) ->
			addTask = ->
				try
					task = iter()
				catch err
					return Promise.reject err

				if isIterDone or task == kit.async.end
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
	 * A file cache helper. It use hard link to cache files.
	 * @param  {Object} info Not optional.
	 * ```coffee
	 * {
	 * 	# The path of the output file.
	 * 	# If it's undefined, depsCache will try to get cache.
	 * 	dest: String
	 *
	 * 	# The first item is the key path, others are
	 * 	# its dependencies.
	 * 	deps: Array
	 *
	 * 	cacheDir: '.nokit'
	 * }
	 * ```
	 * @return {Promise} Resolve a info object.
	 * ```coffee
	 * {
	 * 	isNewer: Boolean
	 *
	 * 	deps: Array
	 *
	 * 	dest: String
	 *
	 * 	# The path of the cache.
	 * 	path: String
	 *
	 * 	cacheError: undefined | Error
	 * }
	 * ```
	 * @example
	 * ```coffee
	 * # Set cache
	 * kit.depsCache {
	 * 	dest: 'index.css'
	 * 	deps: ['index.less', 'b.less', 'c.less']
	 * }
	 *
	 * # Get cache
	 * # You don't have to sepecify 'b.less', 'c.less'.
	 * kit.depsCache { deps: ['index.less'] }
	 * .then (info) ->
	 * 	if info.isNewer
	 * 		kit.log 'cache is newer'.
	 * ```
	###
	depsCache: (opts) ->
		_.defaults opts, {
			cacheDir: '.nokit'
		}

		kit.depsCache.jhash ?= new (kit.require('jhash').constructor)

		keyPath = opts.deps[0]

		cachePath = kit.path.join(
			opts.cacheDir
			kit.depsCache.jhash.hash(keyPath, true) + '-' +
			kit.path.basename(keyPath)
		)
		cacheInfoPath = cachePath + '.json'

		info = {}
		if opts.dest
			saveCache = ->
				kit.mkdirs(opts.cacheDir).then ->
					kit.link opts.dest, cachePath
				.catch (err) ->
					if err.code != 'EEXIST'
						return Promise.reject err
					kit.unlink(cachePath).then ->
						kit.link opts.dest, cachePath

			info = {
				dest: opts.dest
				deps: {}
			}
			Promise.all [
				saveCache()
				Promise.all(opts.deps.map (path, i) ->
					if i == 0
						return info.deps[path] = Date.now()
					kit.stat(path).then (stats) ->
						info.deps[path] = stats.mtime.getTime()
				).then ->
					kit.outputJson cacheInfoPath, info
			]

		else
			kit.readJson cacheInfoPath
			.then (data) ->
				info = data
				info.path = cachePath
				Promise.all _(info.deps).keys().map((path) ->
					kit.stat(path).then (stats) ->
						# cache mtime             file mtime
						info.deps[path] >= stats.mtime.getTime()
				).value()
			.then (latestList) ->
				info.deps = _.keys info.deps
				info.isNewer = _.all latestList
			.catch (err) -> info.cacheError = err
			.then -> info

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
	 * 	stdout: 'stdout.log' # Can also be a fd
	 * 	stderr: 'stderr.log' # Can also be a fd
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
	 * The warp drives.
	 * You must `kit.require 'drives'` before using it.
	 * @type {Object}
	###
	drives: null

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
	 * And the array can also contains promises or values other than function.
	 * If there's only one argument and it's a function, it will treat as an iterator,
	 * when it returns `kit.flow.end`, the iteration ends.
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
	 * @example
	 * Walk through first link of each page.
	 * ```coffee
	 * list = []
	 * iter = (url) ->
	 * 	return kit.flow.end if not url
	 *
	 * 	kit.request url
	 * 	.then (body) ->
	 * 		list.push body
	 * 		m = body.match /href="(.+?)"/
	 * 		m[0] if m
	 *
	 * walker = kit.flow iter
	 * walker 'test.com'
	 * ```
	###
	flow: (fns...) -> (val) ->
		genIter = (arr) ->
			(val) ->
				[fn] = arr.splice 0, 1
				if fn == undefined
					kit.flow.end
				else if _.isFunction fn
					fn val
				else
					fn

		if _.isArray fns[0]
			iter = genIter fns[0]
		else if fns.length == 1 and _.isFunction fns[0]
			iter = fns[0]
		else if fns.length > 1
			iter = genIter fns
		else
			return Promise.reject new Error 'wrong argument type: ' + fn

		kit.flow.end ?= {}

		run = (preFn) ->
			preFn.then (val) ->
				try
					fn = iter val
				catch err
					Promise.reject err

				return val if fn == kit.flow.end
				run if fn and _.isFunction fn.then
					fn
				else
					Promise.resolve fn

		run Promise.resolve val

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
	 * @param {String} keys The key word.
	 * @param {Array} list The list of string to search.
	 * @param {Object} opts Defaults:
	 * ```coffee
	 * {
	 * 	threshold: (cOffset, keyLen, cIndex) ->
	 * 		Infinity
	 * 	notFound: (cOffset, keyLen, cIndex) ->
	 * 		Infinity
	 * 	span: (cOffset, keyLen, cIndex) ->
	 * 		cOffset
	 * 	found: (cOffset, keyLen, cIndex) ->
	 * 		(Math.exp(cOffset + 1) - 1) * (keyLen - cIndex)
	 * 	tail: (cOffset, keyLen, cIndex, tailLen) ->
	 * 		tailLen
	 * }
	 * ```
	 * @return {String} The best matched one. If not found,
	 * return undefined.
	 * @example
	 * ```coffee
	 * kit.fuzzySearch 'hw', ['test', 'hello world', 'hey world']
	 * # output => 'hey world'
	 * ```
	###
	fuzzySearch: (key, list, opts = {}) ->
		_.defaults opts,
			threshold: (cOffset, keyLen, cIndex) ->
				Infinity
			notFound: (cOffset, keyLen, cIndex) ->
				Infinity
			span: (cOffset, keyLen, cIndex) ->
				cOffset
			found: (cOffset, keyLen, cIndex) ->
				(Math.exp(cOffset + 1) - 1) * (keyLen - cIndex)
			tail: (cOffset, keyLen, cIndex, tailLen) ->
				tailLen

		_ list
		.map (words) ->
			distance = 0
			keyLen = key.length
			for c, cIndex in key
				cOffset = words.indexOf c, cOffset + 1
				distance = if cOffset < 0
					opts.notFound cOffset, keyLen, cIndex
				else
					distance + opts.found(cOffset, keyLen, cIndex)

				distance += opts.span cOffset, keyLen, cIndex

				if distance >= opts.threshold(cOffset, keyLen, cIndex)
					return { distance: Infinity }

			distance += opts.tail cOffset, keyLen,
				cIndex, words[cOffset..].length

			if distance >= opts.threshold(cOffset, keyLen, cIndex)
				return { distance: Infinity }

			{ words, distance }
		.min 'distance'
		.words

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
	 * 	logReg: process.env.logReg and new RegExp process.env.logReg
	 * 	logTrace: process.env.logTrace == 'on'
	 * }
	 * ```
	 * @example
	 * ```coffee
	 * kit.log 'test'
	 * # => '[2015-02-07 08:31:49] test'
	 *
	 * kit.log 'test', { isShowTime: false }
	 * # => 'test'
	 *
	 * kit.log 'test', { logReg: /a/ }
	 * # => ''
	 *
	 * kit.log '%s %s %d', ['a', 'b', 10]
	 * # => '[2015-02-07 08:31:49] a b 10'
	 * ```
	###
	log: (args...) ->
		cs = kit.require 'colors/safe', ->
			if kit.isDevelopment()
				cs.mode = 'none'

		if _.isObject action
			opts = action
			action = 'log'

		msg = args[0]
		{ action, formats, opts } = kit.defaultArgs args[1..], {
			action: { String: 'log' }
			formats: { Array: null }
			opts: { Object: {} }
		}

		_.defaults opts, {
			isShowTime: true
			logReg: process.env.logReg and new RegExp process.env.logReg
			logTrace: process.env.logTrace == 'on'
		}

		if not kit.lastLogTime
			kit.lastLogTime = new Date
			if opts.logReg
				kit.logReg = opts.logReg

		if opts.isShowTime
			time = new Date()
			timeDelta = cs.magenta(+time - +kit.lastLogTime) + 'ms'
			kit.lastLogTime = time
			time = cs.grey [
				[
					[time.getFullYear(), 4, '0']
					[time.getMonth() + 1, 2, '0']
					[time.getDate(), 2, '0']
				].map((e) -> _.padLeft.apply 0, e).join('-')
				[
					[time.getHours(), 2, '0']
					[time.getMinutes(), 2, '0']
					[time.getSeconds(), 2, '0']
				].map((e) -> _.padLeft.apply 0, e).join(':')
			].join(' ')

		log = ->
			str = _.toArray(arguments).join ' '

			if kit.logReg and not kit.logReg.test(str)
				return

			console[action] str

			if opts.logTrace
				err = cs.grey (new Error).stack
					.replace(/.+\n.+\n.+/, '\nStack trace:')
				console.log err

		if _.isObject msg
			if opts.isShowTime
				log "[#{time}] ->\n" + kit.xinspect(msg, opts), timeDelta
			else
				log kit.xinspect(msg, opts), timeDelta
		else
			if formats
				formats.unshift msg
				util = kit.require 'util', __dirname
				msg = util.format.apply 0, formats

			if opts.isShowTime
				log "[#{time}] " + msg, timeDelta
			else
				log msg, timeDelta

		if action == 'error'
			process.stdout.write "\u0007"

		return

	###*
	 * Shortcut for logging multiple strings.
	 * @param  {Any} args...
	 * @example
	 * ```coffee
	 * kit.log 'test1', 'test2', test3'
	 * # => [2015-02-07 08:31:49] test1 test2 test3
	 * ```
	###
	logs: (args...) ->
		kit.log args.join ' '

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
	 * child process. Properties:
	 * ```coffee
	 * {
	 * 	process: Object
	 *
	 * 	# Call it to stop monitor.
	 * 	stop: ->
	 *
	 * 	# Resolve a list of watch handlers.
	 * 	watchPromise: Promise
	 * }
	 * ```
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

			childPromise.watchPromise = watchPromise

			childPromise.then (msg) ->
				opts.onNormalExit msg
			.catch (err) ->
				if err.stack
					return Promise.reject err.stack
				opts.onErrorExit err

		watcher = (path, curr, prev, isDelete) ->
			return if isDelete

			if curr.mtime != prev.mtime
				opts.onRestart path

				childPromise.catch(->).then(start)
				childPromise.process.kill 'SIGINT'

		stop = ->
			childPromise.watchPromise.then (list) ->
				kit.unwatchFile w.path, w.handler for w in list

		process.on 'SIGINT', ->
			childPromise.process.kill 'SIGINT'
			process.exit()

		watchPromise = if opts.isNodeDeps
			kit.parseDependency opts.watchList, opts.parseDependency
			.then (paths) ->
				opts.onWatchFiles paths
				kit.watchFiles paths, { handler: watcher }
		else
			kit.watchFiles opts.watchList, { handler: watcher }

		opts.onStart()

		start()

		_.extend childPromise, { watchPromise, stop }

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
				[v] = set[type].splice 0, 1
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
	 * @param {String} dir Current absolute file path. Not optional, expect when
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

			try
				modPath = require.resolve './' + moduleName
			catch e
				if e.code != 'MODULE_NOT_FOUND'
					throw e

			if modPath
				return kit[moduleName] =
					kit.requireCache[key] =
					require modPath

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
				modPath = require.resolve name
			catch e
				if e.code == 'MODULE_NOT_FOUND'
					modPath = null
				else
					throw e

			if modPath
				kit.requireCache[key] = require modPath
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
	 * @param {String} dir Current absolute file path. Not optional.
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
	 * 	logStart: ->
	 * 	logEnd: ->
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
			logStart: ->
				kit.log cs.cyan('Task Start >> ') +
					cs.green("[#{name}] ") + @description
			logEnd: ->
				kit.log cs.cyan('Task Done >> ') +
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

			opts.logStart()

			p = (if not opts.deps or opts.deps.length < 1
				Promise.resolve val
			else
				depTasks = opts.deps.map runTask(warp)

				if opts.isSequential
					kit.flow(depTasks)(val)
				else
					Promise.all depTasks.map (task) -> task val
			).then fn
			p.then opts.logEnd.bind opts
			p

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
	 * 	isCache: true
	 * 	cacheDir: '.nokit/warp'
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
	 * 	# The src file path.
	 * 	path: String
	 *
	 * 	# The dest root path.
	 * 	to: String
	 *
	 * 	baseDir: String
	 *
	 * 	# The destination path.
	 * 	# Alter it if you want to change the output file's location.
	 * 	# You can set it to string, warp will auto-convert it to object.
	 * 	# It's "valueOf" will return "kit.path.join dir, name + ext".
	 * 	dest: { root, dir, base, ext, name }
	 *
	 * 	# The file content.
	 * 	contents: String | Buffer
	 *
	 * 	isDir: Boolean
	 *
	 * 	stats: fs.Stats
	 *
	 * 	# Alter it to control the left drives dynamically.
	 * 	tasks: [Function]
	 *
	 * 	# All the globbed files.
	 * 	list: Array
	 *
	 * 	# The opts you passed to "kit.warp", it will be extended.
	 * 	# Extra properties: { driveList, taskList }
	 * 	opts: Object
	 * }
	 * ```
	 *
	 * The handler can have a `isReader` property, which will make the handler
	 * override the default file reader.
	 *
	 * The handler can have a `isWriter` property, which will make the handler
	 * override the default file writer.
	 * The writer can have a `onEnd` function, which will be called after the
	 * whole warp ended.
	 *
	 * If a drive overrides another, it can call `fileInfo.super()` to use it again.
	 * @example
	 * ```coffee
	 * # Define a simple workflow.
	 * kit.warp 'src/**\/*.js'
	 * .load (fileInfo) ->
	 * 	fileInfo.set '/* Lisence Info *\/' + fileInfo.contents
	 * .load jslint()
	 * .load minify()
	 * .run 'build/minified'
	 *
	 * # Override warp's file reader with a custom one.
	 * myReader = kit._.extend (fileInfo) ->
	 * 	# Note that we can also use "@path",
	 * 	# its the same with "fileInfo.path" here.
	 * 	kit.readFile @path, 'hex'
	 * 	.then @set
	 * , {
	 * 	# This will tell warp you want use your own reader.
	 * 	isReader: true
	 * }
	 *
	 * # Override writer.
	 * myWriter = kit._.extend (fileInfo) ->
	 * 	return if @dest == 'a.js'
	 *
	 * 	# Call the overrided writer.
	 * 	@super()
	 * , isWriter: true, onEnd: -> @super()
	 * 	kit.log @list
	 *
	 * kit.warp 'src/**\/*.js'
	 * .load myReader
	 * .run 'dist'
	 *
	 * # Use nokit's built-in warp drives.
	 * drives = kit.require 'drives'
	 * kit.warp src/**\/*.coffee'
	 * .load drives.coffee()
	 * .run 'dist'
	 * ```
	###
	warp: (from, opts = {}) ->
		drives = kit.require 'drives'

		_.defaults opts, {
			cacheDir: '.nokit/warp'
		}

		runDrive = (drive) -> (info) ->
			if _.isString info.dest
				info.dest = _.extend kit.path.parse(info.dest),
					valueOf: -> kit.path.join @dir, @name + @ext
			if drive.super
				info.super = -> drive.super.call info, info

			Promise.resolve drive.call(info, info)
			.then (val) -> info

		initInfo = (info) ->
			info.baseDir = opts.baseDir if opts.baseDir
			if info.path?
				info.dest = kit.path.join info.to,
					kit.path.relative info.baseDir, info.path

			_.extend info, {
				opts
				set: (contents) -> info.contents = contents
			}

		opts.driveList = []
		opts.taskList  = [] # safe drives
		reader = drives.reader opts
		writer = drives.writer opts

		warpper =
			load: (drive) ->
				if drive.isReader or drive.isWriter
					if drive.isWriter
						drive.super = writer
						drive.onEnd.super = writer.onEnd
						writer = drive
					else
						drive.super = reader
						reader = drive
				else
					opts.driveList.push drive
				warpper

			run: (to = '.') ->
				opts.driveList.unshift reader
				opts.driveList.push writer

				_.each opts.driveList, (drive) ->
					opts.taskList.push runDrive drive

				globOpts = _.extend {}, opts, iter: (info, list) ->
					list.push info
					info.baseDir = opts.baseDir if opts.baseDir
					_.extend info, { tasks: _.clone(opts.taskList), to, list }

					kit.flow(info.tasks) initInfo info

				kit.glob(from, globOpts).then (list) ->
					return if not writer.onEnd
					runDrive(writer.onEnd) initInfo { to, list }

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