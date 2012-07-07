var TMP_PREFIX = '@';

function MySet() {
    this.set = {};
}

MySet.prototype.add = function (v) {
    this.set[v] = true;
};

MySet.prototype.delete = function (v) {
    delete this.set[v];
};

MySet.prototype.has = function (v) {
    return !!this.set[v];
};

MySet.prototype.size = function () {
    return Object.keys(this.set).length;
};

MySet.prototype.concat = function (set) {
    if (!(set instanceof MySet))
        return;
    for (var t in set.set)
        this.add(t);
};

MySet.prototype.clone = function () {
    var ret = new MySet();
    for (var t in this.set)
        ret.add(t);
    return ret;
};

MySet.prototype.without = function () {
    var ret = this.clone();
    for (var i = 0; i < arguments.length; ++i)
        ret.delete(arguments[i]);
    return ret;
};

MySet.prototype.toArray = function () {
    return Object.keys(this.set);
};

MySet.prototype.toString = function () {
    return '{' + this.toArray().map(JSON.stringify).join(', ') + '}';
};

function Frontend(syntax, ignore, start) {
    this.syntax = syntax;
    this.ignore = ignore;
    this.start = start;

    // generate word-matching regular expression
    var nontermRegs = [];
    for (var t in this.syntax) {
        var s = this.syntax[t];
        for (var i = 0; i < s.length; ++i) {
            var expr = s[i].expr;
            for (var j = 0; j < expr.length; ++j)
                if (expr[j] instanceof RegExp)
                    nontermRegs.push(expr[j].source);
        }
    }
    this.nonterms = new RegExp('^(' + nontermRegs.join('|') + ')');
    
    // generate ignorance matching regular expression
    var ignoreRegs = [];
    for (var i = 0; i < ignore.length; ++i)
        ignoreRegs.push(ignore[i].source);
    this.ignores = new RegExp('^(' + ignoreRegs.join('|') + ')+');
    
    // generate action & goto table
    this.generateTables();
}

function escapeName(name) {
    return name.replace(/[\^:;]/, '^$0');
}

function Term(name, index, pos) {
    this.name = name;
    this.index = index;
    this.pos = pos;
}

Term.prototype.toString = function () {
    return escapeName(this.name) + ':' + this.index + ':' + this.pos;
};

function State(terms, syntax) {
    var termSet = {};
    for (var i = 0; i < terms.length; ++i)
        termSet[terms[i]] = terms[i];

    var list = Object.keys(termSet);
    this.terms = [];
    for (var i = 0; i < list.length; ++i) {
        var term = termSet[list[i]];
        this.terms.push(term);
        var nt = syntax[term.name][term.index].expr[term.pos];
        if (typeof nt !== 'string')
            continue;
        var ns = syntax[nt];
        for (var j = 0; j < ns.length; ++j) {
            var newt = new Term(nt, j, 0);
            if (!termSet[newt]) {
                termSet[newt] = newt;
                list.push(newt.toString());
            }
        }
    }

    this.terms.sort();
    this.syntax = syntax;
}

State.prototype.nextState = function (nont) {
    var terms = this.terms;
    var syntax = this.syntax;
    var isRegx = nont instanceof RegExp;
    if (isRegx)
        nont = nont.source;
    var newTerms = [];
    for (var i = 0; i < terms.length; ++i) {
        var term = terms[i];
        var t = syntax[term.name][term.index].expr[term.pos];
        if (isRegx && t instanceof RegExp && t.source === nont || t === nont)
            newTerms.push(new Term(term.name, term.index, term.pos + 1));
    }
    return new State(newTerms, syntax);
};

State.prototype.toString = function () {
    return this.terms.join(';');
};

Frontend.prototype.generateTables = function () {
    var flag;

    // compute FIRST set
    var first = {};
    flag = true;
    while (flag) {
        flag = false;
        for (var t in this.syntax) {
            var s = this.syntax[t];
            if (!(first[t] instanceof MySet))
                first[t] = new MySet();
            var tf = first[t];
            var oldLen = tf.size();
            for (var i = 0; i < s.length; ++i) {
                var expr = s[i].expr;
                if (expr.length === 0)
                    tf.add('e');
                else {
                    var j;
                    for (j = 0; j < expr.length; ++j) {
                        var te = expr[j];
                        if (te instanceof RegExp) {
                            tf.add('r' + te.source);
                            break;
                        } else if (typeof te === 'string') {
                            if (!(first[te] instanceof MySet))
                                break;
                            tf.concat(first[te].without('e'));
                            if (!first[te].has('e'))
                                break;
                        }
                    }
                    if (j === expr.length)
                        tf.add('e');
                }
            }
            if (tf.size() != oldLen)
                flag = true;
        }
    }

    // compute FOLLOW set
    var follow = {};
    flag = true;
    for (var t in this.syntax)
        follow[t] = new MySet();
    follow[this.start].add('n');
    while (flag) {
        flag = false;
        for (var t in this.syntax) {
            var s = this.syntax[t];
            for (var i = 0; i < s.length; ++i) {
                var expr = s[i].expr;
                for (var j = 0; j < expr.length; ++j) {
                    var te = expr[j];
                    if (typeof te !== 'string')
                        continue;
                    var tf = follow[te];
                    var oldLen = tf.size();
                    var k;
                    for (k = j + 1; k < expr.length; ++k) {
                        var te2 = expr[k];
                        if (te2 instanceof RegExp) {
                            tf.add('r' + te2.source);
                            break;
                        } else if (typeof te2 === 'string') {
                            tf.concat(first[te2].without('e'));
                            if (!first[te2].has('e'))
                                break;
                        }
                    }
                    if (k === expr.length)
                        tf.concat(follow[t]);
                    if (oldLen !== tf.size())
                        flag = true;
                }
            }
        }
    }
    for (var t in follow)
        follow[t] = follow[t].toArray();

    // convert regexp to full match
    function convertRegx(regx) {
        return new RegExp('^(' + regx.source + ')$', regx.flags);
    }

    // build SLR analysis tables
    var syntax = this.syntax;
    var start = this.start;
    var startTerms = syntax[start].map(function (e, index) {
        return new Term(start, index, 0);
    });
    var states = [new State(startTerms, syntax)];
    var stateSet = {};
    stateSet[states[0]] = 0;
    this.actionTable = [];
    this.gotoTable = [];
    for (var i = 0; i < states.length; ++i) {
        var newAct = [], newGoto = {};
        var symSet = new MySet();
        var state = states[i];
        var terms = state.terms;
        for (var j = 0; j < terms.length; ++j) {
            var term = terms[j];
            var nextSym = syntax[term.name][term.index].expr[term.pos];
            if (nextSym === undefined) {
                var fo = follow[term.name];
                for (var k = 0; k < fo.length; ++k) {
                    var match;
                    switch (fo[k][0]) {
                        case 'r':
                            match = convertRegx({source: fo[k].substring(1)});
                            break;
                        case 'n':
                            match = null;
                            break;
                    }
                    newAct.push({
                        match: match,
                        action: 'reduce',
                        type: term.name,
                        index: term.index
                    });
                }
            } else {
                var sSym = nextSym instanceof RegExp ?
                    'r' + nextSym.source : 's' + nextSym;
                if (symSet.has(sSym)) continue;
                symSet.add(sSym);
                var nextState = state.nextState(nextSym);
                if (stateSet[nextState] === undefined) {
                    stateSet[nextState] = states.length;
                    states.push(nextState);
                }
                if (typeof nextSym === 'string') {
                    newGoto[nextSym] = stateSet[nextState];
                } else if (nextSym instanceof RegExp) {
                    newAct.push({
                        match: convertRegx(nextSym),
                        action: 'shift',
                        state: stateSet[nextState]
                    });
                }
            }
        }
        this.actionTable.push(newAct);
        this.gotoTable.push(newGoto);
    }
    this.gotoTable[0][this.start] = -1;
};

Frontend.prototype.passString = function (length) {
    for (var i = 0; i < length; ++i) {
        switch (this.left[i]) {
            case '\r':
                break;
            case '\n':
                this.line += 1;
                this.colume = 1;
                break;
            default:
                this.colume += 1;
                break;
        }
    }
    this.pos += length;
    this.left = this.left.substring(length);
};

function SyntaxException(f) {
    this.message = "Syntax error";
    this.line = f.line;
    this.colume = f.colume;
}

Frontend.prototype.nextWord = function () {
    var word;
    while (true) {
        word = this.nonterms.exec(this.left);
        if (word) break;
        if (!this.left)
            return null;
        var ignore = this.ignores.exec(this.left);
        if (!ignore)
            throw new SyntaxException(this);
        this.passString(ignore[0].length);
    }
    word = word[0];
    var start = {
        line: this.line,
        colume: this.colume,
        pos: this.pos
    };
    this.passString(word.length);
    var end = {
        line: this.line,
        colume: this.colume,
        pos: this.pos
    };
    return {text: word, start: start, end: end};
};

Frontend.prototype.doAction = function (act) {
    var ret = null;
    switch (act.action) {
        case 'shift':
            this.reduced.push(this.next);
            this.stack.push(act.state);
            this.next = this.nextWord();
            break;
        case 'reduce':
            var syntax = this.syntax[act.type][act.index];
            var length = syntax.expr.length;
            var reduced;
            if (length > 0) {
                reduced = this.reduced.splice(-length);
                this.stack.splice(-length);
            } else {
                var lastItem = this.reduced[this.reduced.length - 1];
                reduced = [{
                    text: '',
                    start: lastItem.end,
                    end: lastItem.end
                }];
            }

            var p = {
                type: act.type,
                expr: syntax.expr,
                rule: syntax.rule,
                start: reduced[0].start,
                end: reduced[reduced.length - 1].end,
                $: {}
            };
            for (var i = 0; i < length; ++i)
                p[i] = reduced[i];

            var state = this.stack[this.stack.length - 1];
            var nextState = this.gotoTable[state][act.type];
            this.reduced.push(p);
            this.stack.push(nextState);
            ret = p;
            break;
    }
    return ret;
};

Frontend.prototype.nextPhrase = function () {
    var acts, state, next, flag;

    while (next = this.next) {
        state = this.stack[this.stack.length - 1];
        acts = this.actionTable[state];
        flag = false;
        for (var i = 0; i < acts.length; ++i) {
            var act = acts[i];
            if (!(act.match && act.match.test(next.text)))
                continue;
            flag = true;
            var ret = this.doAction(act);
            if (ret !== null)
                return ret;
            break;
        }
        if (!flag)
            throw new SyntaxException(this);
    }

    // final reductions
    state = this.stack[this.stack.length - 1];
    if (state === -1)
        return null;
    acts = this.actionTable[state];
    for (var i = 0; i < acts.length; ++i) {
        var act = acts[i];
        if (act.match === null)
            // assert act.action === 'reduce'
            return this.doAction(act);
    }
    // check accept
    var reduced = this.reduced;
    if (reduced.length == 2 && reduced[1].type === this.start)
        return null;
    throw new SyntaxException(this);
};

Frontend.prototype.initTranslate = function (source) {
    this.source = source;
    this.left = source;
    this.pos = 0;
    this.line = 1;
    this.colume = 1;
    this.stack = [0];
    this.reduced = [null];
    this.next = this.nextWord();
};

function Result(begin) {
    if (!begin) begin = 1;
    this.nextquad = this.begin = begin;
    this.tmpnum = 0;
    this.$ = {};
}

Result.prototype.emit = function (op, in1, in2, out) {
    this[this.nextquad] = {op: op, in1: in1, in2: in2, out: out};
    var curquad = this.nextquad;
    this.nextquad += 1;
    return curquad;
};

Result.prototype.backpatch = function (list, out) {
    for (var i = 0; i < list.length; ++i)
        this[list[i]].out = out;
};

Result.prototype.newtemp = function () {
    return TMP_PREFIX + ++this.tmpnum;
};

Result.prototype.toString = function () {
    var result = [];
    for (var i = this.begin; i < this.nextquad; ++i) {
        var t = this[i];
        result.push(i + ':\t(' +
                t.op + '\t, ' +
                (t.in1 !== null ? t.in1 : '-') + '\t, ' +
                (t.in2 !== null ? t.in2 : '-') + '\t, ' +
                (t.out !== null ? t.out : '-') + '\t)');
    }
    return result.join('\n');
};

Frontend.prototype.callRule = function (p, result) {
    var rule = p.rule;
    if (typeof rule !== 'function')
        return;
    var args = [p];
    for (var i = 0; i < p.expr.length; ++i)
        args.push(p[i]);
    rule.apply(result, args);
};

Frontend.prototype.translate = function (source) {
    this.initTranslate(source);

    var result = new Result(100);
    var p;
    while (p = this.nextPhrase())
        this.callRule(p, result);

    return result;
};

if (module !== undefined) {
    exports.Frontend = Frontend;
    exports.Result = Result;
}
