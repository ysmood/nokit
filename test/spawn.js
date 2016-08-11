var spawn = require('child_process').spawn;

var ps = spawn('node', [__dirname + '/spawn-sub.js'], {
    stdio: 'inherit'
});

console.log(process.pid)

setTimeout(() => {}, 100000000)