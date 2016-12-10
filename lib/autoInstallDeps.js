var kit = require('./kit')
var Promise = kit.Promise;
var _ = kit._;

var spawnSync = require('child_process').spawnSync;
var semver = kit.require('semver');
var br = kit.require('brush');

module.exports = function (root, packInfo) {
    var deps = kit._.assign({}, packInfo.dependencies, packInfo.devDependencies);

    for (var name in deps) {
        var ver = deps[name];

        var target = name + '@' + ver;
        var installList = [];
        try {
            var version = kit.readJsonSync(
                kit.path.join(root, 'node_modules', name, 'package.json')
            ).version;

            if (!semver.valid(ver)) return;

            if (!semver.satisfies(version, ver)) {
                installList.push(target)
            }
        } catch (err) {
            installList.push(target);
        }

        if (installList.length > 0) {
            kit.logs(br.cyan('install modules:'), installList);
            var ret = spawnSync('npm', ['i'].concat(installList), {
                cwd: root,
                stdio: 'inherit'
            });

            if (ret.error) {
                throw new Error(error.message);
            }
        }
    }
};
