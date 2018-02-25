/**
 * Cross platform shell server
 */

const kit = require('nokit')
const proxy = kit.require('proxy')

module.exports = (opts) => {
    const app = proxy.flow()

    return app.listen(opts.port, opts.host)
}