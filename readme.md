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
   kit.readFile('test.txt', 'utf8').then (str) ->
   	console.log str
   
   kit.outputFile('a.txt', 'test').then()
   ```

- #### <a href="lib/kit.coffee?source#L37" target="_blank"><b>_</b></a>

  The lodash lib.

  - **<u>type</u>**:  { _Object_ }

- #### <a href="lib/kit.coffee?source#L86" target="_blank"><b>async</b></a>

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

- #### <a href="lib/kit.coffee?source#L181" target="_blank"><b>compose</b></a>

  Creates a function that is the composition of the provided functions.
  Besides, it can also accept async function that returns promise.
  It's more powerful than `_.compose`, and it use reverse order for
  passing argument from one function to another.
  See `kit.async`, if you need concurrent support.

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

- #### <a href="lib/kit.coffee?source#L204" target="_blank"><b>daemonize</b></a>

  Daemonize a program. Just a shortcut usage of `kit.spawn`.

  - **<u>param</u>**: `opts` { _Object_ }

   Defaults:
   ```coffee
   {
   	bin: 'node'
   	args: ['app.js']
   	stdout: 'stdout.log'
   	stderr: 'stderr.log'
   }
   ```

  - **<u>return</u>**:  { _Porcess_ }

   The daemonized process.

- #### <a href="lib/kit.coffee?source#L229" target="_blank"><b>decrypt</b></a>

  A simple decrypt helper. Cross-version of node.

  - **<u>param</u>**: `data` { _Any_ }

  - **<u>param</u>**: `password` { _String | Buffer_ }

  - **<u>param</u>**: `algorithm` { _String_ }

   Default is 'aes128'.

  - **<u>return</u>**:  { _Buffer_ }

- #### <a href="lib/kit.coffee?source#L252" target="_blank"><b>encrypt</b></a>

  A simple encrypt helper. Cross-version of node.

  - **<u>param</u>**: `data` { _Any_ }

  - **<u>param</u>**: `password` { _String | Buffer_ }

  - **<u>param</u>**: `algorithm` { _String_ }

   Default is 'aes128'.

  - **<u>return</u>**:  { _Buffer_ }

- #### <a href="lib/kit.coffee?source#L273" target="_blank"><b>err</b></a>

  A error log shortcut for `kit.log(msg, 'error', opts)`

  - **<u>param</u>**: `msg` { _Any_ }

  - **<u>param</u>**: `opts` { _Object_ }

- #### <a href="lib/kit.coffee?source#L306" target="_blank"><b>exec</b></a>

  A better `child_process.exec`. This function require your current
  version of node support `stream.Transform` API.

  - **<u>param</u>**: `cmd` { _String_ }

   Shell commands.

  - **<u>param</u>**: `shell` { _String_ }

   Shell name. Such as `bash`, `zsh`. Optinal.

  - **<u>return</u>**:  { _Promise_ }

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

- #### <a href="lib/kit.coffee?source#L343" target="_blank"><b>fs</b></a>

  See my project [fs-more][fs-more].
  
  [Offline Documentation](?gotoDoc=fs-more/readme.md)
  [fs-more]: https://github.com/ysmood/fs-more

- #### <a href="lib/kit.coffee?source#L351" target="_blank"><b>generateNodeModulePaths</b></a>

  Generate a list of module paths from a name and a directory.

  - **<u>param</u>**: `moduleName` { _String_ }

   The module name.

  - **<u>param</u>**: `dir` { _String_ }

   The root path. Default is current working dir.

  - **<u>return</u>**:  { _Array_ }

   Paths

- #### <a href="lib/kit.coffee?source#L382" target="_blank"><b>glob</b></a>

  A handy file system search tool.
  See the https://github.com/isaacs/node-glob
  
  [Offline Documentation](?gotoDoc=glob/readme.md)

  - **<u>param</u>**: `patterns` { _String | Array_ }

   Minimatch pattern.

  - **<u>param</u>**: `opts` { _Object_ }

   The glob options.

  - **<u>return</u>**:  { _Promise_ }

   Contains the path list.

  - **<u>example</u>**:

   ```coffee
   glob('*.js').then (paths) -> kit.log paths
   
   glob('*.js', { cwd: 'test' }).then (paths) -> kit.log paths
   
   glob(['*.js', '*.css']).then (paths) -> kit.log paths
   
   # The 'statCache' is also saved.
   glob('*.js', { dot: true }).then (paths) ->
   	kit.log paths.statCache
   ```

- #### <a href="lib/kit.coffee?source#L439" target="_blank"><b>jhash</b></a>

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

- #### <a href="lib/kit.coffee?source#L450" target="_blank"><b>inspect</b></a>

  For debugging. Dump a colorful object.

  - **<u>param</u>**: `obj` { _Object_ }

   Your target object.

  - **<u>param</u>**: `opts` { _Object_ }

   Options. Default:
   ```coffee
   { colors: true, depth: 5 }
   ```

  - **<u>return</u>**:  { _String_ }

- #### <a href="lib/kit.coffee?source#L466" target="_blank"><b>isDevelopment</b></a>

  Nobone use it to check the running mode of the app.
  Overwrite it if you want to control the check logic.
  By default it returns the `rocess.env.NODE_ENV == 'development'`.

  - **<u>return</u>**:  { _Boolean_ }

- #### <a href="lib/kit.coffee?source#L475" target="_blank"><b>isProduction</b></a>

  Nobone use it to check the running mode of the app.
  Overwrite it if you want to control the check logic.
  By default it returns the `rocess.env.NODE_ENV == 'production'`.

  - **<u>return</u>**:  { _Boolean_ }

- #### <a href="lib/kit.coffee?source#L490" target="_blank"><b>log</b></a>

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

- #### <a href="lib/kit.coffee?source#L551" target="_blank"><b>monitorApp</b></a>

  Monitor an application and automatically restart it when file changed.
  Even when the monitored app exit with error, the monitor will still wait
  for your file change to restart the application.
  It will print useful infomation when it application unexceptedly.

  - **<u>param</u>**: `opts` { _Object_ }

   Defaults:
   ```coffee
   {
   	bin: 'node'
   	args: ['app.js']
   	watchList: ['app.js'] # Extra files to watch.
   	opts: {} # Same as the opts of 'kit.spawn'.
   }
   ```

  - **<u>return</u>**:  { _Process_ }

   The child process.

- #### <a href="lib/kit.coffee?source#L606" target="_blank"><b>nodeVersion</b></a>

  Node version. Such as `v0.10.23` is `0.1023`, `v0.10.1` is `0.1001`.

  - **<u>type</u>**:  { _Float_ }

- #### <a href="lib/kit.coffee?source#L624" target="_blank"><b>open</b></a>

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

- #### <a href="lib/kit.coffee?source#L659" target="_blank"><b>pad</b></a>

  String padding helper. It is use in the `kit.log`.

  - **<u>param</u>**: `str` { _Sting | Number_ }

  - **<u>param</u>**: `width` { _Number_ }

  - **<u>param</u>**: `char` { _String_ }

   Padding char. Default is '0'.

  - **<u>return</u>**:  { _String_ }

  - **<u>example</u>**:

   ```coffee
   kit.pad '1', 3 # '001'
   ```

- #### <a href="lib/kit.coffee?source#L705" target="_blank"><b>parseComment</b></a>

  A comments parser for coffee-script.
  Used to generate documentation from source code automatically.
  It will traverse through all the comments of a coffee file.

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

- #### <a href="lib/kit.coffee?source#L773" target="_blank"><b>path</b></a>

  Node native module `path`.

- #### <a href="lib/kit.coffee?source#L781" target="_blank"><b>Promise</b></a>

  The promise lib. Now, it uses Bluebird as ES5 polyfill.
  In the future, the Bluebird will be replaced with native
  ES6 Promise. Please don't use any API other than the ES6 spec.

  - **<u>type</u>**:  { _Object_ }

- #### <a href="lib/kit.coffee?source#L789" target="_blank"><b>promisify</b></a>

  Convert a callback style function to a promise function.

  - **<u>param</u>**: `fn` { _Function_ }

  - **<u>param</u>**: `this` { _Any_ }

   `this` object of the function.

  - **<u>return</u>**:  { _Function_ }

   The function will return a promise object.

- #### <a href="lib/kit.coffee?source#L809" target="_blank"><b>require</b></a>

  Much faster than the native require of node, but you should
  follow some rules to use it safely.

  - **<u>param</u>**: `moduleName` { _String_ }

   Relative moudle path is not allowed!
   Only allow absolute path or module name.

  - **<u>param</u>**: `done` { _Function_ }

   Run only the first time after the module loaded.

  - **<u>return</u>**:  { _Module_ }

   The module that you require.

- #### <a href="lib/kit.coffee?source#L904" target="_blank"><b>request</b></a>

  A handy extended combination of `http.request` and `https.request`.

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

- #### <a href="lib/kit.coffee?source#L1108" target="_blank"><b>spawn</b></a>

  A safer version of `child_process.spawn` to run a process on
  Windows or Linux. In some conditions, it may be more convenient
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

  - **<u>return</u>**:  { _Promise_ }

   The `promise.process` is the spawned child
   process object.
   Resolves when the process's stdio is drained. The resolve value
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

- #### <a href="lib/kit.coffee?source#L1156" target="_blank"><b>url</b></a>

  Node native module `url`.

- #### <a href="lib/kit.coffee?source#L1178" target="_blank"><b>walk</b></a>

  Walk through path pattern recursively.
  For more doc, see the [glob](https://github.com/isaacs/node-glob)
  
  [Offline Documentation](?gotoDoc=glob/readme.md)

  - **<u>param</u>**: `patterns` { _String_ }

   The path minimatch pattern.

  - **<u>param</u>**: `opts` { _Object_ }

   Same with the `glob`. Optional.

  - **<u>param</u>**: `fn` { _Function_ }

   Called on each path match.

  - **<u>return</u>**:  { _Promise_ }

   Same with the `kit.glob`.

  - **<u>example</u>**:

   ```coffee
   kit.walk './**/*.js', (path) ->
   	kit.log path
   .then (paths) ->
   	kit.log paths
   
   	# You can also get the glob object.
   	kit.log paths.glob
   ```

- #### <a href="lib/kit.coffee?source#L1228" target="_blank"><b>watchFile</b></a>

  Watch a file. If the file changes, the handler will be invoked.
  You can change the polling interval by using `process.env.pollingWatch`.
  Use `process.env.watchPersistent = 'off'` to disable the persistent.
  Why not use `fs.watch`? Because `fs.watch` is unstable on some file
  systems, such as Samba or OSX.

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

- #### <a href="lib/kit.coffee?source#L1258" target="_blank"><b>watchFiles</b></a>

  Watch files, when file changes, the handler will be invoked.
  It is build on the top of `kit.watchFile`.

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

- #### <a href="lib/kit.coffee?source#L1296" target="_blank"><b>watchDir</b></a>

  Watch directory and all the files in it.
  It supports three types of change: create, modify, move, delete.
  It is build on the top of `kit.watchFile`.

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

