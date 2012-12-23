(function () {
    function $(id) { return document.getElementById(id); };
    function $q(q) { return document.querySelectorAll(q); };
    Node.prototype.bind = function (event, func) {
        this.addEventListener(event, func, false);
    };
    Node.prototype.show = function () {
        this.style.display = 'block';
    };
    Node.prototype.hide = function () {
        this.style.display = 'none';
    };
    Node.prototype.isHidden = function () {
        return this.style.display == 'none';
    };
    NodeList.prototype.forEach = Array.prototype.forEach;

    var SCALE = 5,
        RADIUS = SCALE / 2,
        WIDTH = 500,
        HEIGHT = 500,
        DELAY = 20,
        EPOCH_STEP = 50,
        MAX_EPOCH = 10000;
    var current = 0,
        dataSet = [],
        backpropagation;
    var $origin = $('origin'),
        $trained = $('trained'),
        $graph = $('graph');
    var originCtx = $origin.getContext('2d'),
        trainedCtx = $trained.getContext('2d'),
        graphCtx = $graph.getContext('2d');
    var $progress = $('progress');
    var b, minX, minY, maxX, maxY;

    var offsetTop, offsetLeft;
    switchCanvas($origin);
    function computeOffset() {
        offsetTop = 1;
        offsetLeft = 1;
        for (var $e = $origin; $e; $e = $e.offsetParent) {
            offsetTop += $e.offsetTop;
            offsetLeft += $e.offsetLeft;
        }
    }
    window.addEventListener('resize', computeOffset);
    computeOffset();

    $('add_class1').bind('click', function () {
        if (!current)
            redrawData();
        current = 1;
        b = undefined;
    });
    $('add_class2').bind('click', function () {
        if (!current)
            redrawData();
        current = 2;
        b = undefined;
    });
    $('clear').bind('click', function () {
        dataSet = [];
        redrawData();
        b = undefined;
    });

    $('save').bind('click', function () {
        var blob = new Blob([JSON.stringify(dataSet)], {
            'type': 'application/octet-stream'
        });
        $('iframe').src = URL.createObjectURL(blob);
        $('iframe').onload = function () {
            URL.revokeObjectURL(this.src);
        };
    });
    $('load').bind('click', function () {
        $('file').onchange = function () {
            var reader = new FileReader();
            reader.onload = function (e) {
                dataSet = JSON.parse(e.target.result);
                redrawData();
            };
            reader.readAsText(this.files[0]);
            b = undefined;
        };
        $('file').click();
    });

    var needContinue = false;
    $('hidden_layer').bind('change', function () {
        b = undefined;
    });
    $('train').bind('click', function () {
        var hiddenNum = parseInt($('hidden_layer').value);
        var $result = $('result');
        if (!dataSet.length) {
            $result.style.color = 'red';
            $result.textContent = 'No Data!';
            return;
        }

        $progress.value = '0';
        $progress.show();
        $('result').textContent = '';
        $q('button, input').forEach(function (elem) {
            elem.disabled = true;
        });
        $result.textContent = '';

        switchCanvas($trained);
        for (var i = 0; i < dataSet.length; i++) {
            var j = Math.floor(Math.random() * dataSet.length);
            var tmp = dataSet[i];
            dataSet[i] = dataSet[j];
            dataSet[j] = tmp;
        }
        minX = minY = 100;
        maxX = maxY = 0;
        for (var i = 0; i < dataSet.length; i++) {
            var x = dataSet[i][0],
                y = dataSet[i][1];
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
        }

        if (!b || !needContinue || !confirm('continue?'))
            b = new Backprogation([2, hiddenNum, 1]);
        nextEpoch(MAX_EPOCH, function (reason) {
            $progress.hide();
            switch (reason) {
                case 'achieve':
                    $result.style.color = 'green';
                    $result.textContent = 'Achieve!';
                    needContinue = false;
                    break;
                case 'limited':
                    $result.style.color = 'brown';
                    $result.textContent = 'Limited.';
                    needContinue = true;
                    break;
                case 'converge':
                    $result.style.color = 'red';
                    $result.textContent = 'Converge!';
                    needContinue = false;
                    break;
            }
            $q('button, input').forEach(function (elem) {
                elem.disabled = false;
            });
        });

        function updateProcess(per) {
            per = Math.round(per * 100);
            $progress.value = per;
            $progress.textContent = per + '%';
        }
        function nextEpoch(epoch, callback) {
            if (epoch <= 0) {
                callback('limited');
                return;
            }

            var startTime = (new Date()).getTime(),
                endTime;

            clearCanvas(trainedCtx);
            var diff = 0;
            for (var i = 0; i < dataSet.length; i++) {
                var data = dataSet[i],
                    result = b.simulate(prefeed(data))[0];
                drawPoint(trainedCtx, data[0], data[1], result2color(result));
                result -= data[2];
                diff += result * result;
            }

            // TODO check local minimum
            diff /= dataSet.length;
            if (diff <= 0.5e-3) {
                callback('achieve');
                return;
            }

            for (var k = 0; k < EPOCH_STEP; k++) {
                for (var i = 0; i < dataSet.length; i++) {
                    var data = dataSet[i];
                    b.train(prefeed(data), [data[2]]);
                }
            }

            endTime = (new Date()).getTime();
            if (startTime != endTime)
                console.log(startTime, endTime);
            setTimeout(function () {
                updateProcess(1 - epoch / MAX_EPOCH);
                nextEpoch(epoch - EPOCH_STEP, callback);
            }, DELAY - (endTime - startTime));
        }
    });

    $('switch').bind('click', function () {
        switchCanvas($origin.isHidden() ? $origin : $trained);
    });
    $('bgraph').bind('click', function () {
        clearCanvas(graphCtx);
        for (var i = 0; i < 100; i++) {
            for (var j = 0; j < 100; j++) {
                var result = b.simulate(prefeed([i, j]));
                drawPoint(graphCtx, i, j, result2color(result), RADIUS);
            }
        }
        switchCanvas($graph);
    });

    $('origin').bind('click', function (evt) {
        if (!current) return;
        
        var x = Math.floor((evt.pageX - offsetLeft - RADIUS) / SCALE),
            y = Math.floor((evt.pageY - offsetTop  - RADIUS) / SCALE);
        dataSet.push([x, y, current - 1]);
        drawPoint(originCtx, x, y, current - 1);
        b = undefined;
    });

    function switchCanvas(canvas) {
        $q('canvas').forEach(function (elem) {
            elem.hide();
        });
        canvas.show();
        if (canvas != $origin)
            current = 0;
    }
    function clearCanvas(ctx) {
        ctx.clearRect(0, 0, WIDTH, HEIGHT);
    }
    function prefeed(data) {
        return [(data[0] - minX) / (maxX - minX),
                (data[1] - minY) / (maxY - minY)];
    }
    function result2color(result) {
        var color = Math.round(255 * (1 - Math.abs(result * 2 - 1)));
        color = result > 0.5 ?
            'rgb(' + color + ', 255, 0)' :
            'rgb(255, ' + color + ', 0)';
        return color;
    }

    function drawPoint(ctx, x, y, c, r) {
        if (typeof c == 'number')
            c = c ? '#0f0' : '#f00';
        if (!r) r = RADIUS * 3;
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.arc(x * SCALE + RADIUS,
                y * SCALE + RADIUS,
                r, 0, Math.PI * 2, true);
        ctx.fill();
    }

    function redrawData() {
        clearCanvas(originCtx);
        for (var i = 0; i < dataSet.length; i++) {
            var data = dataSet[i];
            drawPoint(originCtx, data[0], data[1], data[2]);
        }
        switchCanvas($origin);
    }
})();
