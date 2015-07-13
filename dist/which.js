/**
 * @license
 *
 * The ISC License
 *
 * Copyright (c) Isaac Z. Schlueter and Contributors
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR
 * IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 */
function which(r,s){if(isAbsolute(r))return s(null,r);var n=(process.env.PATH||"").split(COLON),e=[""];"win32"===process.platform&&(n.push(process.cwd()),e=(process.env.PATHEXT||".EXE").split(COLON),-1!==r.indexOf(".")&&e.unshift("")),function i(t,o){if(t===o)return s(new Error("not found: "+r));var c=path.resolve(n[t],r);!function u(r,n){if(r===n)return i(t+1,o);var f=e[r];fs.stat(c+f,function(e,i){return!e&&i&&i.isFile()&&isExe(i.mode,i.uid,i.gid)?s(null,c+f):u(r+1,n)})}(0,e.length)}(0,n.length)}function whichSync(r){if(isAbsolute(r))return r;var s=(process.env.PATH||"").split(COLON),n=[""];"win32"===process.platform&&(s.push(process.cwd()),n=(process.env.PATHEXT||".EXE").split(COLON),-1!==r.indexOf(".")&&n.unshift(""));for(var e=0,i=s.length;i>e;e++)for(var t=path.join(s[e],r),o=0,c=n.length;c>o;o++){var u,f=t+n[o];try{u=fs.statSync(f)}catch(p){}if(u&&u.isFile()&&isExe(u.mode,u.uid,u.gid))return f}throw new Error("not found: "+r)}function absWin(r){if(absUnix(r))return!0;var s=/^([a-zA-Z]:|[\\\/]{2}[^\\\/]+[\\\/][^\\\/]+)?([\\\/])?/,n=s.exec(r),e=n[1]||"",i=e&&":"!==e.charAt(1),t=!!n[2]||i;return t}function absUnix(r){return"/"===r.charAt(0)||""===r}var fs=require("nofs");module.exports=fs.PromiseUtils.promisify(which),module.exports.sync=whichSync;var path=fs.path,COLON="win32"===process.platform?";":":",isExe;isExe="win32"==process.platform?function(){return!0}:function(r,s,n){var e=1&r||8&r&&process.getgid&&n===process.getgid()||64&r&&process.getuid&&s===process.getuid();return e};var isAbsolute="win32"===process.platform?absWin:absUnix;