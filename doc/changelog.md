# Changelog

- v0.3.5

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
