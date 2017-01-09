var kit = require('./kit')
var Promise = kit.Promise;
var _ = kit._;

var spawnSync = require('child_process').spawnSync;
var semver = kit.require('semver');
var br = kit.require('brush');

module.exports = function (root, packInfo) {
    var deps = _.assign({}, packInfo.dependencies, packInfo.devDependencies);

    var installList = [];
    var rmList = [];
    for (var name in deps) {
        var ver = deps[name];

        var target = name + '@' + ver;
        try {
            var paths = kit.genModulePaths(kit.path.join(name, 'package.json'))
            var path = _.find(paths, function (p) { return kit.existsSync(p) })

            var version = kit.readJsonSync(path).version;

            if (!semver.satisfies(version, ver)) {
                rmList.push(name)
                installList.push(target)
            }
        } catch (err) {
            rmList.push(name)
            installList.push(target);
        }
    }

    if (installList.length > 0) {
        kit.logs(br.cyan('install modules:'), installList);

        spawnSync('npm', ['rm'].concat(rmList), {
            cwd: root,
            stdio: 'inherit'
        })

        var ret = spawnSync('npm', ['i'].concat(installList), {
            cwd: root,
            stdio: 'inherit'
        });

        if (ret.status !== 0) {
            throw new Error('cannot install deps: ' + installList);
        }
    }
};
