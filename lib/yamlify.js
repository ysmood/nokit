module.exports = function (obj) {
    str = '';

    traverse(obj);
};

var str;

function traverse (node) {
    var con;

    if (node === void 0) {
    } else if (node === null) {
        str += 'null';
    } else {
        var i, len;

        switch (node.constructor) {
        case String:
            str += '"' + node + '"';
            break;

        case Number:
            str += node;
            break;

        case Array:
            len = node.length

            str += '['
            for (i = 0; i < len; i++) {
                traverse(node[i]);
                str += ','
            }
            str += ']'
            break;

        case Boolean:
            break;

        default: // Object
            str += '{'
            for (i in node) {
                str += i
                traverse(node[i]);
                str += ','
            }
            str += '}'
            break;
        }
    }
}
