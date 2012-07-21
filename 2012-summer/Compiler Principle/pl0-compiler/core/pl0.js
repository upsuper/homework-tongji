function UndefinedIdentifierException(id) {
    this.message = "Undefined identifier: " + id.$.name;
    this.line = id.start.line;
    this.colume = id.start.colume;
}

function checkId(r, id) {
    if (r.$.symTab[id.$.name] === undefined)
        throw new UndefinedIdentifierException(id);
}

function NotVariableException(id) {
    this.message = "Identifier is not a variable: " + id.$.name;
    this.line = id.start.line;
    this.colume = id.start.colume;
}

function checkVar(r, id) {
    checkId(r, id);
    if (r.$.symTab[id.$.name] === undefined)
        throw new NotVariableException(id);
}

var PL0_SYNTAX = {
    Program: [{
        expr: ['Header', 'SubProgram']
    }],
    Header: [{
        expr: [/PROGRAM/, 'Identifier'],
        rule: function () {
            this.$.symTab = {};
        }
    }],
    SubProgram: [{
        expr: ['ConstDesc', 'VarDesc', 'Statement']
    }],
    ConstDesc: [{expr: []}, {
        expr: [/CONST/, '_ConstDesc', /;/]
    }],
    _ConstDesc: [{
        expr: ['ConstDefine']
    }, {
        expr: ['_ConstDesc', /,/, 'ConstDefine']
    }],
    ConstDefine: [{
        expr: ['Identifier', /=/, 'Constant'],
        rule: function (d, id, _eq, c) {
            this.$.symTab[id.$.name] = c.$.value;
        }
    }],
    Integer: [{
        expr: [/\d+/],
        rule: function (i, v) {
            i.$.value = parseInt(v.text);
        }
    }],
    VarDesc: [{expr: []}, {
        expr: [/VAR/, '_VarDesc', /;/]
    }],
    _VarDesc: [{
        expr: ['VarDefine']
    }, {
        expr: ['_VarDesc', /,/, 'VarDefine']
    }],
    VarDefine: [{
        expr: ['Identifier'],
        rule: function (d, id) {
            this.$.symTab[id.$.name] = null;
        }
    }],
    Identifier: [{
        expr: [/[a-z][a-z\d]*/],
        rule: function (id, v) {
            id.$.name = v.text;
        }
    }],
    Constant: [{
        expr: ['Integer'],
        rule: function (c, i) {
            c.$.value = i.$.value;
        }
    }],
    Statement: [{
        expr: ['_Statement'],
        rule: function (s, s1) {
            var nextlist = s1[0].$.nextlist;
            if (!(nextlist instanceof Array))
                nextlist = [];
            s.$.nextlist = nextlist;
        }
    }],
    _Statement: [
        {expr: ['AssignStatement']},
        {expr: ['CondStatement']},
        {expr: ['LoopStatement']},
        {expr: ['CompStatement']},
        {expr: ['IOStatement']},
        {expr: ['EmptyStatement']}
    ],
    EmptyStatement: [{
        expr: [],
        rule: function (s) {
            this.emit('nop', null, null, null);
        }
    }],
    AssignStatement: [{
        expr: ['Identifier', /:=/, 'Expression'],
        rule: function (s, id, _as, e) {
            checkVar(this, id);
            this.emit(':=', e.$.place, null, '%' + id.$.name);
        }
    }],
    Expression: [{
        expr: ['Term'],
        rule: function (e, t) {
            e.$.place = t.$.place;
        }
    }, {
        expr: [/[+-]/, 'Term'],
        rule: function (e, op, t) {
            op = op.text;
            if (op === '+')
                e.$.place = t.$.place;
            else {
                if (t.$.place[0] === '$')
                    e.$.place = '$' + -t.$.place.slice(1);
                else {
                    e.$.place = '%' + this.newtemp();
                    this.emit('-', t.$.place, null, e.$.place);
                }
            }
        }
    }, {
        expr: ['Expression', /[+-]/, 'Term'],
        rule: function (e, e1, op, t) {
            var e1p = e1.$.place, tp = t.$.place;
            op = op.text;
            if (e1p[0] === '$' && tp[0] === '$') {
                var result;
                e1p = parseInt(e1p.slice(1));
                tp = parseInt(tp.slice(1));
                if (op === '+')
                    result = e1p + tp;
                else if (op === '-')
                    result = e1p - tp;
                e.$.place = '$' + result;
            } else {
                e.$.place = '%' + this.newtemp();
                this.emit(op, e1.$.place, t.$.place, e.$.place);
            }
        }
    }],
    Term: [{
        expr: ['Factor'],
        rule: function (t, f) {
            t.$.place = f.$.place;
        }
    }, {
        expr: ['Term', /[\*\/%]/, 'Factor'],
        rule: function (t, t1, op, f) {
            var t1p = t1.$.place, fp = f.$.place;
            op = op.text;
            if (t1p[0] === '$' && fp[0] === '$') {
                var result;
                if (op === '*')
                    result = t1p.slice(1) * fp.slice(1);
                else if (op === '/')
                    result = t1p.slice(1) / fp.slice(1);
                else if (op === '%')
                    result = t1p.slice(1) % fp.slice(1);
                t.$.place = '$' + result;
            } else {
                t.$.place = '%' + this.newtemp();
                this.emit(op, t1.$.place, f.$.place, t.$.place);
            }
        }
    }],
    Factor: [{
        expr: ['Identifier'],
        rule: function (f, id) {
            checkId(this, id);
            var name = id.$.name;
            var sym = this.$.symTab[name];
            if (sym !== null)
                f.$.place = '$' + sym;
            else
                f.$.place = '%' + name;
        }
    }, {
        expr: ['Constant'],
        rule: function (f, c) {
            f.$.place = '$' + c.$.value;
        }
    }, {
        expr: [/\(/, 'Expression', /\)/],
        rule: function (f, _q1, e, _q2) {
            f.$.place = e.$.place;
        }
    }],
    M: [{
        expr: [],
        rule: function (m) {
            m.$.quad = this.nextquad;
        }
    }],
    CondStatement: [{
        expr: [/IF/, 'Condition', /THEN/, 'M', 'Statement'],
        rule: function (s, _if, e, _then, m, s1) {
            this.backpatch(e.$.truelist, m.$.quad);
            s.$.nextlist = e.$.falselist.concat(s1.$.nextlist);
        }
    }],
    LoopStatement: [{
        expr: [/WHILE/, 'M', 'Condition', /DO/, 'M', 'Statement'],
        rule: function (s, _while, m1, e, _do, m2, s1) {
            this.backpatch(s1.$.nextlist, m1.$.quad);
            this.backpatch(e.$.truelist, m2.$.quad);
            s.$.nextlist = e.$.falselist;
            this.emit('j', null, null, m1.$.quad);
        }
    }],
    Condition: [{
        expr: ['Expression', /=|<>|<=?|>=?/, 'Expression'],
        rule: function (e, e1, op, e2) {
            /*
            e.$.truelist = [this.nextquad];
            this.emit('j' + op.text, e1.$.place, e2.$.place, 0);
            e.$.falselist = [this.nextquad];
            this.emit('j', null, null, 0);
            */
            var e1p = e1.$.place, e2p = e2.$.place;
            e.$.truelist = [];
            e.$.falselist = [this.nextquad];
            if (e1p[0] === '$' && e2p[0] === '$') {
                var e1n = parseInt(e1p.slice(1)),
                    e2n = parseInt(e2p.slice(1));
                var result;
                switch (op.text) {
                    case '=':   result = (e1n === e2n); break;
                    case '<>':  result = (e1n !== e2n); break;
                    case '<':   result = (e1n < e2n);   break;
                    case '>':   result = (e1n > e2n);   break;
                    case '<=':  result = (e1n <= e2n);  break;
                    case '>=':  result = (e1n >= e2n);  break;
                }
                if (!result)
                    this.emit('j', null, null, 0);
            } else {
                var rop;
                switch (op.text) {
                    case '=':   rop = '<>'; break;
                    case '<>':  rop = '=';  break;
                    case '<':   rop = '>='; break;
                    case '>':   rop = '<='; break;
                    case '<=':  rop = '>';  break;
                    case '>=':  rop = '<';  break;
                }
                this.emit('j' + rop, e1p, e2p, 0);
            }
        }
    }],
    IOStatement: [{
        expr: [/INPUT/, 'Identifier'],
        rule: function (s, _input, id) {
            checkVar(this, id);
            this.emit('in', null, null, '%' + id.$.name);
        }
    }, {
        expr: [/OUTPUT/, 'Expression'],
        rule: function (s, _output, e) {
            this.emit('out', e.$.place, null, null);
        }
    }],
    CompStatement: [{
        expr: [/BEGIN/, '_CompStatement', /END/],
        rule: function (s, _begin, l, _end) {
            s.$.nextlist = l.$.nextlist;
        }
    }],
    _CompStatement: [{
        expr: ['Statement'],
        rule: function (l, s) {
            l.$.nextlist = s.$.nextlist;
        }
    }, {
        expr: ['_CompStatement', /;/, 'M', 'Statement'],
        rule: function (l, l1, _semi, m, s) {
            this.backpatch(l1.$.nextlist, m.$.quad);
            l.$.nextlist = s.$.nextlist;
        }
    }]
};

var PL0_IGNORE = [/\s+/];
var PL0_START = 'Program';

if (typeof module !== 'undefined' && module.exports) {
    exports.syntax = PL0_SYNTAX;
    exports.ignore = PL0_IGNORE;
    exports.start = PL0_START;
}
