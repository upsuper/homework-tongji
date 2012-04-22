(function() {

    /* Functions */

    function convertCoordinate(x, y) {
        x -= $canvas.width / 2;
        y -= $canvas.height / 2;
        return { x: x, y: y };
    }

    function updateToolbar() {
        // reset all button
        $delete.disabled = false;
        $edit.disabled = false;
        $act_from.disabled = false;
        $act_to.disabled = false;

        // check points
        var points = 0;
        var evts = network.events;
        for (var i = 0; i < evts.length; ++i) {
            if (evts[i].selected) {
                ++points;
                if (evts[i] == network.start_event) {
                    $delete.disabled = true;
                    $edit.disabled = true;
                    $act_to.disabled = true;
                }
                if (points > 1) {
                    $edit.disabled = true;
                    $act_from.disabled = true;
                    $act_to.disabled = true;
                    break;
                }
            }
        }
        if (points == 0) {
            $act_from.disabled = true;
            $act_to.disabled = true;
        }

        // check edges
        var edges = 0;
        var acts = network.activities;
        for (var i = 0; i < acts.length; ++i) {
            if (acts[i].selected) {
                ++edges;
                $act_from.disabled = true;
                $act_to.disabled = true;
                if (edges + points > 1) {
                    $edit.disabled = true;
                    break;
                }
            }
        }

        // if nothing selected
        if (edges == 0 && points == 0) {
            $delete.disabled = true;
            $edit.disabled = true;
        }
    
        if ($act_from.disabled) $act_from.active(false);
        if ($act_to.disabled) $act_to.active(false);
    }

    function unselectAll() {
        var evts = network.events;
        for (var i = 0; i < evts.length; ++i)
            evts[i].selected = false;
        var acts = network.activities;
        for (var i = 0; i < acts.length; ++i)
            acts[i].selected = false;
    }

    function checkInPoint(x, y) {
        var evts = network.events;
        for (var i = 0; i < evts.length; ++i) {
            var e = evts[i];
            if (x < e.x - 30 || x > e.x + 30)
                continue;
            if (y < e.y - 30 || y > e.y + 30)
                continue;
            var dx = x - e.x, dy = y - e.y;
            if (dx * dx + dy * dy > 900)
                continue;
            return e;
        }
    }

    function checkInEdge(x, y) {
        var acts = network.activities;
        for (var i = 0; i < acts.length; ++i) {
            var act = acts[i];
            var f_evt = act.from_event,
                t_evt = act.to_event;
            // compute the projection of point
            var x1 = f_evt.x, y1 = f_evt.y;
            var a = t_evt.y - y1,
                b = t_evt.x - x1;
            var a2 = a * a, b2 = b * b, ab = a * b;
            var r = 1 / (a2 + b2);
            var pro_x = (a2 * x1 + b2 * x + ab * (y - y1)) * r,
                pro_y = (b2 * y1 + a2 * y + ab * (x - x1)) * r;
            // check if in section of line
            var left, right, top, bottom;
            if (f_evt.x < t_evt.x) {
                left = f_evt.x;
                right = t_evt.x;
            } else {
                left = t_evt.x;
                right = f_evt.x;
            }
            if (f_evt.y < t_evt.y) {
                top = f_evt.y;
                bottom = t_evt.y;
            } else {
                top = t_evt.y;
                bottom = f_evt.y;
            }
            if (pro_x < left || pro_x > right ||
                    pro_y < top || pro_y > bottom)
                continue;
            // check the distance
            var dx = x - pro_x, dy = y - pro_y;
            if (dx * dx + dy * dy > 16)
                continue;
            return act;
        }
    }

    HTMLElement.prototype.active = function(val) {
        if (val === undefined) {
            return this.classList.contains("active");
        } else if (val === true) {
            this.classList.add("active");
        } else if (val === false) {
            this.classList.remove("active");
        }
    };

    function setEventName(evt, is_new) {
        // TODO
        if (is_new) evt.name = "";
        setTimeout(function() {
            var name = prompt("Please input the name of the event: ");
            if (name === null && is_new) {
                evt.remove();
            } else if (name !== null) {
                evt.name = name;
            }
            Drawing.redraw(network);
        }, 0);
    }

    function setActivityDuration(act, is_new) {
        // TODO
        if (is_new) act.duration = 0;
        setTimeout(function() {
            var duration = prompt("Please input the duration of the activity: ");
            if (duration === null && is_new) {
                act.remove();
            } else if (duration !== null) {
                act.duration = parseInt(duration);
            }
            network.compute();
            Drawing.redraw(network);
        }, 0);
    }

    function getSelectedPoints() {
        var evts = network.events;
        var ret = [];
        for (var i = 0; i < evts.length; ++i) {
            if (evts[i].selected)
                ret.push(evts[i]);
        }
        return ret;
    }

    /* Events of window */

    function window_onresize(evt) {
        $canvas.width = window.innerWidth;
        $canvas.height = window.innerHeight;
        Drawing.redraw(network);
    }

    /* Events of body */

    var moving_point = null;
    var sel_point = null;

    function body_onmousedown(evt) {
        if (evt.target != $canvas)
            return;
        var pos = convertCoordinate(evt.clientX, evt.clientY);
        var x = pos.x, y = pos.y;

        // check point
        var point = checkInPoint(x, y);
        if (point) {
            moving_point = point;
            return;
        }

        // unselect all if not shift
        if (! evt.shiftKey) {
            unselectAll();
            Drawing.redraw(network);
        }

        // display selection
        sel_point = { x: evt.clientX, y: evt.clientY };
        $sel.style.left = x + "px";
        $sel.style.top = y + "px";
        $sel.style.width = "0";
        $sel.style.height = "0";
        $sel.style.display = "block";
    }

    function body_onmousemove(evt) {
        var pos = convertCoordinate(evt.clientX, evt.clientY);
        if (moving_point) {
            moving_point.x = pos.x;
            moving_point.y = pos.y;
            Drawing.redraw(network);
        } else if (sel_point) {
            var dx = evt.clientX - sel_point.x,
                dy = evt.clientY - sel_point.y;
            var left, right, top, bottom;
            if (dx < 0) {
                left = evt.clientX;
                right = sel_point.x;
                $sel.style.left = evt.clientX + "px";
                $sel.style.width = -dx + "px";
            } else {
                left = sel_point.x;
                right = evt.clientX;
                $sel.style.left = sel_point.x + "px";
                $sel.style.width = dx + "px";
            }
            if (dy < 0) {
                top = evt.clientY;
                bottom = sel_point.y;
                $sel.style.top = evt.clientY + "px";
                $sel.style.height = -dy + "px";
            } else {
                top = sel_point.y;
                bottom = evt.clientY;
                $sel.style.top = sel_point.y + "px";
                $sel.style.height = dy + "px";
            }
            // find selecteds
            var left_top = convertCoordinate(left, top);
            left = left_top.x; top = left_top.y;
            var right_bottom = convertCoordinate(right, bottom);
            right = right_bottom.x; bottom = right_bottom.y;
            var evts = network.events;
            for (var i = 0; i < evts.length; ++i) {
                var evt = evts[i];
                evt.selected = (left <= evt.x - 30 && right >= evt.x + 30 &&
                                top <= evt.y - 30 && bottom >= evt.y + 30);
            }
            var acts = network.activities;
            for (var i = 0; i < acts.length; ++i) {
                var act = acts[i];
                var act_left = Math.min(act.from_event.x, act.to_event.x),
                    act_right = Math.max(act.from_event.x, act.to_event.x),
                    act_top = Math.min(act.from_event.y, act.to_event.y),
                    act_bottom = Math.max(act.from_event.y, act.to_event.y);
                act.selected = (left <= act_left && right >= act_right &&
                                top <= act_top && bottom >= act_bottom);
            }
            updateToolbar();
            Drawing.redraw(network);
        }
    }

    function body_onmouseup(evt) {
        moving_point = null;
        $sel.style.display = "none";
        sel_point = null;
    }

    /* Events of canvas */

    function canvas_onclick(evt) {
        var pos = convertCoordinate(evt.clientX, evt.clientY);
        var x = pos.x, y = pos.y;

        // check if adding new event
        var adding_new = false;
        if ($add_new.active()) {
            adding_new = true;
            add_new_onclick.call($add_new);
        }

        // check if select any point
        var selected_point = checkInPoint(x, y);
        if (selected_point) {
            // move the point to most front
            network.events.remove(selected_point);
            network.events.unshift(selected_point);
            if ($act_from.active() || $act_to.active()) {
                // if creating activity
                if (selected_point.selected) {
                    // select itself again
                    selected_point.selected = false;
                    $act_from.active(false);
                    $act_to.active(false);
                } else {
                    // create new activity
                    var last_select = getSelectedPoints()[0];
                    var new_act;
                    if ($act_from.active()) {
                        new_act = new network.Activity(last_select, selected_point, 0);
                        $act_from.active(false);
                    } else {
                        new_act = new network.Activity(selected_point, last_select, 0);
                        $act_to.active(false);
                    }
                    last_select.selected = false;
                    setActivityDuration(new_act, true);
                }
            } else {
                if (evt.shiftKey) {
                    selected_point.selected = ! selected_point.selected;
                } else {
                    unselectAll();
                    selected_point.selected = true;
                }
            }
            updateToolbar();
            Drawing.redraw(network);
            return;
        }

        // check if select any edge
        var selected_edge = checkInEdge(x, y);
        if (selected_edge) {
            // move the edge to most front
            network.activities.remove(selected_edge);
            network.activities.unshift(selected_edge);
            if (evt.shiftKey) {
                selected_edge.selected = ! selected_edge.selected;
            } else {
                unselectAll();
                selected_edge.selected = true;
            }
            updateToolbar();
            Drawing.redraw(network);
            return;
        }

        // add new event
        if (adding_new) {
            var new_evt = new network.Event();
            new_evt.x = x;
            new_evt.y = y;
            setEventName(new_evt, true);
        }
    
        // unselect all events and activities
        if (! evt.shiftKey)
            unselectAll();
        updateToolbar();
        Drawing.redraw(network);
    }

    /* Events of buttons */

    function add_new_onclick(evt) {
        this.active(! this.active());
        $act_from.active(false);
        $act_to.active(false);
    }

    function delete_onclick(evt) {
        // delete activities
        var acts = network.activities;
        for (var i = acts.length - 1; i >= 0; --i) {
            if (acts[i].selected)
                acts[i].remove();
        }
        // delete events
        var evts = network.events;
        for (var i = evts.length - 1; i >= 0; --i) {
            if (evts[i].selected)
                evts[i].remove();
        }
        network.compute();
        updateToolbar();
        Drawing.redraw(network);
    }

    function edit_onclick(evt) {
        var evts = network.events;
        for (var i = 0; i < evts.length; ++i) {
            if (evts[i].selected) {
                setEventName(evts[i]);
                return;
            }
        }
        var acts = network.activities;
        for (var i = 0; i < acts.length; ++i) {
            if (acts[i].selected) {
                setActivityDuration(acts[i]);
                return;
            }
        }
    }

    function act_from_onclick(evt) {
        this.active(! this.active());
        $add_new.active(false);
        $act_to.active(false);
    }

    function act_to_onclick(evt) {
        this.active(! this.active());
        $add_new.active(false);
        $act_from.active(false);
    }

    /* Init */

    // init network object
    var network = new AOENetwork();
    var start_event = network.start_event;
    start_event.x = -window.innerWidth / 4;
    start_event.y = 0;
    start_event.name = "Start";

    // get elements
    var $canvas = $i("canvas");
    var $sel = $i("selection");
    var $add_new = $i("add_new"),
        $delete = $i("delete"),
        $edit = $i("edit"),
        $act_from = $i("act_from"),
        $act_to = $i("act_to");

    // init drawing
    var $canvas = $i("canvas");
    Drawing.init($canvas);
    window_onresize();
    
    /* Bind events */

    // window
    window.onresize = window_onresize;
    // body
    var body = document.body;
    body.onmousedown = body_onmousedown;
    body.onmousemove = body_onmousemove;
    body.onmouseup = body_onmouseup;
    // canvas
    $canvas.onclick = canvas_onclick;
    // buttons
    $add_new.onclick = add_new_onclick;
    $delete.onclick = delete_onclick;
    $edit.onclick = edit_onclick;
    $act_from.onclick = act_from_onclick;
    $act_to.onclick = act_to_onclick;

    /* Final */

    updateToolbar();

})();
