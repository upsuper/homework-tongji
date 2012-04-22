var Drawing = { };

(function() {
    var $canvas, ctx;
    var animate_queue = [];

    Drawing.init = (function(canvas) {
        $canvas = canvas;
        ctx = canvas.getContext('2d');
    });

    Drawing.redraw = (function(network) {
        ctx.save()
        
        // init drawing
        var width = $canvas.width,
            height = $canvas.height;
        ctx.clearRect(0, 0, width, height);
        ctx.translate(width / 2, height / 2);

        // draw edges
        var acts = network.activities;
        for (var i = acts.length - 1; i >= 0; --i) {
            var act = acts[i];
            drawEdge(act.from_event.x, act.from_event.y,
                     act.to_event.x, act.to_event.y,
                     act.duration, act.is_key, act.selected);
        }

        // draw points
        var evts = network.events;
        for (var i = evts.length - 1; i >= 0; --i) {
            var evt = evts[i];
            drawPoint(evt.x, evt.y, evt.name,
                      (isFinite(evt.earliest) ? evt.earliest : "-\u221e") +
                      "/" + (isFinite(evt.latest) ? evt.latest : "+\u221e"),
                      evt.is_key, evt.selected);
        }

        ctx.restore();
    });

    function drawEdge(x1, y1, x2, y2, text, highlight, selected) {
        var dx = x2 - x1, dy = y2 - y1;
        var ds = Math.sqrt(dx * dx + dy * dy);
        if (ds < 30) return;
        var x = ds - 30;

        ctx.save();
        ctx.translate(x1, y1);
        ctx.rotate(Math.atan(dy / dx) + (dx < 0 ? Math.PI : 0));
        ctx.lineCap = "square";

        function drawArrow() {
            ctx.beginPath();
            ctx.moveTo(30, 0);
            ctx.lineTo(x - 8, 0);
            ctx.moveTo(x - 20, -12);
            ctx.lineTo(x, 0);
            ctx.lineTo(x - 20, 12);
            ctx.stroke();
        }

        ctx.strokeStyle = "#808080";
        ctx.lineWidth = 8;
        drawArrow();
               
        if (selected) {
            ctx.strokeStyle = "#EEEE66";
            ctx.lineWidth = 6;
            drawArrow();
            ctx.strokeStyle = "#E5E5A1";
            ctx.lineWidth = 5;
            drawArrow();
            ctx.strokeStyle = "#DCDCDC";
            ctx.lineWidth = 4;
            drawArrow();
        } else {
            ctx.strokeStyle = "#DCDCDC";
            ctx.lineWidth = 6;
            drawArrow();
        }

        ctx.font = "14px sans-serif";
        ctx.textBaseline = "bottom";
        ctx.textAlign = "center";
        if (ds > 60) {
            if (dx < 0) {
                ctx.save();
                ctx.translate(ds, 0);
                ctx.rotate(Math.PI);
                ctx.fillText(text, ds / 2 + 10, -1.5, ds - 60);
                ctx.restore();
            } else {
                ctx.fillText(text, ds / 2 - 10, -1.5, ds - 60);
            }
        }

        if (highlight) {
            ctx.globalCompositeOperation = "destination-over";
            ctx.lineWidth = 16;
            ctx.strokeStyle = "rgba(30, 144, 255, .1)";
            drawArrow();
            ctx.lineWidth = 14;
            ctx.strokeStyle = "rgba(30, 144, 255, .1)";
            drawArrow();
            ctx.lineWidth = 12;
            ctx.strokeStyle = "rgba(30, 144, 255, .44)";
            drawArrow();
            ctx.lineWidth = 10;
            ctx.strokeStyle = "rgba(30, 144, 255, .78)";
            drawArrow();
        }
    
        ctx.restore();
    }

    function drawPoint(x, y, title, text, highlight, selected) {
        ctx.save();
        ctx.translate(x, y);

        var grad = ctx.createLinearGradient(-20, -18, 5, -1);
        grad.addColorStop(0, "#808080");
        grad.addColorStop(.5, "#DCDCDC");
        grad.addColorStop(1, "#808080");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, 30, 0, Math.PI * 2, true);
        ctx.fill();

        if (! selected) {
            ctx.fillStyle = "#DCDCDC";
        } else {
            var sel = ctx.createRadialGradient(0, 0, 20, 0, 0, 15);
            sel.addColorStop(0, "#EEEE66");
            sel.addColorStop(1, "#DCDCDC");
            ctx.fillStyle = sel;
        }

        ctx.beginPath();
        ctx.arc(0, 0, 20, 0, Math.PI * 2, true);
        ctx.fill();

        ctx.strokeStyle = "#666";
        ctx.lineWidth = .6;
        ctx.beginPath();
        ctx.arc(0, 0, 20, 0, Math.PI * 2, true);
        ctx.stroke();

        ctx.fillStyle = "#000";
        ctx.textAlign = "center";
        ctx.font = "14px sans-serif";
        ctx.textBaseline = "alphabetic";
        ctx.fillText(title, 0, -1.5, 40);
        ctx.font = "10px sans-serif";
        ctx.textBaseline = "top";
        ctx.fillText(text, 0, 2.5, 40);

        if (highlight) {
            var hl = ctx.createRadialGradient(0, 0, 30, 0, 0, 40);
            hl.addColorStop(0, "rgba(30, 144, 255, .9)");
            hl.addColorStop(.5, "rgba(30, 144, 255, .2)");
            hl.addColorStop(.8, "rgba(30, 144, 255, .03)");
            hl.addColorStop(1, "rgba(30, 144, 255, 0)");
            ctx.fillStyle = hl;
            ctx.globalCompositeOperation = "destination-over";
            ctx.beginPath();
            ctx.arc(0, 0, 40, 0, Math.PI * 2, true);
            ctx.fill();
        }

        ctx.restore();
    }

})();
