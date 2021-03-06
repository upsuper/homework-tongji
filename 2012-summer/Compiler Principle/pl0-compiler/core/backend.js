if (typeof require === 'function') {
    var MySet = require('./myset.js').MySet;
}

function splitToBlocks(intermediate) {
    var statements = Object.keys(intermediate);
    statements.sort();
    if (!statements.length)
        return {};
    
    var blockStarts = new MySet();
    blockStarts.add(statements[0]);
    for (var i = 0; i < statements.length; ++i) {
        var s = intermediate[statements[i]];
        if (s.op[0] === 'j') {
            if (parseInt(s.out) !== 0)
                blockStarts.add(s.out);
            if (statements[i + 1])
                blockStarts.add(statements[i + 1]);
        }
    }
    blockStarts = blockStarts.toArray();
    blockStarts.sort();

    var blocks = {};
    for (var i = 0; i < blockStarts.length; ++i) {
        var blockStart = blockStarts[i];
        var nextBlockStart = blockStarts[i + 1];
        if (nextBlockStart === undefined)
            nextBlockStart = '0';
        var block = {
            statements: [],
            successors: []
        };

        var j;
        for (j = 0; statements[j] !== blockStart; ++j)
            ;
        for (; j < statements.length &&
                statements[j] !== nextBlockStart; ++j)
            block.statements.push(intermediate[statements[j]]);

        var lastStat = block.statements[block.statements.length - 1];
        var lastOp = lastStat.op;
        if (lastOp === 'j') {
            block.successors.push(lastStat.out);
        } else if (lastOp[0] === 'j') {
            block.successors.push(lastStat.out);
            block.successors.push(nextBlockStart);
        } else {
            block.successors.push(nextBlockStart);
        }

        blocks[blockStarts[i]] = block;
    }

    return blocks;
}

function buildSymbolTable(intermediate) {
    var ret = {};

    var statements = Object.keys(intermediate);
    for (var i = 0; i < statements.length; ++i) {
        var s = intermediate[statements[i]];
        if (typeof s.in1 === 'string' && s.in1[0] === '%')
            ret[s.in1] = {};
        if (typeof s.in2 === 'string' && s.in2[0] === '%')
            ret[s.in2] = {};
        if (typeof s.out === 'string' && s.out[0] === '%')
            ret[s.out] = {};
    }

    return ret;
}

/* X86 Intel Asm specific */

function x86FindRegisterVars(symbolTable, blocks) {
    var tmpSymTab = {};

    for (var sym in symbolTable) {
        tmpSymTab[sym] = {
            block: null,
            set: null,
            get: null
        };
    }

    function setSym(sym, block, method, pos) {
        var tabItem = tmpSymTab[sym];
        if (typeof sym !== 'string' || sym[0] !== '%' || !tabItem)
            return;
        if (tabItem.block !== null && tabItem.block !== block) {
            delete tmpSymTab[sym];
        } else if (tabItem[method] !== null && tabItem[method] !== pos) {
            delete tmpSymTab[sym];
        } else if (method === 'get' && tabItem.set === null) {
            delete tmpSymTab[sym];
        } else {
            tabItem.block = block;
            tabItem[method] = pos;
            if (tabItem.set !== null && tabItem.get !== null) {
                if (tabItem.get - tabItem.set > 5) {
                    delete tmpSymTab[sym];
                } else {
                    tabItem.block = null;
                    tabItem.set = null;
                    tabItem.get = null;
                }
            }
        }
    }

    for (var i in blocks) {
        var block = blocks[i];
        for (var j = 0; j < block.statements.length; ++j) {
            var s = block.statements[j];
            setSym(s.in1, i, 'get', j);
            setSym(s.in2, i, 'get', j);
            setSym(s.out, i, 'set', j);
        }
    }

    for (var sym in symbolTable) {
        var tabItem = tmpSymTab[sym];
        symbolTable[sym].register = !!(
                tabItem && 
                tabItem.block === null &&
                tabItem.set === null &&
                tabItem.get === null);
    }
}

function x86AllocMemory(symbolTable) {
    var pos = 4;

    for (var sym in symbolTable) {
        if (!symbolTable[sym].register) {
            symbolTable[sym].position = pos;
            pos += 4;
        }
    }

    pos += 4;
    if (pos % 16 > 0)
        pos += 16 - pos % 16;
    pos -= 4;
    return pos;
}

function x86Asm(intermediate) {
    var blocks = splitToBlocks(intermediate);
    var symbolTable = buildSymbolTable(intermediate);
    var memLength;

    x86FindRegisterVars(symbolTable, blocks);
    memLength = x86AllocMemory(symbolTable);

    var registers = {
        'EAX': false,
        'EBX': false,
        'ECX': false,
        'EDX': false,
        'EBP': false,
        'ESI': false,
        'EDI': false,
    };
    var regLastData = {
        'EAX': null,
        'EBX': null,
        'ECX': null,
        'EDX': null,
        'EBP': null,
        'ESI': null,
        'EDI': null,
    };
    function allocReg(reg) {
        var chosen = null;
        if (typeof reg === 'string') {
            chosen = reg;
            regLastData[reg] = null;
        } else {
            for (var reg in registers) {
                if (registers[reg])
                    continue;
                if (reg === true && (reg === 'EAX' || reg === 'EDX'))
                    continue;
                chosen = reg;
                if (regLastData[reg] === null)
                    break;
            }
        }
        if (chosen) {
            registers[chosen] = true;
            return reg;
        } else {
            throw "No reg!"; // XXX
        }
    }
    function deallocReg(reg) {
        registers[reg] = false;
    }

    var result = [];
    function pushResult(op) {
        var args = Array.prototype.slice.call(arguments, 1);
        result.push('\t' + op + ' ' + args.join(', '));
    }
    function getVarPos(v) {
        return '[ESP+' + symbolTable[v].position + ']';
    }
    function loadPlace(place, reg) {
        if (place[0] === '$') {
            if (!reg)
                reg = allocReg();
            pushResult('MOV', reg, place.slice(1));
        } else if (!symbolTable[place].register) {
            if (!reg) {
                for (var r in regLastData) {
                    if (regLastData[r] === place) {
                        registers[r] = true;
                        reg = r;
                        break;
                    }
                }
                if (!reg) {
                    reg = allocReg();
                    pushResult('MOV', reg, getVarPos(place));
                    regLastData[reg] = place;
                }
            } else {
                pushResult('MOV', reg, getVarPos(place));
                regLastData[reg] = place;
            }
        } else {
            if (!reg)
                reg = symbolTable[place].register;
            else
                pushResult('MOV', reg, symbolTable[place].register);
            symbolTable[place].register = true;
        }
        return reg;
    }
    function storePlace(place, reg) {
        if (symbolTable[place].register) {
            symbolTable[place].register = allocReg(true);
            pushResult('MOV', symbolTable[place].register, reg);
        } else {
            for (var r in regLastData) {
                if (regLastData[r] == place)
                    regLastData[r] = null;
            }
            pushResult('MOV', getVarPos(place), reg);
            regLastData[reg] = place;
        }
    }

    var statements = Object.keys(intermediate);
    statements.sort();
    result.push('\tPUSHAD');
    pushResult('SUB', 'ESP', memLength);
    var reg1, reg2, op;
    for (var i = 0; i < statements.length; ++i) {
        var s = statements[i];
        if (blocks[s]) {
            result.push('L' + s + ':');
            for (var reg in regLastData)
                regLastData[reg] = null;
        }

        s = intermediate[s];
        switch (s.op) {
        case '+':
            reg1 = loadPlace(s.in1);
            if (s.in2[0] === '$') {
                pushResult('ADD', reg1, s.in2.slice(1));
            } else {
                reg2 = loadPlace(s.in2);
                pushResult('ADD', reg1, reg2);
                deallocReg(reg2);
            }
            storePlace(s.out, reg1);
            deallocReg(reg1);
            break;
        case '-':
            if (s.in2 === null) {
                reg1 = loadPlace(s.in1);
                pushResult('NEG', reg1);
                storePlace(s.out, reg1);
                deallocReg(reg1);
            } else {
                reg1 = loadPlace(s.in1);
                if (s.in2[0] === '$') {
                    pushResult('SUB', reg1, s.in2.slice(1));
                } else {
                    reg2 = loadPlace(s.in2);
                    pushResult('SUB', reg1, reg2);
                    deallocReg(reg2);
                }
                storePlace(s.out, reg1);
                deallocReg(reg1);
            }
            break;
        case '*':
            registers['EAX'] = true;
            registers['EDX'] = true;
            regLastData['EAX'] = null;
            regLastData['EDX'] = null;
            reg1 = loadPlace(s.in1, 'EAX');
            reg2 = loadPlace(s.in2);
            pushResult('IMUL', reg2);
            storePlace(s.out, 'EAX');
            deallocReg('EAX');
            deallocReg('EDX');
            deallocReg(reg2);
            break;
        case '/':
        case '%':
            registers['EAX'] = true;
            registers['EDX'] = true;
            regLastData['EAX'] = null;
            regLastData['EDX'] = null;
            pushResult('MOV', 'EDX', '0');
            reg1 = loadPlace(s.in1, 'EAX');
            reg2 = loadPlace(s.in2);
            pushResult('IDIV', reg2);
            if (s.op == '/')
                storePlace(s.out, 'EAX');
            else
                storePlace(s.out, 'EDX');
            deallocReg('EAX');
            deallocReg('EDX');
            deallocReg(reg2);
            break;
        case ':=':
            reg1 = loadPlace(s.in1);
            storePlace(s.out, reg1);
            deallocReg(reg1);
            break;
        case 'j':
            pushResult('JMP', 'L' + s.out);
            break;
        case 'j=':
            if (!op) op = 'JE';
        case 'j<>':
            if (!op) op = 'JNE';
        case 'j<':
            if (!op) op = 'JL';
        case 'j>':
            if (!op) op = 'JG';
        case 'j<=':
            if (!op) op = 'JLE';
        case 'j>=':
            if (!op) op = 'JGE';

            if (s.in2[0] === '$') {
                reg1 = loadPlace(s.in1);
                pushResult('CMP', reg1, s.in2.slice(1));
            } else if (s.in1[0] === '$') {
                reg1 = loadPlace(s.in2);
                if (op[1] === 'L')
                    op = op[0] + 'G' + op.slice(2);
                else if (op[1] === 'G')
                    op = op[0] + 'L' + op.slice(2);
                pushResult('CMP', reg1, s.in1.slice(1));
            } else {
                reg1 = loadPlace(s.in1);
                reg2 = loadPlace(s.in2);
                pushResult('CMP', reg1, reg2);
                deallocReg(reg2);
            }
            deallocReg(reg1);
            pushResult(op, 'L' + s.out);
            break;
        case 'in':
            registers['EAX'] = true;
            pushResult('CALL', '_input');
            storePlace(s.out, 'EAX');
            deallocReg('EAX');
            break;
        case 'out':
            reg1 = loadPlace(s.in1);
            pushResult('MOV', '[ESP]', reg1);
            pushResult('CALL', '_output');
            deallocReg(reg1);
            break;
        case 'nop':
            break;
        default:
            throw "Unknown op!"; // XXX
        }
    }
    result.push('L0:');
    pushResult('ADD', 'ESP', memLength);
    result.push('\tPOPAD');
    result.push('\tRET');

    return result.join('\n');
}

function toYasm(intermediate) {
    var asm = x86Asm(intermediate);
    var result = [];
    result.push('GLOBAL _asm_start');
    result.push('EXTERN _input');
    result.push('EXTERN _output');
    result.push('BITS 32');
    result.push('SECTION .text');
    result.push('_asm_start:');
    result.push(asm);
    result.push('');

    return result.join('\n');
}

if (typeof module !== 'undefined' && module.exports) {
    exports.x86Asm = x86Asm;
    exports.toYasm = toYasm;
}
