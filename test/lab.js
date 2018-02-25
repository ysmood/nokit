const kit = require("../lib/kit");
const pty = require('node-pty')

process.stdin.setRawMode(true)

const p = pty.spawn('zsh', [], {
    name: 'xterm-color',
    cols: process.stdout.columns,
    rows: process.stdout.rows,
    env: process.env
})


p.on('data', (data) => {
    process.stdout.write(data)
})

process.stdin.on('data', (data) => {
    p.write(data)
})

process.stdout.on('resize', () => {
    p.resize(process.stdout.columns, process.stdout.rows)
})

p.on('exit', (code) => {
    process.exit(code)
})

