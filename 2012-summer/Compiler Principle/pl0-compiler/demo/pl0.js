var $source = $('#source'),
    $prev = $('#prev'),
    $next = $('#next');
function whitespaces(num) {
    return (new Array(num + 1)).join(' ');
}

$('#smp').addEventListener('click', function (e) {
    if (e.target.tagName === 'PRE') {
        $source.value = e.target.innerText;
        $next.disabled = false;
    }
}, true);

$source.addEventListener('keydown', function (e) {
    var key = e.keyCode || e.which;
    if (key === 9) {
        var source = $source.value;
        var sel0 = $source.selectionStart,
            sel1 = $source.selectionEnd;
        var lb0 = source.lastIndexOf('\n', sel0 - 1),
            lb1 = source.indexOf('\n', sel1);
        if (sel1 - 1 > -1 && source[sel1 - 1] === '\n')
            lb1 = sel1 - 1;
        if (lb1 == -1) lb1 = source.length;

        e.preventDefault();

        if (!e.shiftKey) {
            if (sel0 == sel1) {
                var num = 4 - (sel0 - lb0 - 1) % 4;
                source = source.slice(0, sel0) +
                        whitespaces(num) +
                        source.slice(sel0);
                sel0 = sel1 = sel0 + num;
            } else {
                var pos = source.indexOf('\n', sel0);
                if (pos !== -1 && pos < sel1) {
                    var pieces = [];
                    if (lb0 > -1)
                        pieces.push(source.slice(0, lb0));
                    var lines = source.slice(lb0 + 1, lb1).split('\n');
                    var len = 0;
                    for (var i = 0; i < lines.length; ++i) {
                        pieces.push('    ' + lines[i]);
                        len += lines[i].length + 4 + 1;
                    }
                    if (lb1 < source.length)
                        pieces.push(source.slice(lb1 + 1));
                    source = pieces.join('\n');
                    sel0 = lb0 + 1;
                    sel1 = lb0 + len;
                } else if ((sel0 === 0 ||
                            source[sel0 - 1] === '\n' ||
                            source[sel0] === '\n') &&
                        (sel1 === source.length ||
                         source[sel1] === '\n' ||
                         source[sel1 - 1] == '\n')) {
                    if (source[sel0] === '\n') sel0 += 1;
                    if (source[sel1 - 1] === '\n') sel1 -= 1;
                    source = source.slice(0, sel0) +
                        '    ' + source.slice(sel0);
                    sel1 += 4;
                } else {
                    var num = 4 - (sel0 - lb0 - 1) % 4;
                    source = source.slice(0, sel0) +
                        whitespaces(num) +
                        source.slice(sel1);
                    sel0 = sel1 = sel0 + num;
                }
            }
        } else {
            var pieces = [];
            if (lb0 > -1)
                pieces.push(source.slice(0, lb0));
            var lines = source.slice(lb0 + 1, lb1).split('\n');
            var len = 0;
            for (var i = 0; i < lines.length; ++i) {
                var line = lines[i];
                for (var j = 0; j < 4; ++j) {
                    if (line[0] !== ' ')
                        break;
                    line = line.slice(1);
                }
                pieces.push(line);
                len += line.length + 1;
            }
            if (lb1 < source.length)
                pieces.push(source.slice(lb1 + 1));
            source = pieces.join('\n');
            sel0 = lb0 + 1;
            sel1 = lb0 + len;
        }
        $source.value = source;
        $source.setSelectionRange(sel0, sel1);
    } else if (key === 8) {
        var source = $source.value;
        var sel0 = $source.selectionStart,
            sel1 = $source.selectionEnd;
        e.preventDefault();
        if (sel0 === sel1) {
            sel0 -= 1;
            if (source[sel0 + 1] !== ' ' && source[sel0] === ' ') {
                var lb0 = source.lastIndexOf('\n', sel0);
                var pos = sel0 - (sel0 - lb0 - 1) % 4;
                for (; sel0 > pos && source[sel0 - 1] === ' '; --sel0)
                    ;
            }
        }
        $source.value = source.slice(0, sel0) + source.slice(sel1);
        $source.setSelectionRange(sel0, sel0);
    } else if (key === 13) {
        var source = $source.value;
        var sel0 = $source.selectionStart,
            sel1 = $source.selectionEnd;
        var lb0 = source.lastIndexOf('\n', sel0 - 1);

        e.preventDefault();

        var num;
        for (num = 0, lb0 += 1; source[lb0] === ' '; ++num, ++lb0)
            ;
        if (source[lb0] === '\n' || lb0 === source.length)
            sel0 -= num;
        $source.value = source.slice(0, sel0) + '\n' +
            whitespaces(num) + source.slice(sel1);
        sel0 += num + 1;
        $source.setSelectionRange(sel0, sel0);
    }
});
$source.addEventListener('keyup', function (e) {
    setTimeout(function () {
        var newstate = ($source.value.length == 0);
        if ($next.disabled !== newstate)
            $next.disabled = newstate;
    }, 0);
});

var frontend = new Frontend(PL0_SYNTAX, PL0_IGNORE, PL0_START);
var intermediate;
var curStart = 0, curEnd = 0;
var stack;

$prev.addEventListener('click', function (e) {
    $('.current').classList.add('future');
    $('.current').classList.remove('current');
    $('.prev').classList.add('current');
    $('.prev').classList.remove('prev');
    var $past = $all('.past');
    if ($past.length > 0) {
        $past = $past[$past.length - 1];
        $past.classList.add('prev');
        $past.classList.remove('past');
    }
    $next.disabled = false;
    if ($('.prev').id === 'smp')
        $prev.disabled = true;
    if ($('.current').id === 'src')
        $source.readOnly = false;
});
$next.addEventListener('click', function () {
    switch ($('.current').id) {
        case 'src':
            $('#intermediate>table>tbody').innerHTML = '';
            $('#properties>ul').innerHTML = '';
            intermediate = new Intermediate(100);
            frontend.initTranslate($source.value);
            stack = [null];
            $('#onestep').disabled = false;
            $('#toimc').disabled = false;
            $source.readOnly = true;
            $('#error').innerHTML = '';
            continuously = false;
            $next.disabled = true;
            break;
        case 'imc':
            $('#asmcode').innerHTML = toYasm(intermediate).toHTML();
            break;
        case 'asm':
            $next.disabled = true;
    }
    $prev.disabled = false;
    $('.prev').classList.add('past');
    $('.prev').classList.remove('prev');
    $('.current').classList.add('prev');
    $('.current').classList.remove('current');
    $('.future').classList.add('current');
    $('.future').classList.remove('future');
});

function stringify(obj) {
    if (typeof obj === 'string') {
        return obj;
    } else if (typeof obj === 'number') {
        return obj.toString();
    } else if (obj instanceof Array) {
        return '[' + obj.join(', ') + ']';
    }
}
function showError(e) {
    $('#error').innerHTML = ('Error: ' + e.message +
            ', line ' + e.line + ' colume ' + e.colume).toHTML();
}
function fillTd($td, value) {
    $td.innerHTML = value !== null ? value.toHTML() : '-';
}
function createPharseItem(pharse) {
    var $li = $c('li'),
        $ul = $c('ul');
    if (pharse.type)
        $li.innerHTML = pharse.type.toHTML();
    else
        $li.innerHTML = ('"' + pharse.text + '"').toHTML();
    $li.dataset.start = pharse.start.pos;
    $li.dataset.end = pharse.end.pos;
    for (var p in pharse.$) {
        var $item = $c('li');
        $item.innerHTML = (p + ' = ' + stringify(pharse.$[p])).toHTML();
        $ul.appendChild($item);
    }
    $li.appendChild($ul);
    return $li;
}
var finished = true,
    continuously = false;
function nextStep() {
    if (!finished)
        return;
    finished = false;

    var p, error = false;
    while (stack.length == frontend.reduced.length) {
        try {
            p = frontend.nextPhrase();
            if (p)
                frontend.callRule(p, intermediate);
        } catch (e) {
            showError(e);
            error = true;
        }
        if (!p || error) {
            $('#onestep').disabled = true;
            $('#toimc').disabled = true;
            if (!error)
                $next.disabled = false;
            if (error) {
                finished = true;
                return;
            } else {
                break;
            }
        } else {
            curStart = p.start.pos;
            curEnd = p.end.pos;
        }
    }

    function checkTd($td, value) {
        if (value === null) {
            if ($td.innerHTML === '-')
                return;
        } else if ($td.innerHTML === value.toHTML()) {
            return;
        }
        fillTd($td, value);
        $td.classList.add('new');
    }

    var startPop = stack.length;
    for (var i = 0; i < stack.length; ++i) {
        if (stack[i] !== frontend.reduced[i]) {
            startPop = i;
            break;
        }
    }

    var popList = $all('#properties>ul>li').toArray();
    popList = popList.slice(0, stack.length - startPop);
    stack.splice(startPop);

    var pushList = [];
    for (var i = startPop; i < frontend.reduced.length; ++i) {
        stack.push(frontend.reduced[i]);
        pushList.push(createPharseItem(frontend.reduced[i]));
    }

    var $ul = $('#properties>ul');
    function moveNext() {
        var $item;
        if (popList.length > 0) {
            $item = popList.shift();
            $item.style.marginTop = '-' + $item.offsetHeight + 'px';
            setTimeout(function () {
                $ul.removeChild($item);
                moveNext();
            }, 300);
        } else if (pushList.length > 0) {
            $item = pushList.shift();
            $item.classList.add('new');
            $ul.insertBefore($item, $ul.firstChild);
            $item.style.marginTop = '-' + $item.offsetHeight + 'px';
            $source.setSelectionRange(
                    parseInt($item.dataset.start),
                    parseInt($item.dataset.end));
            setTimeout(function () {
                $item.classList.remove('new');
                $item.style.marginTop = '0px';
                setTimeout(function () {
                    moveNext();
                }, 300);
            }, 5);
        } else {
            var i = 0,
                $tbody = $('#intermediate>table>tbody'),
                $trs = $all('tr', $tbody);
            $all('.new', $tbody).forEach(function ($e) {
                $e.classList.remove('new');
            });
            for (var j in intermediate) {
                if (!intermediate.hasOwnProperty(j))
                    continue;

                var $tr, $td;
                var item = intermediate[j];
                if (i >= $trs.length) {
                    $tr = $c('tr');
                    $tr.classList.add('create');
                    $td = $c('th'); fillTd($td, j); $tr.appendChild($td);
                    $td = $c('td'); fillTd($td, item.op); $tr.appendChild($td);
                    $td = $c('td'); fillTd($td, item.in1); $tr.appendChild($td);
                    $td = $c('td'); fillTd($td, item.in2); $tr.appendChild($td);
                    $td = $c('td'); fillTd($td, item.out); $tr.appendChild($td);
                    $tbody.appendChild($tr);
                    setTimeout(function () {
                        $tr.classList.add('new');
                        $tr.classList.remove('create');
                    }, 5);
                } else {
                    $tr = $trs[i];

                    var $tds = $all('td', $tr);
                    checkTd($tds[0], item.op);
                    checkTd($tds[1], item.in1);
                    checkTd($tds[2], item.in2);
                    checkTd($tds[3], item.out);
                }

                ++i;
            }
            finished = true;
            if (continuously && p) {
                setTimeout(function () {
                    nextStep();
                }, 0);
            }
        }
    }
    moveNext();
}
$('#onestep').addEventListener('click', nextStep);
$('#toimc').addEventListener('click', function () {
    continuously = !continuously;
    if (continuously)
        nextStep();
});
$('#properties>ul').addEventListener('mouseover', function (e) {
    var $t = e.target;
    if ($t.parentNode !== this)
        return;
    var start = parseInt($t.dataset.start),
        end = parseInt($t.dataset.end);
    if ($source.selectionStart !== start ||
        $source.selectionEnd !== end)
        $source.setSelectionRange(start, end);
});
$('#properties>ul').addEventListener('mouseout', function (e) {
    var $t = e.target;
    if ($t.parentNode !== this)
        return;
    if ($source.selectionStart !== curStart ||
        $source.selectionEnd !== curEnd)
        $source.setSelectionRange(curStart, curEnd);
});

var platform = navigator.platform,
    objfmt;
if (platform.indexOf('Win') >= 0)
    objfmt = 'win32';
else if (platform.indexOf('Mac') >= 0)
    objfmt = 'macho';
else
    objfmt = 'elf';
$('#objfmt').innerHTML = objfmt;
