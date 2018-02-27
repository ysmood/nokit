/**
 * Cross platform shell server
 */

const kit = require('./kit')
const proxy = kit.require('proxy')

kit.requireOptional('xterm', __dirname, '^3.1.0');
const pty = kit.requireOptional('node-pty', __dirname, '^0.7.4');
const WebSocket = kit.requireOptional('ws', __dirname, '^4.1.0');

const browserCode = function (needKey) {
    let key = getQueryVariable('key')

    if (needKey && !key) {
        key = prompt("Please enter the login key", '')
    }

    window.onbeforeunload = function() {
        return "Terminal will be killed if you leave, are you sure?";
    };

    const ws = new WebSocket(`ws://${location.host}`)

    ws.onopen = () => {
        const xterm = new Terminal({ // eslint-disable-line
            cursorBlink: true
        });
        xterm.open(document.getElementById('xterm'));

        if (needKey) {
            ws.send(JSON.stringify({
                type: 'key',
                key: key
            }))
        }

        ws.onmessage = (e) => {
            const msg = JSON.parse(e.data)

            switch (msg.type) {
            case 'data':
                xterm.write(msg.data)
                break
            case 'close':
                xterm.write('\r\n[Process completed]')
                break
            }
        }

        ws.onclose = (e) => {
            xterm.write(`\r\n[Connection broken] ${e.code} ${e.reason}`)
        }

        xterm.on('resize', () => {
            ws.send(JSON.stringify({
                type: 'resize',
                cols: xterm.cols,
                rows: xterm.rows
            }))
        })

        xterm.on('data', (data) => {
            ws.send(JSON.stringify({ type: 'data', data }))
        })

        TerminalFit(xterm) // eslint-disable-line

        window.addEventListener("resize", resizeThrottler, false);

        var resizeTimeout;
        function resizeThrottler() {
          // ignore resize events as long as an actualResizeHandler execution is in the queue
          if ( !resizeTimeout ) {
            resizeTimeout = setTimeout(function() {
                resizeTimeout = null;
                TerminalFit(xterm) // eslint-disable-line
             }, 66);
          }
        }
    }

    function getQueryVariable(variable) {
        var query = window.location.search.substring(1);
        var vars = query.split('&');
        for (var i = 0; i < vars.length; i++) {
            var pair = vars[i].split('=');
            if (decodeURIComponent(pair[0]) == variable) {
                return decodeURIComponent(pair[1]);
            }
        }
    }
}

const website =  `
    <!doctype html>
    <html>
        <head>
            <link rel="stylesheet" href="/xterm.css" />
            <script src='/xterm.js'></script>
            <script>
                (function () {
                    let exports = {}

                    ${kit.readFileSync(require.resolve('xterm/lib/addons/fit/fit.js'))}

                    window.TerminalFit = fit
                })()
            </script>
            <style>
                html, body, #xterm {
                    height: 100%;
                    margin: 0;
                }
            </style>
        </head>
        <body>
            <div id="xterm"></div>
            <script src='/main.js'></script>
        </body>
    </html>
    `

exports.server = (opts) => {
    const app = proxy.flow()

    app.push(proxy.select(proxy.match('/'), website))
    app.push(proxy.select('/xterm.css', (ctx) => {
        ctx.res.setHeader('Content-Type', 'text/css; charset=utf-8')
        ctx.body = kit.readFile(require.resolve('xterm/dist/xterm.css'))
    }))
    app.push(proxy.select('/xterm.js', kit.readFile(require.resolve('xterm/dist/xterm.js'))))
    app.push(proxy.select('/main.js', `(${browserCode.toString()})(${!!opts.key})`))

    return app.listen(opts.port, opts.host).then(() => {
        const addr = app.server.address()
        kit.logs(`serve on ${addr.address}:${addr.port}`)

        const wss = new WebSocket.Server({ server: app.server })

        wss.on('connection', (ws) => {
            ws.on('error', (msg) => {
                if (msg.code === 'ECONNRESET') return

                kit.logs(msg)
            })

            const shell = pty.spawn(opts.shell, [], {
                name: 'xterm-color',
                env: process.env
            })

            kit.logs('start shell:', shell.pid)

            shell.on('data', (data) => {
                ws.send(JSON.stringify({
                    type: 'data',
                    data: data + ''
                }))
            })

            shell.on('close', () => {
                if (ws.readyState !== ws.OPEN) return

                kit.logs('shell exit:', shell.pid)

                ws.send(JSON.stringify({
                    type: 'close'
                }))
            })

            ws.on('close', () => {
                kit.logs('close shell:', shell.pid)
                shell.kill()
            })

            let isLogin = false

            if (!opts.key) {
                isLogin = true
            }

            ws.on('message', (raw) => {
                const msg = JSON.parse(raw)

                if (!isLogin) {
                    if (msg.type === 'key' && msg.key === opts.key) {
                        isLogin = true
                    } else {
                        ws.close(4401, 'wrong login key')
                        return
                    }
                }

                switch (msg.type) {
                case 'resize':
                    shell.resize(msg.cols, msg.rows);
                    break

                case 'data':
                    shell.write(msg.data)
                    break
                }
            })
        })
    })
}

exports.client = (opts) => {
    process.stdin.setRawMode(true)

    const ws = new WebSocket(`ws://${opts.host}:${opts.port}`)

    ws.onopen = () => {
        ws.onmessage = (e) => {
            const msg = JSON.parse(e.data)

            switch (msg.type) {
            case 'data':
                process.stdout.write(msg.data)
                break
            case 'close':
                process.stdout.write('\r\n[Process completed]')
                process.exit()
                break
            }
        }

        ws.onclose = (e) => {
            process.stdout.write(`\r\n[Connection broken] ${e.code} ${e.reason}`)
            process.exit()
        }

        ws.send(JSON.stringify({
            type: 'key',
            key: opts.key
        }))

        process.stdout.on('resize', () => {
            ws.send(JSON.stringify({
                type: 'resize',
                cols: process.stdout.columns,
                rows: process.stdout.rows
            }))
        })

        process.stdin.on('data', (data) => {
            ws.send(JSON.stringify({ type: 'data', data: data + '' }))
        })

        ws.send(JSON.stringify({
            type: 'resize',
            cols: process.stdout.columns,
            rows: process.stdout.rows
        }))
    }
}