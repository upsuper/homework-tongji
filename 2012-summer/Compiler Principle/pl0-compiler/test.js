var fs = require('fs');
var Frontend = require('./core/frontend.js').Frontend,
    pl0 = require('./core/pl0.js'),
    backend = require('./core/backend.js');

var frontend = new Frontend(pl0.syntax, pl0.ignore, pl0.start);
var code = fs.readFileSync(process.argv[2], 'utf8');
var result;
try {
    result = frontend.translate(code);
} catch (e) {
    console.log("Error: %s, line %d colume %d", e.message, e.line, e.colume);
    console.log(code.split('\n')[e.line - 1]);
    console.log(new Array(e.colume).join(' ') + '^');
}
if (result)
    console.log(result.toString());

backend.toX86IntelAsm(result);
