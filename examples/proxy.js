// This example is a proxy for both http, https and websocket, etc.
// Set the system proxy to "127.0.0.1:8123", then have fun!

const kit = require('../lib/kit');
const proxy = kit.require('proxy');
const app = proxy.flow();

// hack all js file
app.push(proxy.select(/.js$/, 'alert("XD")'));

// transparent proxy all the other http requests
app.push(proxy.url());

// transparent proxy https and websocket, etc
app.server.on("connect", proxy.connect());

app.listen(8123);
