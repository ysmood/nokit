# Changelog

- v0.22

  - **API CHANGE** tcpFrame protocol changed, not backward compatible.

- v0.21

  - upd: deps
  - **API CHANGE** see `yaku`

- v0.20

  - **API CHANGE** `kit.async` now renamed to `kit.all`
  - **API CHANGE** `noe` now doesn't require babel by default

- v0.19

  - **API CHANGE** nofile will not auto-require any register any more
    You have to use `// nofile-pre-require: module-path` in the future.

- v0.18

  - **API CHANGE** lodash upgraded from 3.0 to 4.0
  - upd: deps

- v0.17

  - **API CHANGE** `kit.request` the `setTE` option changed to `autoTE`
  - add: some proxy helpers
  - add: `proxy.tcpFrame`
  - add: `kit.replace`
  - add: `kit.replaceSync`

- v0.16.17

  - add: `noe` now support watch directory
  - opt: `proxy.url` default option

- v0.16.12

  - **API CHANGE** `monitorApp`: the returned value is changed
  - add: support for babel 6
  - opt: monitorApp watch api
  - fix: a bug of `proxy.midToFlow`
  - fix: a monitorApp bug
  - opt: comment2md

- v0.15.5

  - fix: a `proxy.connect` bug
  - **API CHANGE** noflow
  - fix: a `proxy.match` qs bug
  - add: auto restart api for `monitorApp` and `noe`

- v0.14.10

  - opt: the opt arg of no
  - upd: deps

- v0.14.7

  - **API CHANGE** removed `ken`, it's now a independent project, called `junit`
  - add: `noe` cli helper
  - fix: some regex bugs
  - upd: deps

- v0.13.0

  - opt: ken, add `isAutoExitCode` option, now ken will auto exit the code with failed test.
  - **API CHANGE** ken has changed its api, see the doc of it. We don't need `deepEq` any more.
    `isAutoExitCode` renamed to `isFailOnUnhandled`.

- v0.11.6

  - opt: `kit.ken`, now it will auto-exit process for you any more
  - fix: minor bugs

- v0.11.1

  - **API CHANGE** `proxy.flow` now only accepts functions as middlewares. `etag` now works as a
    standalone middleware. The selector now also works as a standalone middleware, `proxy.select`.

- v0.10.0

  - **API CHANGE** `kit.require 'colors/safe'` now changed to `kit.require 'brush`,
    the colors module now will not pollute the `String.prototype` any more
  - opt: `monitorApp`
  - minor bug fixes

- v0.9.5

  - opt: proxy.url
  - fix: some minor bug fixes
  - upd: deps
  - add: `kit.ken` module
  - fix: a bug of midToFlow

- v0.9.0

  - **API CHANGE** `proxy.url` and `proxy.static` changed its api,
    please see the doc and example for details.
  - opt: rename `proxy.mid` to `proxy.flow`
  - add: `kit.regexReduce` and `kit.regexMap`
  - upd: `nofs`, there is a api change

- v0.8.9

  - upd: deps
  - opt: proxy.mid
  - opt: browser helper

- v0.8.1

  - opt: nofile preload
  - add: proxy.mid
  - upd: deps

- v0.7.7

  - fix: #6
  - upd: deps

- v0.7.6

  - add: some handy drives
  - fix: a deps cache bug
  - upd: deps

- v0.7.4

  - add: browser helper
  - add: server helper
  - add: sse support

- v0.7.3

  - revert: nokit argument to the nofile entry
  - opt: better error report for nofile

- v0.7.1

  - add: nokit argument to the nofile entry

- v0.7.0

  - **BIG CHANGE** Now use `Yaku` instead of Bluebird.
  - upd: semver to 4.3.4
  - upd: nofs

- v0.6.3

  - add: now warp `onEnd` event works on all drives
  - upd deps
  - add: proxy helpers
  - opt: parse comment

- v0.6.0

  - fix: a request url bug
  - optimize dependency
  - add: `kit.exec` now will expose the child process.
  - fix: alias bug

- v0.5.6

  - Some minor changes.
  - Update deps.

- v0.5.4

  - **API CHANGE** `warp`'s two function names was changed:
    `pipe` -> `load`, `to` -> `run`.
  - Add semver support for `requireOptional`.
  - Optimize the task and `no` cli tool.
  - Update deps.
  - Fix a nofile exit code issue.

- v0.4.5

  - **API CHANGE** The `dest` of `warp` now is a path object.
  - **API CHANGE** Optimize the `require` function. Now some
    nokit libs need to be required before using. Such as `jhash` and `url`,
  - Now nokit use `io.js`'s `url` lib.
  - **API CHANGE** Rename `inspect` to `xinspect`.
  - **API CHANGE** Now log use `colors/safe`.

- v0.4.1

  - **API CHANGE** Rename `flow` to `warp`, to Star Trek.
  - **API CHANGE** Rename `compose` to `flow`.

- v0.3.6

  - **BIG API CHANGE** `nofs` has changed the iterator arguments.
  - **API CHANGE** remove `pad` function, use `kit._.padLeft` instead.
  - **API CHANGE** rename `generateNodeModulePaths` to `genModulePaths`.
  - Update `lodash` to `v3.0.0`.
  - Add `task` helper.
  - Add a command line helper `no`.

- v0.2.7

  - **API CHANGE** `parseComment` now only have two params.
  - Add `indent`, `formatComment` and `parseFileComment` api.
  - Fix a `exec` Windows bug.
  - Update deps.

- v0.2.5

  - **API CHANGE** Replace dependency `fs-more` to `nofs`.
  - **API CHANGE** `open` now renamed to `xopen`.
    It should be the same name with `fs.open`.
  - `monitorApp` now will print the auto watched list.
  - Fix a exec error handling bug.

- v0.2.4

  - Optimize the option of `parseDependency`.
    It now works with the default index files.

- v0.2.3

  - Fix a `request` response encoding issue.
  - Now monitorApp will watch the reps automatically.
  - Fix a monitorApp restart issue.
  - Add `parseDependency` API.
  - The `stateCache` of glob now is not enumerable.

- v0.2.2

  - **API CHANGE** `spawn` now rejects more properly.
  - Now `exec` will always clean the temp files.
  - `monitorApp` now returns `Promise`.

- v0.1.9

  - `request`: Add `setTE` option for `transfer-encoding` instead.
  - Fix a `exec` issue.

- v0.1.6

  - Add default `transfer-encoding` for `kit.request`.
