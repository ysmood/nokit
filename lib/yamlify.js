var nil;
var complexStrReg = /[\n']/
var beginReg =  /^/mg

module.exports = function (obj, indent) {
    if (obj === nil) return nil;

    $str = '';
    $indent = indent || 4;

    traverse(obj, 0);

    return $str;
};

var $str;
var $indent;

function indentSpaces (indent) {
    var spaces = '';
    for (var i = indent; i--;) {
        spaces += ' ';
    }
    return spaces;
}

function traverse (node, indent, parent) {
    if (node === nil) {
    } else if (node === null) {
        $str += 'null';
    } else {
        var i, len;
        var con = node.constructor;

        if ((con === Array || con === Object) &&
            (parent === Array || parent === Object)) {
            indent += $indent;
        }

        switch (con) {
        case String:
            if (complexStrReg.test(node)) {
                $str += '|-' + $indent + '\n' +
                    node.replace(beginReg, indentSpaces($indent + indent));
            } else {
                $str += "'" + node + "'";
            }
            break;

        case Number:
            $str += node;
            break;

        case Array:
            len = node.length

            for (i = 0; i < len; i++) {
                $str += '\n' + indentSpaces(indent) + '- ';
                traverse(node[i], indent, con);
            }
            break;

        case Boolean:
            $str += node;
            break;

        default: // Object
            for (i in node) {
                $str += '\n' + indentSpaces(indent) + i + ': ';
                traverse(node[i], indent, con);
            }
            break;
        }
    }
}

/*
a: 10
b:
    c: 10
    d: 1

-
    - 10
 */
