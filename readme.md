# Nokit

Nokit is a light weight collection of commonly used functions.
It helps to reduce the gap between different systems.
Such as watch directory changes on a network file system, operate `spawn` on Windows and Linux, handle async IO api with promise, etc.

[![NPM version](https://badge.fury.io/js/nokit.svg)](http://badge.fury.io/js/nokit) [![Build Status](https://travis-ci.org/ysmood/nokit.svg)](https://travis-ci.org/ysmood/nokit) [![Build status](https://ci.appveyor.com/api/projects/status/3pwhk4ua9c3ojm0q?svg=true)](https://ci.appveyor.com/project/ysmood/nokit) [![Deps Up to Date](https://david-dm.org/ysmood/nokit.svg?style=flat)](https://david-dm.org/ysmood/nokit)

# Changelog

Goto [changelog](doc/changelog.md)

# API

- #### **[kit](lib/kit.coffee?source#L11)**

    All the async functions in `kit` return promise object.
    Most time I use it to handle files and system staffs.

    - **<u>type</u>**: { _Object_ }

- #### **[kitExtendsFsPromise](lib/kit.coffee?source#L32)**

    kit extends all the promise functions of [nofs](https://github.com/ysmood/nofs).

    [Offline Documentation](?gotoDoc=nofs/readme.md)

    - **<u>example</u>**:

        ```coffee
        kit.readFile('test.txt', 'utf8').then (str) ->
        	console.log str

        kit.outputFile 'a.txt', 'test'
        .then -> kit.log 'done'

        kit.fs.writeJSONSync 'b.json', { a: 10 }
        .then -> kit.log 'done'

        kit.fs.mkdirsP 'b.json', { a: 10 }
        .then -> kit.log 'done'
        ```

- #### **[_](lib/kit.coffee?source#L43)**

    The lodash lib.

    - **<u>type</u>**: { _Object_ }

- #### **[async](lib/kit.coffee?source#L92)**

    An throttled version of `Promise.all`, it runs all the tasks under
    a concurrent limitation.
    To run tasks sequentially, use `kit.compose`.

    - **<u>param</u>**: `limit` { _Int_ }

        The max task to run at a time. It's optional.
        Default is Infinity.

    - **<u>param</u>**: `list` { _Array | Function_ }

        If the list is an array, it should be a list of functions or promises,
        and each function will return a promise.
        If the list is a function, it should be a iterator that returns
        a promise, hen it returns `undefined`, the iteration ends.

    - **<u>param</u>**: `saveResutls` { _Boolean_ }

        Whether to save each promise's result or
        not. Default is true.

    - **<u>param</u>**: `progress` { _Function_ }

        If a task ends, the resolve value will be
        passed to this function.

    - **<u>return</u>**: { _Promise_ }

    - **<u>example</u>**:

        ```coffee
        urls = [
        	'http://a.com'
        	'http://b.com'
        	'http://c.com'
        	'http://d.com'
        ]
        tasks = [
        	-> kit.request url[0]
        	-> kit.request url[1]
        	-> kit.request url[2]
        	-> kit.request url[3]
        ]

        kit.async(tasks).then ->
        	kit.log 'all done!'

        kit.async(2, tasks).then ->
        	kit.log 'max concurrent limit is 2'

        kit.async 3, ->
        	url = urls.pop()
        	if url
        		kit.request url
        .then ->
        	kit.log 'all done!'
        ```

- #### **[compose](lib/kit.coffee?source#L186)**

    Creates a function that is the composition of the provided functions.
    Besides, it can also accept async function that returns promise.
    It's more powerful than `_.compose`, and it use reverse order for
    passing argument from one function to another.
    See `kit.async`, if you need concurrent support.

    - **<u>param</u>**: `fns` { _Function | Array_ }

        Functions that return
        promise or any value.
        And the array can also contains promises.

    - **<u>return</u>**: { _Function_ }

        A composed function that will return a promise.

    - **<u>example</u>**:

        ```coffee
        # It helps to decouple sequential pipeline code logic.

        createUrl = (name) ->
        	return "http://test.com/" + name

        curl = (url) ->
        	kit.request(url).then ->
        		kit.log 'get'

        save = (str) ->
        	kit.outputFile('a.txt', str).then ->
        		kit.log 'saved'

        download = kit.compose createUrl, curl, save
        # same as "download = kit.compose [createUrl, curl, save]"

        download 'home'
        ```

- #### **[daemonize](lib/kit.coffee?source#L209)**

    Daemonize a program. Just a shortcut usage of `kit.spawn`.

    - **<u>param</u>**: `opts` { _Object_ }

        Defaults:
        ```coffee
        {
        	bin: 'node'
        	args: ['app.js']
        	stdout: 'stdout.log' # Can also be a stream
        	stderr: 'stderr.log' # Can also be a stream
        }
        ```

    - **<u>return</u>**: { _Porcess_ }

        The daemonized process.

- #### **[decrypt](lib/kit.coffee?source#L236)**

    A simple decrypt helper. Cross-version of node.

    - **<u>param</u>**: `data` { _Any_ }

    - **<u>param</u>**: `password` { _String | Buffer_ }

    - **<u>param</u>**: `algorithm` { _String_ }

        Default is 'aes128'.

    - **<u>return</u>**: { _Buffer_ }

- #### **[encrypt](lib/kit.coffee?source#L259)**

    A simple encrypt helper. Cross-version of node.

    - **<u>param</u>**: `data` { _Any_ }

    - **<u>param</u>**: `password` { _String | Buffer_ }

    - **<u>param</u>**: `algorithm` { _String_ }

        Default is 'aes128'.

    - **<u>return</u>**: { _Buffer_ }

- #### **[err](lib/kit.coffee?source#L280)**

    A error log shortcut for `kit.log(msg, 'error', opts)`

    - **<u>param</u>**: `msg` { _Any_ }

    - **<u>param</u>**: `opts` { _Object_ }

- #### **[exec](lib/kit.coffee?source#L314)**

    A better `child_process.exec`. Supports multi-line shell script.
    For supporting old node version, it will create 3 temp files,
    the temp files will be removed after the execution.

    - **<u>param</u>**: `cmd` { _String_ }

        Shell commands.

    - **<u>param</u>**: `shell` { _String_ }

        Shell name. Such as `bash`, `zsh`. Optinal.

    - **<u>return</u>**: { _Promise_ }

        Resolves when the process's stdio is drained.
        The resolve value is like:
        ```coffee
        {
        	code: 0
        	signal: null
        	stdout: 'hello world'
        	stderr: ''
        }
        ```

    - **<u>example</u>**:

        ```coffee
        kit.exec("""
        	a='hello world'
         echo $a
        """).then ({code, stdout}) ->
        	kit.log code # output => 0
        	kit.log stdout # output => "hello world"

        # Bash doesn't support "**" recusive match pattern.
        kit.exec """
        	echo **/*.css
        """, 'zsh'
        ```

- #### **[formatComment](lib/kit.coffee?source#L378)**

    Format the parsed comments array to a markdown string.

    - **<u>param</u>**: `comments` { _Array_ }

    - **<u>param</u>**: `opts` { _Object_ }

        Defaults:
        ```coffee
        {
        	indent: 0
        	name: ({ name }) ->
        		name = name.replace 'self.', ''
        		"- \#\#\#\# #{name}\n\n"
        	tag: ({ tagName, name, type }) ->
        		tname = if name then " `#{name}`" else ''
        		ttype = if type then " { _#{type}_ }" else ''
        		"- **<u>#{tagName}</u>**:#{tname}#{ttype}"
        }
        ```

    - **<u>return</u>**: { _String_ }

- #### **[fs](lib/kit.coffee?source#L420)**

    See my project [nofs](https://github.com/ysmood/nofs).

    [Offline Documentation](?gotoDoc=nofs/readme.md)

- #### **[generateNodeModulePaths](lib/kit.coffee?source#L428)**

    Generate a list of module paths from a name and a directory.

    - **<u>param</u>**: `moduleName` { _String_ }

        The module name.

    - **<u>param</u>**: `dir` { _String_ }

        The root path. Default is current working dir.

    - **<u>return</u>**: { _Array_ }

        Paths

- #### **[jhash](lib/kit.coffee?source#L461)**

    A fast helper to hash string or binary file.
    See my [jhash][jhash] project.

    [Offline Documentation](?gotoDoc=jhash/readme.md)
    [jhash]: https://github.com/ysmood/jhash

    - **<u>example</u>**:

        ```coffee
        var jhash = require('jhash');
        jhash.hash('test'); // output => '349o'

        var fs = require('fs');
        jhash.hash(fs.readFileSync('a.jpg'));

        // Control the hash char set.
        jhash.setSymbols('abcdef');
        jhash.hash('test'); // output => 'decfddfe'

        // Control the max length of the result hash value. Unit is bit.
        jhash.setMaskLen(10);
        jhash.hash('test'); // output => 'ede'
        ```

- #### **[join](lib/kit.coffee?source#L480)**

    It inserts the fnB in between the fnA and concatenates the result.

    - **<u>param</u>**: `fnA` { _Any_ }

    - **<u>param</u>**: `fnB` { _Any_ }

    - **<u>return</u>**: { _Array_ }

    - **<u>example</u>**:

        ```coffee
        kit.join([1, 2, 3, 4], 'sep')
        # output => [1, 'sep', 2, 'sep', 3, 'sep', 4]

        iter = ->
        	i = 0
        	-> i++
        kit.join([1, 2, 3, 4], new iter)
        # output => [1, 'sep', 2, 'sep', 3, 'sep', 4]
        ```

- #### **[iter](lib/kit.coffee?source#L519)**

    Generate a iterator from a value.

    - **<u>param</u>**: `val` { _Any_ }

    - **<u>return</u>**: { _Function_ }

        The every time when the function been
        called, it returns a object looks like:
        ```coffee
        { key: 10, value: 'hello world' }
        ```
        The `key` can be `undefined`, `number` or `string`.

    - **<u>example</u>**:

        ```coffee
        iter = kit.iter [1, 2, 3]
        iter() # output => { key: 0, value: 1 }

        iter = kit.iter 'test'
        iter() # output => { key: 0, value: 't' }

        iter = kit.iter { a: 1, b: 2, c: 3 }
        iter() # output => { key: 'a', value: 1 }
        ```

- #### **[indent](lib/kit.coffee?source#L552)**

    Indent a text block.

    - **<u>param</u>**: `text` { _String_ }

    - **<u>param</u>**: `num` { _Int_ }

    - **<u>param</u>**: `char` { _String_ }

    - **<u>param</u>**: `reg` { _RegExp_ }

        Default is `/^/mg`.

    - **<u>return</u>**: { _String_ }

        The indented text block.

    - **<u>example</u>**:

        ```coffee
        # Increase
        kit.indent "one\ntwo", 2
        # => "  one\n  two"

        # Decrease
        kit.indent "--one\n--two", 0, '', /^--/mg
        # => "one\ntwo"
        ```

- #### **[inspect](lib/kit.coffee?source#L565)**

    For debugging. Dump a colorful object.

    - **<u>param</u>**: `obj` { _Object_ }

        Your target object.

    - **<u>param</u>**: `opts` { _Object_ }

        Options. Default:
        ```coffee
        { colors: true, depth: 5 }
        ```

    - **<u>return</u>**: { _String_ }

- #### **[isDevelopment](lib/kit.coffee?source#L581)**

    Nobone use it to check the running mode of the app.
    Overwrite it if you want to control the check logic.
    By default it returns the `rocess.env.NODE_ENV == 'development'`.

    - **<u>return</u>**: { _Boolean_ }

- #### **[isProduction](lib/kit.coffee?source#L590)**

    Nobone use it to check the running mode of the app.
    Overwrite it if you want to control the check logic.
    By default it returns the `rocess.env.NODE_ENV == 'production'`.

    - **<u>return</u>**: { _Boolean_ }

- #### **[log](lib/kit.coffee?source#L605)**

    A better log for debugging, it uses the `kit.inspect` to log.

    Use terminal command like `logReg='pattern' node app.js` to
    filter the log info.

    Use `logTrace='on' node app.js` to force each log end with a
    stack trace.

    - **<u>param</u>**: `msg` { _Any_ }

        Your log message.

    - **<u>param</u>**: `action` { _String_ }

        'log', 'error', 'warn'.

    - **<u>param</u>**: `opts` { _Object_ }

        Default is same with `kit.inspect`

- #### **[monitorApp](lib/kit.coffee?source#L701)**

    Monitor an application and automatically restart it when file changed.
    Even when the monitored app exit with error, the monitor will still wait
    for your file change to restart the application. Not only nodejs, but also
    other programs like ruby or python.
    It will print useful infomation when it application unexceptedly.

    - **<u>param</u>**: `opts` { _Object_ }

        Defaults:
        ```coffee
        {
        	bin: 'node'
        	args: ['index.js']
        	watchList: [] # By default, the same with the "args".
        	isNodeDeps: true
        	opts: {} # Same as the opts of 'kit.spawn'.

        	# The option of `kit.parseDependency`
        	parseDependency: {}

        	onStart: ->
        		kit.log "Monitor: ".yellow + opts.watchList
        	onRestart: (path) ->
        		kit.log "Reload app, modified: ".yellow + path
        	onWatchFiles: (paths) ->
        		kit.log 'Watching:'.yellow + paths.join(', ')
        	onNormalExit: ({ code, signal }) ->
        		kit.log 'EXIT'.yellow +
        			" code: #{(code + '').cyan} signal: #{(signal + '').cyan}"
        	onErrorExit: ->
        		kit.err 'Process closed. Edit and save
        			the watched file to restart.'.red
        	sepLine: ->
        		chars = _.times(process.stdout.columns, -> '*')
        		console.log chars.join('').yellow
        }
        ```

    - **<u>return</u>**: { _Promise_ }

        It has a property `process`, which is the monitored
        child process.

    - **<u>example</u>**:

        ```coffee
        kit.monitorApp {
        	bin: 'coffee'
        	args: ['main.coffee']
        }

        kit.monitorApp {
        	bin: 'ruby'
        	args: ['app.rb', 'lib/**/*.rb']
        	isNodeDeps: false
        }
        ```

- #### **[nodeVersion](lib/kit.coffee?source#L774)**

    Node version. Such as `v0.10.23` is `0.1023`, `v0.10.1` is `0.1001`.

    - **<u>type</u>**: { _Float_ }

- #### **[xopen](lib/kit.coffee?source#L792)**

    Open a thing that your system can recognize.
    Now only support Windows, OSX or system that installed 'xdg-open'.

    - **<u>param</u>**: `cmd` { _String_ }

        The thing you want to open.

    - **<u>param</u>**: `opts` { _Object_ }

        The options of the node native
        `child_process.exec`.

    - **<u>return</u>**: { _Promise_ }

        When the child process exists.

    - **<u>example</u>**:

        ```coffee
        # Open a webpage with the default browser.
        kit.open 'http://ysmood.org'
        ```

- #### **[pad](lib/kit.coffee?source#L827)**

    String padding helper. It is used in the `kit.log`.

    - **<u>param</u>**: `str` { _Sting | Number_ }

    - **<u>param</u>**: `width` { _Number_ }

    - **<u>param</u>**: `char` { _String_ }

        Padding char. Default is '0'.

    - **<u>return</u>**: { _String_ }

    - **<u>example</u>**:

        ```coffee
        kit.pad '1', 3 # '001'
        ```

- #### **[parseComment](lib/kit.coffee?source#L869)**

    A comments parser for javascript and coffee-script.
    Used to generate documentation from source code automatically.
    It will traverse through all the comments of a coffee file.

    - **<u>param</u>**: `code` { _String_ }

        Coffee source code.

    - **<u>param</u>**: `opts` { _Object_ }

        Parser options:
        ```coffee
        {
        	commentReg: RegExp
        	splitReg: RegExp
        	tagNameReg: RegExp
        	typeReg: RegExp
        	nameReg: RegExp
        	nameTags: ['param', 'property']
        	descriptionReg: RegExp
        }
        ```

    - **<u>return</u>**: { _Array_ }

        The parsed comments. Each item is something like:
        ```coffee
        {
        	name: 'parseComment'
        	description: 'A comments parser for coffee-script.'
        	tags: [
        		{
        			tagName: 'param'
        			type: 'string'
        			name: 'code'
        			description: 'The name of the module it belongs to.'
        			index: 256 # The target char index in the file.
        			line: 32 # The line number of the target in the file.
        		}
        	]
        }
        ```

- #### **[parseFileComment](lib/kit.coffee?source#L959)**

    Parse commment from a js or coffee file, and output a markdown string.

    - **<u>param</u>**: `path` { _String_ }

    - **<u>param</u>**: `opts` { _Object_ }

        Defaults:
        ```coffee
        {
        		name: ''
        		parseComment: {}
        		formatComment: {
        			name: ({ name, line }) ->
        				name = name.replace 'self.', ''
        				link = "#{path}?source#L#{line}"
        				"- \#\#\#\# **[#{name}](#{link})**\n\n"
        		}
        }
        ```

    - **<u>return</u>**: { _String_ }

- #### **[parseDependency](lib/kit.coffee?source#L1007)**

    Parse dependency tree by regex. The dependency relationships
    is not a tree, but a graph. To avoid dependency cycle, this
    function only return an linear array of the dependencies,
    from which you won't get the detail relationshops between files.

    - **<u>param</u>**: `entryPaths` { _String | Array_ }

        The file to begin with.

    - **<u>param</u>**: `opts` { _Object_ }

        Defaults:
        ```coffee
        {
        	depReg: /require\s*\(?['"](.+)['"]\)?/gm
        	depRoots: ['']
        	extensions: ['.js', '.coffee', 'index.js', 'index.coffee']

        	# It will handle all the matched paths.
        	# Return false value if you don't want this match.
        	handle: (path) ->
        		path.replace(/^[\s'"]+/, '').replace(/[\s'";]+$/, '')
        }
        ```

    - **<u>return</u>**: { _Promise_ }

        It resolves the dependency path array.

    - **<u>example</u>**:

        ```coffee
        kit.parseDependency 'main.', {
        	depReg: /require\s*\(?['"](.+)['"]\)?/gm
         handle: (path) ->
        		return path if path.match /^(?:\.|/|[a-z]:)/i
        }
        ```

- #### **[path](lib/kit.coffee?source#L1068)**

    Node native module `path`.

- #### **[Promise](lib/kit.coffee?source#L1076)**

    The promise lib. Now, it uses Bluebird as ES5 polyfill.
    In the future, the Bluebird will be replaced with native
    ES6 Promise. Please don't use any API other than the ES6 spec.

    - **<u>type</u>**: { _Object_ }

- #### **[promisify](lib/kit.coffee?source#L1089)**

    Convert a callback style function to a promise function.

    - **<u>param</u>**: `fn` { _Function_ }

    - **<u>param</u>**: `this` { _Any_ }

        `this` object of the function.

    - **<u>return</u>**: { _Function_ }

        The function will return a promise object.

    - **<u>example</u>**:

        ```coffee
        readFile = kit.promisify fs.readFile, fs
        readFile('a.txt').then kit.log
        ```

- #### **[require](lib/kit.coffee?source#L1109)**

    Much faster than the native require of node, but you should
    follow some rules to use it safely.

    - **<u>param</u>**: `moduleName` { _String_ }

        Relative moudle path is not allowed!
        Only allow absolute path or module name.

    - **<u>param</u>**: `done` { _Function_ }

        Run only the first time after the module loaded.

    - **<u>return</u>**: { _Module_ }

        The module that you require.

- #### **[requireOptional](lib/kit.coffee?source#L1137)**

    Require an optional package. If not found, it will
    warn user to npm install it, and exit the process.

    - **<u>param</u>**: `name` { _String_ }

        Package name

    - **<u>return</u>**: { _Any_ }

        The required package.

- #### **[request](lib/kit.coffee?source#L1245)**

    A handy extended combination of `http.request` and `https.request`.

    - **<u>param</u>**: `opts` { _Object_ }

        The same as the [http.request](http://nodejs.org/api/http.html#httpHttpRequestOptionsCallback),
        but with some extra options:
        ```coffee
        {
        	url: 'It is not optional, String or Url Object.'

        	# Other than return `res` with `res.body`,return `body` directly.
        	body: true

        	# Max times of auto redirect. If 0, no auto redirect.
        	redirect: 0

        	# Timeout of the socket of the http connection.
        	# If timeout happens, the promise will reject.
        	# Zero means no timeout.
        	timeout: 0

        	# The key of headers should be lowercased.
        	headers: {}

        	host: 'localhost'
        	hostname: 'localhost'
        	port: 80
        	method: 'GET'
        	path: '/'
        	auth: ''
        	agent: null

        	# Set "transfer-encoding" header to 'chunked'.
        	setTE: false

        	# Set null to use buffer, optional.
        	# It supports GBK, ShiftJIS etc.
        	# For more info, see https://github.com/ashtuchkin/iconv-lite
        	resEncoding: 'auto'

        	# It's string, object or buffer, optional. When it's an object,
        	# The request will be 'application/x-www-form-urlencoded'.
        	reqData: null

        	# auto end the request.
        	autoEndReq: true

        	# Readable stream.
        	reqPipe: null

        	# Writable stream.
        	resPipe: null

        	# The progress of the request.
        	reqProgress: (complete, total) ->

        	# The progress of the response.
        	resProgress: (complete, total) ->
        }
        ```
        And if set opts as string, it will be treated as the url.

    - **<u>return</u>**: { _Promise_ }

        Contains the http response object,
        it has an extra `body` property.
        You can also get the request object by using `Promise.req`.

    - **<u>example</u>**:

        ```coffee
        p = kit.request 'http://test.com'
        p.req.on 'response', (res) ->
        	kit.log res.headers['content-length']
        p.then (body) ->
        	kit.log body # html or buffer

        kit.request {
        	url: 'https://test.com/a.mp3'
        	body: false
        	resProgress: (complete, total) ->
        		kit.log "Progress: #{complete} / #{total}"
        }
        .then (res) ->
        	kit.log res.body.length
        	kit.log res.headers

        # Send form-data.
        form = new (require 'form-data')
        form.append 'a.jpg', new Buffer(0)
        form.append 'b.txt', 'hello world!'
        kit.request {
        	url: 'a.com'
        	headers: form.getHeaders()
        	setTE: true
        	reqPipe: form
        }
        .then (body) ->
        	kit.log body
        ```

- #### **[spawn](lib/kit.coffee?source#L1461)**

    A safer version of `child_process.spawn` to cross-platform run
    a process. In some conditions, it may be more convenient
    to use the `kit.exec`.
    It will automatically add `node_modules/.bin` to the `PATH`
    environment variable.

    - **<u>param</u>**: `cmd` { _String_ }

        Path or name of an executable program.

    - **<u>param</u>**: `args` { _Array_ }

        CLI arguments.

    - **<u>param</u>**: `opts` { _Object_ }

        Process options.
        Same with the Node.js official documentation.
        Except that it will inherit the parent's stdio.

    - **<u>return</u>**: { _Promise_ }

        The `promise.process` is the spawned child
        process object.
        **Resolves** when the process's stdio is drained and the exit
        code is either `0` or `130`. The resolve value
        is like:
        ```coffee
        {
        	code: 0
        	signal: null
        }
        ```

    - **<u>example</u>**:

        ```coffee
        kit.spawn 'git', ['commit', '-m', '42 is the answer to everything']
        .then ({code}) -> kit.log code
        ```

- #### **[url](lib/kit.coffee?source#L1512)**

    Node native module `url`.



# Lisence

MIT