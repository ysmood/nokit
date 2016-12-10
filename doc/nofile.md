
# Nofile Task Manager

Nokit has provided a cli tool like GNU Make. If you install it globally like this:

`npm -g i nokit`

, you can execute `no` command besides a 'nofile.js' file.

## Quick Start

Create a `nofile.js` (or `.coffee`, `.ts`, etc) at your current working directory
or any of its parents directory.

Assume your file content is:

```js
var kit = require('nokit');

/**
 * Expose a task definition function.
 * @param  {Function} task `(name, dependencies, description, isSequential, callback) => Function`
 * @param  {Function} option `(name, description, default || callback) => option`
 */
module.exports = (task, option) => {
    option('-w, --hello [world]', 'Just a test option', 'world');

    // Define a default task, and it depends on the "clean" task.
    task('default', ['clean'], 'This is a comment info', (opts) => {
        // Compose a task inside another.
        printOpts(opts);

        // Use brush.
        kit.require('brush');
        kit.log('print red words'.red);
    });

    let printOpts = task('print-opts', (opts) => { kit.logs(opts); });

    task('clean', () => {
        return kit.remove('dist');
    });

    // To add alias to a task, just use space to separate names.
    // Here 'build' and 'b' are the same task.
    task('build b', () => {
        kit.require('drives');
        return kit.warp('src/**/*.js')
        .load(kit.drives.auto 'compile')
        .run('dist');
    });

    task('sequential', ['clean', 'build'], true, () => {
        kit.log('Run clean and build sequentially.');
    });
};
```

Then you can run it in command line: `no`. Just that simple, without task
name, `no` will try to call the `default` task directly.

You can run `no -h` to display help info.

Call `no build` or `no b` to run the `build` task.

Call with option: `no build -w Life`.

Call `no a b c` to run task `a`, `b`, `c` sequentially.

For real world example, just see the [nofile](nofile.coffee?source) that nokit is using.

For more doc for the `option` goto [commander.js](https://github.com/tj/commander.js).

## Config the package.json

### auto install missed or outdated dependencies

If you want to let nofile help you to install missed or outdated dependencies,
you can enable the `nofile.autoInstallDeps`, it will compare the `dependencies` and
`devDependencies` to current installed dependencies, if any of them is doesn't satisfy
the semver, it will try to install it properly:

```json
{
    "name": "app",
    "version": "0.23.6",
    "nofile": {
      "autoInstallDeps": true
    }
}
```

### lock nodejs and npm version

If you set the `engines` field in the `package.json`,
Nofile will check the version of nodejs and npm, and abort if the version doesn't match:

```json
{
    "name": "app",
    "version": "0.23.6",
    "engines": {
      "node": ">= 0.11.0",
      "npm": ">= 2.0.0"
    }
}
```

### set nofile path

If you want to config the name of the nofile, the `nofile.path` field is for you:

```json
{
    "name": "app",
    "version": "0.23.6",
    "nofile": {
      "path": "my-nofile.js"
    }
}
```

### Preprocessor

By default nofile only supports js, if you want nokit to support babel, you should install nokit like this:

`npm i -g nokit babel-register`

Then you should add a 'nofile.preRequire' array into the `package.json`:

```json
{
    "name": "app",
    "version": "0.23.6",
    "nofile": {
      "preRequire": [
        "babel-register"
      ]
    }
}
```

Here nofile will preload the babel and coffee, right before the actual code execution.
