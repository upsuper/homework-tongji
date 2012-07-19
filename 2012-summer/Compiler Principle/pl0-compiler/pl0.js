var fs = require('fs'),
    path = require('path'),
    child_process = require('child_process');
var Frontend = require('./core/frontend.js').Frontend,
    pl0 = require('./core/pl0.js'),
    frontend = new Frontend(pl0.syntax, pl0.ignore, pl0.start),
    backend = require('./core/backend.js');

var stopstep;
var filename;
var output;

for (var i = 2; i < process.argv.length; ++i) {
    switch (process.argv[i]) {
        case '-i':
            stopstep = 'i';
            break;
        case '-s':
            stopstep = 's';
            break;
        case '-c':
            stopstep = 'c';
            break;
        case '-o':
            output = process.argv[++i];
            break;
        default:
            filename = process.argv[i];
    }
}
if (!filename) {
    console.log("Usage: %s %s [-c | -t | -a] filename",
            process.argv[0], path.basename(process.argv[1]));
    process.exit(1);
}

var code;
try {
    code = fs.readFileSync(filename, 'utf8');
} catch (e) {
    console.error('Error: ' + e.message);
    process.exit(1);
}

var basename = path.basename(filename, '.pl0');

// generate intermediate code
var intermediate;
try {
    intermediate = frontend.translate(code);
} catch (e) {
    console.log("Error: %s, line %d colume %d", e.message, e.line, e.colume);
    console.log(code.split('\n')[e.line - 1]);
    console.log(new Array(e.colume).join(' ') + '^');
    process.exit(1);
}
if (stopstep === 'i') {
    if (!output)
        output = basename + '.i';
    fs.writeFileSync(output, intermediate, 'utf8');
    process.exit(0);
}

// generate assemble code for yasm
var asmcode = backend.toYasm(intermediate);
if (stopstep === 's') {
    if (!output)
        output = basename + '.asm';
    fs.writeFileSync(output, asmcode, 'utf8');
    process.exit(0);
}

// generate object file
var objfmt, objext;
switch (process.platform) {
    case 'darwin':
        objfmt = 'macho32';
        objext = '.o';
        break;
    case 'win32':
        objfmt = 'win32';
        objext = '.obj';
        break;
    default:
        objfmt = 'elf32';
        objext = '.o';
        break;
}
var tmpfile = Math.random().toString().substring(2);
tmpfile = 'pl0-' + process.pid + '-' + tmpfile + objext;
var child = child_process.spawn('yasm',
        ['-o', tmpfile, '-f', objfmt, '-']);
child.stdin.write(asmcode);
child.stdin.end();
child.on('exit', function (code) {
    if (code) {
        console.error('Error occured when executing yasm.');
        process.exit(2);
    }
    if (stopstep === 'c') {
        if (!output)
            output = basename + objext;
        fs.rename(tmpfile, output);
        process.exit(0);
    }

    if (!output) {
        if (process.platform === 'win32')
            output = basename + '.exe';
        else
            output = basename;
    }
    var wrapper = path.join(__dirname, 'lib', 'wrapper.c');
    var child = child_process.spawn('gcc',
        ['-m32', '-o', output, wrapper, tmpfile]);
    child.on('exit', function (code) {
        if (code) {
            console.error('Error occured when executing gcc.');
            process.exit(2);
        }
        fs.unlink(tmpfile);
    });
});
