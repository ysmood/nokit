### kit

- #### <a href="lib/kit.coffee?source#L11" target="_blank"><b>kit</b></a>

 All the async functions in `kit` return promise object.
 Most time I use it to handle files and system staffs.

 - **<u>type</u>**:  { _Object_ }

- #### <a href="lib/kit.coffee?source#L26" target="_blank"><b>kitExtendsFsPromise</b></a>

 kit extends all the promise functions of [fs-more][fs-more].
 
 [Offline Documentation](?gotoDoc=fs-more/readme.md)
 [fs-more]: https://github.com/ysmood/fs-more

 - **<u>example</u>**:

    ```coffee
    kit.readFile('test.txt').then (str) ->
    	console.log str
    
    kit.outputFile('a.txt', 'test').then()
    ```

- #### <a href="lib/kit.coffee?source#L37" target="_blank"><b>_</b></a>

 The lodash lib.

 - **<u>type</u>**:  { _Object_ }

- #### <a href="lib/kit.coffee?source#L85" target="_blank"><b>async</b></a>

 An throttle version of `Promise.all`, it runs all the tasks under
 a concurrent limitation.

 - **<u>param</u>**: `limit` { _Int_ }

    The max task to run at the same time. It's optional.
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

 - **<u>return</u>**:  { _Promise_ }

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

- #### <a href="lib/kit.coffee?source#L178" target="_blank"><b>compose</b></a>

 Creates a function that is the composition of the provided functions.
 Besides it can also accept async function that returns promise.
 It's more powerful than `_.compose`.

 - **<u>param</u>**: `fns` { _Function | Array_ }

    Functions that return
    promise or any value.
    And the array can also contains promises.

 - **<u>return</u>**:  { _Function_ }

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

- #### <a href="lib/kit.coffee?source#L199" target="_blank"><b>daemonize</b></a>

 Daemonize a program.

 - **<u>param</u>**: `opts` { _Object_ }

    Defaults:
    {
    	bin: 'node'
    	args: ['app.js']
    	stdout: 'stdout.log'
    	stderr: 'stderr.log'
    }

 - **<u>return</u>**:  { _Porcess_ }

    The daemonized process.

- #### <a href="lib/kit.coffee?source#L225" target="_blank"><b>decrypt</b></a>

 A simple decrypt helper

 - **<u>param</u>**: `data` { _Any_ }

 - **<u>param</u>**: `password` { _String | Buffer_ }

 - **<u>param</u>**: `algorithm` { _String_ }

    Default is 'aes128'.

 - **<u>return</u>**:  { _Buffer_ }

- #### <a href="lib/kit.coffee?source#L248" target="_blank"><b>encrypt</b></a>

 A simple encrypt helper

 - **<u>param</u>**: `data` { _Any_ }

 - **<u>param</u>**: `password` { _String | Buffer_ }

 - **<u>param</u>**: `algorithm` { _String_ }

    Default is 'aes128'.

 - **<u>return</u>**:  { _Buffer_ }

- #### <a href="lib/kit.coffee?source#L269" target="_blank"><b>err</b></a>

 A log error shortcut for `kit.log(msg, 'error', opts)`

 - **<u>param</u>**: `msg` { _Any_ }

 - **<u>param</u>**: `opts` { _Object_ }

- #### <a href="lib/kit.coffee?source#L290" target="_blank"><b>exec</b></a>

 A better `child_process.exec`.

 - **<u>param</u>**: `cmd` { _String_ }

    Shell commands.

 - **<u>param</u>**: `shell` { _String_ }

    Shell name. Such as `bash`, `zsh`. Optinal.

 - **<u>return</u>**:  { _Promise_ }

    Resolves when the process's stdio is drained.

 - **<u>example</u>**:

    ```coffee
    kit.exec """
    a=10
    echo $a
    """
    
    # Bash doesn't support "**" recusive match pattern.
    kit.exec """
    echo **/*.css
    """, 'zsh'
    ```

- #### <a href="lib/kit.coffee?source#L327" target="_blank"><b>fs</b></a>

 See my project [fs-more][fs-more].
 
 [Offline Documentation](?gotoDoc=fs-more/readme.md)
 [fs-more]: https://github.com/ysmood/fs-more

- #### <a href="lib/kit.coffee?source#L335" target="_blank"><b>generateNodeModulePaths</b></a>

 Generate a list of module paths from a name and a directory.

 - **<u>param</u>**: `moduleName` { _String_ }

    The module name.

 - **<u>param</u>**: `dir` { _String_ }

    The root path. Default is current working dir.

 - **<u>return</u>**:  { _Array_ }

    Paths

- #### <a href="lib/kit.coffee?source#L353" target="_blank"><b>glob</b></a>

 See the https://github.com/isaacs/node-glob
 
 [Offline Documentation](?gotoDoc=glob/readme.md)

 - **<u>param</u>**: `patterns` { _String | Array_ }

    Minimatch pattern.

 - **<u>param</u>**: `opts` { _Object_ }

    The glob options.

 - **<u>return</u>**:  { _Promise_ }

    Contains the path list.

- #### <a href="lib/kit.coffee?source#L393" target="_blank"><b>jhash</b></a>

 See my [jhash][jhash] project.
 
 [Offline Documentation](?gotoDoc=jhash/readme.md)
 [jhash]: https://github.com/ysmood/jhash

- #### <a href="lib/kit.coffee?source#L402" target="_blank"><b>inspect</b></a>

 For debugging use. Dump a colorful object.

 - **<u>param</u>**: `obj` { _Object_ }

    Your target object.

 - **<u>param</u>**: `opts` { _Object_ }

    Options. Default:
    { colors: true, depth: 5 }

 - **<u>return</u>**:  { _String_ }

- #### <a href="lib/kit.coffee?source#L418" target="_blank"><b>isDevelopment</b></a>

 Nobone use it to check the running mode of the app.
 Overwrite it if you want to control the check logic.
 By default it returns the `rocess.env.NODE_ENV == 'development'`.

 - **<u>return</u>**:  { _Boolean_ }

- #### <a href="lib/kit.coffee?source#L427" target="_blank"><b>isProduction</b></a>

 Nobone use it to check the running mode of the app.
 Overwrite it if you want to control the check logic.
 By default it returns the `rocess.env.NODE_ENV == 'production'`.

 - **<u>return</u>**:  { _Boolean_ }

- #### <a href="lib/kit.coffee?source#L442" target="_blank"><b>log</b></a>

 A better log for debugging, it uses the `kit.inspect` to log.
 
 You can use terminal command like `logReg='pattern' node app.js` to
 filter the log info.
 
 You can use `logTrace='on' node app.js` to force each log end with a
 stack trace.

 - **<u>param</u>**: `msg` { _Any_ }

    Your log message.

 - **<u>param</u>**: `action` { _String_ }

    'log', 'error', 'warn'.

 - **<u>param</u>**: `opts` { _Object_ }

    Default is same with `kit.inspect`

- #### <a href="lib/kit.coffee?source#L503" target="_blank"><b>monitorApp</b></a>

 Monitor an application and automatically restart it when file changed.
 When the monitored app exit with error,
 the monitor itself will also exit.
 It will make sure your app crash properly.

 - **<u>param</u>**: `opts` { _Object_ }

    Defaults:
    ```coffee
    {
    	bin: 'node'
    	args: ['app.js']
    	watchList: ['app.js']
    	opts: {} # Such as 'cwd', 'stdio', 'env'
    }
    ```

 - **<u>return</u>**:  { _Process_ }

    The child process.

- #### <a href="lib/kit.coffee?source#L558" target="_blank"><b>nodeVersion</b></a>

 Node version. Such as `v0.10.23` is `0.1023`, `v0.10.1` is `0.1001`.

 - **<u>type</u>**:  { _Float_ }

- #### <a href="lib/kit.coffee?source#L576" target="_blank"><b>open</b></a>

 Open a thing that your system can recognize.
 Now only support Windows, OSX or system that installed 'xdg-open'.

 - **<u>param</u>**: `cmd` { _String_ }

    The thing you want to open.

 - **<u>param</u>**: `opts` { _Object_ }

    The options of the node native
    `child_process.exec`.

 - **<u>return</u>**:  { _Promise_ }

    When the child process exits.

 - **<u>example</u>**:

    ```coffee
    # Open a webpage with the default browser.
    kit.open 'http://ysmood.org'
    ```

- #### <a href="lib/kit.coffee?source#L611" target="_blank"><b>pad</b></a>

 String padding helper.

 - **<u>param</u>**: `str` { _Sting | Number_ }

 - **<u>param</u>**: `width` { _Number_ }

 - **<u>param</u>**: `char` { _String_ }

    Padding char. Default is '0'.

 - **<u>return</u>**:  { _String_ }

 - **<u>example</u>**:

    ```coffee
    kit.pad '1', 3 # '001'
    ```

- #### <a href="lib/kit.coffee?source#L657" target="_blank"><b>parseComment</b></a>

 A comments parser for coffee-script.
 Used to generate documentation automatically.
 It will traverse through all the comments.

 - **<u>param</u>**: `moduleName` { _String_ }

    The name of the module it belongs to.

 - **<u>param</u>**: `code` { _String_ }

    Coffee source code.

 - **<u>param</u>**: `path` { _String_ }

    The path of the source code.

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

 - **<u>return</u>**:  { _Array_ }

    The parsed comments. Each item is something like:
    ```coffee
    {
    	module: 'nobone'
    	name: 'parseComment'
    	description: 'A comments parser for coffee-script.'
    	tags: [
    		{
    			tagName: 'param'
    			type: 'string'
    			name: 'code'
    			description: 'The name of the module it belongs to.'
    			path: 'http://thePathOfSourceCode'
    			index: 256 # The target char index in the file.
    			line: 32 # The line number of the target in the file.
    		}
    	]
    }
    ```

- #### <a href="lib/kit.coffee?source#L725" target="_blank"><b>path</b></a>

 Node native module

- #### <a href="lib/kit.coffee?source#L733" target="_blank"><b>Promise</b></a>

 The promise lib. Now, it uses Bluebird as ES5 polyfill.
 In the future, the Bluebird will be replaced.
 Please don't use any API other than the ES5 spec.

 - **<u>type</u>**:  { _Object_ }

- #### <a href="lib/kit.coffee?source#L741" target="_blank"><b>promisify</b></a>

 Convert a callback style function to a promise function.

 - **<u>param</u>**: `fn` { _Function_ }

 - **<u>param</u>**: `this` { _Any_ }

    `this` object of the function.

 - **<u>return</u>**:  { _Function_ }

    The function will return a promise object.

- #### <a href="lib/kit.coffee?source#L761" target="_blank"><b>require</b></a>

 Much much faster than the native require of node, but
 you should follow some rules to use it safely.

 - **<u>param</u>**: `moduleName` { _String_ }

    Relative moudle path is not allowed!
    Only allow absolute path or module name.

 - **<u>param</u>**: `done` { _Function_ }

    Run only the first time after the module loaded.

 - **<u>return</u>**:  { _Module_ }

    The module that you require.

- #### <a href="lib/kit.coffee?source#L856" target="_blank"><b>request</b></a>

 A powerful extended combination of `http.request` and `https.request`.

 - **<u>param</u>**: `opts` { _Object_ }

    The same as the [http.request][http.request],
    but with some extra options:
    ```coffee
    {
    	url: 'It is not optional, String or Url Object.'
    
    	# Other than return `res` with `res.body`,return `body` directly.
    	body: true
    
    	# Max times of auto redirect. If 0, no auto redirect.
    	redirect: 0
    
    	host: 'localhost'
    	hostname: 'localhost'
    	port: 80
    	method: 'GET'
    	path: '/'
    	headers: {}
    	auth: ''
    	agent: null
    
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
    	# If this option is set, the `headers['content-length']`
    	# should also be set.
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
    [http.request]: http://nodejs.org/api/http.html#httpHttpRequestOptionsCallback

 - **<u>return</u>**:  { _Promise_ }

    Contains the http response object,
    it has an extra `body` property.
    You can also get the request object by using `Promise.req`, for example:
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
    ```

- #### <a href="lib/kit.coffee?source#L1046" target="_blank"><b>spawn</b></a>

 A safer version of `child_process.spawn` to run a process on
 Windows or Linux.
 It will automatically add `node_modules/.bin` to the `PATH`
 environment variable.

 - **<u>param</u>**: `cmd` { _String_ }

    Path of an executable program.

 - **<u>param</u>**: `args` { _Array_ }

    CLI arguments.

 - **<u>param</u>**: `opts` { _Object_ }

    Process options.
    Same with the Node.js official doc.
    Default will inherit the parent's stdio.

 - **<u>return</u>**:  { _Promise_ }

    The `promise.process` is the child process object.
    When the child process ends, it will resolve.

- #### <a href="lib/kit.coffee?source#L1094" target="_blank"><b>url</b></a>

 Node native module

- #### <a href="lib/kit.coffee?source#L1119" target="_blank"><b>watchFile</b></a>

 Watch a file. If the file changes, the handler will be invoked.
 You can change the polling interval by using `process.env.pollingWatch`.
 Use `process.env.watchPersistent = 'off'` to disable the persistent.
 For samba server, we have to choose `watchFile` other than `watch`.

 - **<u>param</u>**: `path` { _String_ }

    The file path

 - **<u>param</u>**: `handler` { _Function_ }

    Event listener.
    The handler has these params:
    - file path
    - current `fs.Stats`
    - previous `fs.Stats`
    - if its a deletion

 - **<u>param</u>**: `autoUnwatch` { _Boolean_ }

    Auto unwatch the file while file deletion.
    Default is true.

 - **<u>return</u>**:  { _Function_ }

    The wrapped watch listeners.

 - **<u>example</u>**:

    ```coffee
    process.env.watchPersistent = 'off'
    kit.watchFile 'a.js', (path, curr, prev, isDeletion) ->
    	if curr.mtime != prev.mtime
    		kit.log path
    ```

- #### <a href="lib/kit.coffee?source#L1149" target="_blank"><b>watchFiles</b></a>

 Watch files, when file changes, the handler will be invoked.
 It takes the advantage of `kit.watchFile`.

 - **<u>param</u>**: `patterns` { _Array_ }

    String array with minimatch syntax.
    Such as `['*/**.css', 'lib/**/*.js']`.

 - **<u>param</u>**: `handler` { _Function_ }

 - **<u>return</u>**:  { _Promise_ }

    It contains the wrapped watch listeners.

 - **<u>example</u>**:

    ```coffee
    kit.watchFiles '*.js', (path, curr, prev, isDeletion) ->
    	kit.log path
    ```

- #### <a href="lib/kit.coffee?source#L1186" target="_blank"><b>watchDir</b></a>

 Watch directory and all the files in it.
 It supports three types of change: create, modify, move, delete.

 - **<u>param</u>**: `opts` { _Object_ }

    Defaults:
    ```coffee
    {
    	dir: '.'
    	pattern: '**' # minimatch, string or array
    
    	# Whether to watch POSIX hidden file.
    	dot: false
    
    	# If the "path" ends with '/' it's a directory, else a file.
    	handler: (type, path, oldPath) ->
    }
    ```

 - **<u>return</u>**:  { _Promise_ }

 - **<u>example</u>**:

    ```coffee
    # Only current folder, and only watch js and css file.
    kit.watchDir {
    	dir: 'lib'
    	pattern: '*.+(js|css)'
    	handler: (type, path) ->
    		kit.log type
    		kit.log path
    
    	# If you use watchDir recursively, you need a global watchedList
    	watchedList: {}
    }
    ```

