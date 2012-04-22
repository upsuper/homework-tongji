(function() {

    /* Basic dom */

    function $i(id) {
        return document.getElementById(id);
    }

    /* Consts */

    var TOP_POS = 50;
    var NODE_WIDTH = 44,
        NODE_HEIGHT = 22,
        NODE_RADIUS = 3,
        NODE_SPACE = 10,
        NODE_MOVE_DURATION = 500,
        NODE_VSPACE = 50,
        NODE_DEL_DURATION = 300;
    var BOX_RADIUS = 11,
        BOX_LINE_POS = 5;
        BOX_MOVE_DURATION = 500,
        BOX_MOVE_DELAY = 200,
        BOX_DEL_DURATION = 300;
    var BOX_FILL_INSERT = "#0f0",
        BOX_COLOR_INSERT = "#000",
        BOX_FILL_DELETE = "#f00",
        BOX_COLOR_DELETE = "#fff",
        BOX_FILL_SEARCH = "#00f",
        BOX_COLOR_SEARCH = "#fff",
        BOX_FILL_MOVE = "#0ff",
        BOX_COLOR_MOVE = "#000";
    var FONT_SIZE = 14;
    var RANDOM_INSERT = .95,
        RANDOM_SEARCH = .05,
        RANDOM_DELETE = 0;

    var HALF_NODE_WIDTH = NODE_WIDTH / 2,
        QUAR_NODE_WIDTH = NODE_WIDTH / 4,
        HALF_NODE_HEIGHT = NODE_HEIGHT / 2,
        NODE_SPAN = NODE_WIDTH + NODE_SPACE;
    var RANDOM_SUM = RANDOM_INSERT + RANDOM_SEARCH + RANDOM_DELETE;

    /* Global variables */

    var paper;
    var width;
    var root;
    var levels = [],
        level_pos = [];
    var locking = false;
    var auto_mode = 0,
        in_tree = { };

    /* Elements */

    function Node(x, y, level) {
        this.border = paper.rect(x - NODE_WIDTH / 2,
                                 y - NODE_HEIGHT / 2,
                                 NODE_WIDTH,
                                 NODE_HEIGHT,
                                 NODE_RADIUS);
        this.x = x;
        this.y = y;
        this.level = level;
        this.val1 = this.text1 =
        this.val2 = this.text2 =
        this.sub0 = this.line0 =
        this.sub1 = this.line1 =
        this.sub2 = this.line2 = 
        this.par = this.line_p = null;
    }

    Node.prototype.createBoxFrom = function(pos) {
        var box;
        if (pos == 1) {
            box = new Box(this.x - QUAR_NODE_WIDTH, this.y,
                          this.val1, this.text1,
                          BOX_FILL_MOVE, BOX_COLOR_MOVE);
            this.val1 = this.text1 = null;
        } else {
            box = new Box(this.x + QUAR_NODE_WIDTH, this.y,
                          this.val2, this.text2,
                          BOX_FILL_MOVE, BOX_COLOR_MOVE);
            this.val2 = this.text2 = null;
        }
        return box;
    };

    Node.prototype.getLinePos = function(pos) {
        switch (pos) {
            case 0:
                return {
                    x1: this.x - HALF_NODE_WIDTH,
                    y1: this.y + HALF_NODE_HEIGHT
                };
            case 1:
                return {
                    x1: this.x,
                    y1: this.y + HALF_NODE_HEIGHT
                };
            case 2:
                return {
                    x1: this.x + HALF_NODE_WIDTH,
                    y1: this.y + HALF_NODE_HEIGHT
                };
            case "p":
                return {
                    x2: this.x,
                    y2: this.y - HALF_NODE_HEIGHT
                };
        }
    };

    Node.prototype.moveTo = function(x, y, func) {
        var t = this.border;
        this.x = x;
        this.y = y;
        t.animate({
            x: x - HALF_NODE_WIDTH,
            y: y - HALF_NODE_HEIGHT
        }, NODE_MOVE_DURATION, ">", func);
        if (this.text1) {
            this.text1.animateWith(t, {
                x: x - QUAR_NODE_WIDTH, y: y
            }, NODE_MOVE_DURATION, ">");
        }
        if (this.text2) {
            this.text2.animateWith(t, {
                x: x + QUAR_NODE_WIDTH, y: y
            }, NODE_MOVE_DURATION, ">");
        }
        if (this.line0) {
            this.line0.animateWith(t, this.getLinePos(0),
                                   NODE_MOVE_DURATION, ">");
        }
        if (this.line1) {
            this.line1.animateWith(t, this.getLinePos(1),
                                   NODE_MOVE_DURATION, ">");
        }
        if (this.line2) {
            this.line2.animateWith(t, this.getLinePos(2),
                                   NODE_MOVE_DURATION, ">");
        }
        if (this.line_p) {
            this.line_p.animateWith(t, this.getLinePos("p"),
                                    NODE_MOVE_DURATION, ">");
        }
    };

    Node.prototype.moveInner = function(from, func) {
        var ret;
        if (from == 1) {
            ret = {
                text: this.text2,
                val: this.val2,
                line: this.line2,
                sub: this.sub2
            };

            this.val2 = this.val1;
            this.text2 = this.text1;
            this.sub2 = this.sub1;
            this.line2 = this.line1;
            this.sub1 = this.sub0;
            this.line1 = this.line0;

            this.val1 = this.text1 =
            this.sub0 = this.line0 = null;
            var t = this.text2;

            t.animate({
                x: this.x + QUAR_NODE_WIDTH, y: this.y
            }, NODE_MOVE_DURATION, ">", func);
            if (this.line1) {
                this.line1.animateWith(t, this.getLinePos(1),
                                       NODE_MOVE_DURATION, ">");
            }
            if (this.line2) {
                this.line2.animateWith(t, this.getLinePos(2),
                                       NODE_MOVE_DURATION, ">");
            }
        } else {
            ret = {
                text: this.text1,
                val: this.val1,
                line: this.line0,
                sub: this.sub0
            };

            this.val1 = this.val2;
            this.text1 = this.text2;
            this.sub0 = this.sub1;
            this.line0 = this.line1;
            this.sub1 = this.sub2;
            this.line1 = this.line2;
            
            this.val2 = this.text2 =
            this.sub2 = this.line2 = null;
            var t = this.text1;

            t.animate({
                x: this.x - QUAR_NODE_WIDTH, y: this.y
            }, NODE_MOVE_DURATION, ">", func);
            if (this.line0) {
                this.line0.animateWith(t, this.getLinePos(0),
                                       NODE_MOVE_DURATION, ">");
            }
            if (this.line1) {
                this.line1.animateWith(t, this.getLinePos(1),
                                       NODE_MOVE_DURATION, ">");
            }
        }
        return ret;
    };

    Node.prototype.remove = function(func) {
        levels[this.level].remove(this);
        var t = this.border;
        var level = this.level;
        t.animate({ "stroke-opacity": 0 }, NODE_DEL_DURATION, ">",
                  function() {
                      t.remove();
                      arrangeGraph(level, func);
                  });
        var line0 = this.line0;
        if (line0) {
            line0.animateWith(t, { "stroke-opacity": 0 },
                              NODE_DEL_DURATION, ">", function() {
                                  line0.remove();
                              });
        }
        var line1 = this.line1;
        if (line1) {
            line1.animateWith(t, { "stroke-opacity": 0 },
                              NODE_DEL_DURATION, ">", function() {
                                  line1.remove();
                              });
        }
        var line2 = this.line2;
        if (line2) {
            line2.animateWith(t, { "stroke-opacity": 0 },
                              NODE_DEL_DURATION, ">", function() {
                                  line2.remove();
                              });
        }
        var line_p = this.line_p;
        if (line_p) {
            line_p.animateWith(t, { "stroke-opacity": 0 },
                               NODE_DEL_DURATION, ">", function() {
                                   line_p.remove();
                               });
        }
    };

    function Box(x, y, value, text, fill, color) {
        this.fill = paper.circle(x, y, BOX_RADIUS);
        this.fill.attr({
            stroke: "transparent", fill: fill
        });
        this.x = x;
        this.y = y;
        if (! text) {
            text = paper.text(x, y, value);
            text.attr({ "font-size": FONT_SIZE });
        } else {
            text.insertAfter(this.fill);
        }
        text.attr({ fill: color });
        this.val = value;
        this.text = text;
        this.sub0 = this.line0 =
        this.sub1 = this.line1 = null;
    }

    Box.prototype.applyTo = function(node, pos) {
        if (pos == 1) {
            node.val1 = this.val;
            node.text1 = this.text;
            if (this.line0) {
                node.sub0 = this.sub0;
                node.line0 = this.line0;
                if (node.sub0)
                    node.sub0.par = node;
            }
            if (this.line1) {
                node.sub1 = this.sub1;
                node.line1 = this.line1;
                if (node.sub1)
                    node.sub1.par = node;
            }
        } else {
            node.val2 = this.val;
            node.text2 = this.text;
            if (this.line0) {
                node.sub1 = this.sub0;
                node.line1 = this.line0;
                if (node.sub1)
                    node.sub1.par = node;
            }
            if (this.line1) {
                node.sub2 = this.sub1;
                node.line2 = this.line1;
                if (node.sub2)
                    node.sub2.par = node;
            }
        }
    };

    Box.prototype.clean = function() {
        this.val = this.text = 
        this.sub0 = this.line0 = 
        this.sub1 = this.line1 = null;
        return this;
    };

    Box.prototype.getLinePos = function(pos) {
        switch (pos) {
            case 0:
                return {
                    x1: this.x - BOX_LINE_POS,
                    y1: this.y + BOX_RADIUS
                };
            case 1:
                return {
                    x1: this.x + BOX_LINE_POS,
                    y1: this.y + BOX_RADIUS
                };
        }
    };

    Box.prototype.moveTo = function(x, y, func) {
        var t = this.fill;
        this.x = x;
        this.y = y;
        t.animate({ cx: x, cy: y },
                  BOX_MOVE_DURATION, ">", function() {
                      setTimeout(func, BOX_MOVE_DELAY);
                  });
        if (this.text) {
            this.text.animateWith(t, { x: x, y: y },
                                  BOX_MOVE_DURATION, ">");
        }
        if (this.line0) {
            this.line0.animateWith(t, this.getLinePos(0),
                                   BOX_MOVE_DURATION, ">");
        }
        if (this.line1) {
            this.line1.animateWith(t, this.getLinePos(1),
                                   BOX_MOVE_DURATION, ">");
        }
    };

    Box.prototype.moveToNode = function(node, pos, func) {
        if (pos == 0) {
            this.moveTo(node.x, node.y - HALF_NODE_HEIGHT, func);
        } else if (pos == -1) {
            this.moveTo(node.x, node.y + HALF_NODE_HEIGHT, func);
        } else if (pos == 1) {
            this.moveTo(node.x - QUAR_NODE_WIDTH, node.y, func);
        } else if (pos == 2) {
            this.moveTo(node.x + QUAR_NODE_WIDTH, node.y, func);
        }
    };

    Box.prototype.remove = function(func) {
        var t = this.fill;
        t.animate({ "fill-opacity": 0 }, BOX_DEL_DURATION, ">",
                function() {
                    t.remove();
                    if (func) func();
                });
        var text = this.text;
        if (text) {
            text.animateWith(t, { "fill-opacity": 0, },
                             BOX_DEL_DURATION, ">",
                             function() { text.remove(); });
        }
        this.text = 
        this.sub0 = this.line0 = 
        this.sub1 = this.line1 = null;
    };
    
    /* Graph arrange */

    function arrangeGraph(level, func) {
        var tl = levels[level];
        var vpos = level_pos[level];
        if (level == 0) {
            var sum_width = tl.length * NODE_SPAN - NODE_SPACE;
            var pos = (width - sum_width) / 2 + HALF_NODE_WIDTH;
            for (var i = 0; i < tl.length; ++i, pos += NODE_SPAN) {
                if (tl[i].x != pos || tl[i].y != vpos)
                    tl[i].moveTo(pos, vpos);
            }
        } else {
            for (var i = 0; i < tl.length; ++i) {
                var t = tl[i];
                var pos = (
                    (t.line2 ? t.sub2 : t.sub1).x + t.sub0.x) / 2;
                if (t.x != pos || t.y != vpos)
                    t.moveTo(pos, vpos);
            }
        }
        if (func)
            setTimeout(func, NODE_MOVE_DURATION);
    }

    function arrangeAll(same_time) {
        function arrangeNext(level) {
            arrangeGraph(level, function() {
                ++level;
                if (levels[level])
                    arrangeNext(level);
            });
        }
        if (same_time) {
            for (var i = 0; i < levels.length; ++i)
                arrangeGraph(i);
        } else {
            arrangeNext(0);
        }
    }

    /* B-tree operations */

    function insertIntoNode(node, box, func) {
        function cleanBoxAndReturn() {
            if (node.line0) {
                node.line0.animate(node.getLinePos(0),
                                   BOX_DEL_DURATION, ">");
            }
            if (node.line1) {
                node.line1.animate(node.getLinePos(1),
                                   BOX_DEL_DURATION, ">");
            }
            if (node.line2) {
                node.line2.animate(node.getLinePos(2),
                                   BOX_DEL_DURATION, ">");
            }
            box.val = box.text =
            box.sub0 = box.line0 =
            box.sub1 = box.line1 = null;
            box.remove(func);
        }
        if (! node.text1) {
            box.applyTo(node, 1);
            // this will only happen on the first leaf
            // so we don't need to maintain the lines
            box.moveToNode(node, 1, function() {
                box.clean().remove(func);
            });
        } else if (! node.text2) {
            if (box.val < node.val1) {
                node.moveInner(1);
                box.applyTo(node, 1);
                box.moveToNode(node, 1, cleanBoxAndReturn);
            } else {
                box.applyTo(node, 2);
                box.moveToNode(node, 2, cleanBoxAndReturn);
            }
        } else {
            // need to split node
            var node2 = new Node(node.x, node.y, node.level);
            var box_val, box_text;

            if (box.val < node.val2) {
                node2.val1 = node.val2;
                node2.text1 = node.text2;
                if (box.val < node.val1) {
                    box_val = node.val1;
                    box_text = node.text1;

                    node2.sub0 = node.sub1;
                    node2.line0 = node.line1;
                    if (node2.sub0)
                        node2.sub0.par = node2;

                    node2.sub1 = node.sub2;
                    node2.line1 = node.line2;
                    if (node2.sub1)
                        node2.sub1.par = node2;

                    box.applyTo(node, 1);
                } else {
                    box_val = box.val;
                    box_text = box.text;
                       
                    node2.sub0 = box.sub1;
                    node2.line0 = box.line1;
                    if (node2.sub0)
                        node2.sub0.par = node2;
    
                    node2.sub1 = node.sub2;
                    node2.line1 = node.line2;
                    if (node2.sub1)
                        node2.sub1.par = node2;
    
                    node.sub1 = box.sub0;
                    node.line1 = box.line0;
                    if (node.sub1)
                        node.sub1.par = node;
                }
            } else {
                box.applyTo(node2, 1);
                box_val = node.val2;
                box_text = node.text2;
            }
            node.val2 = node.text2 = 
            node.sub2 = node.line2 = null;
            box.clean().remove();
            
            var box2 = new Box(node.x, node.y, box_val, box_text,
                               BOX_FILL_MOVE, BOX_COLOR_MOVE);
            var par = node.par;
            node.par = node2.par = box2;
            box2.sub0 = node;
            box2.line0 = node.line_p;
            box2.sub1 = node2;
            var box2_line1 = box2.getLinePos(1),
                node2_line_p = node2.getLinePos("p");
            box2.line1 = paper.line(box2_line1.x1, box2_line1.y1,
                                    node2_line_p.x2, node2_line_p.y2);
            node2.line_p = box2.line1;

            levels[node.level].insertAfter(node2, node);
            node.moveTo(node.x - NODE_SPAN / 2, node.y);
            node2.moveTo(node.x + NODE_SPAN / 2, node.y);
    
            if (par) {
                arrangeGraph(node.level);
                box2.moveToNode(par, -1, function() {
                    insertIntoNode(par, box2, func);
                });
            } else {
                // new root!
                var new_root = new Node(box2.x, box2.y, node.level + 1);
                level_pos.unshift(level_pos[0] + NODE_VSPACE);
                levels.push([new_root]);

                var box2_line0 = box2.getLinePos(0),
                    node_line_p = node.getLinePos("p");
                box2.line0 = paper.line(box2_line0.x1, box2_line0.y1,
                                        node_line_p.x2, node_line_p.y2);
                node.line_p = box2.line0;
                box2.applyTo(new_root, 1);
                root = new_root;
                arrangeAll(true);

                box2.moveToNode(new_root, 1, function() {
                    box2.val = box2.text = null;
                    box2.remove();
                    root.moveTo(root.x, root.y);
                });
                func();
            }
        }
    }

    function insertVal(node, box, func) {
        function removeBoxAndReturn() {
            box.remove(func);
        }

        if (box.val == node.val1) {
            box.moveToNode(node, 1, removeBoxAndReturn);
        } else if (box.val == node.val2) {
            box.moveToNode(node, 2, removeBoxAndReturn);
        } else if (! node.level) {
            // must be leaf
            insertIntoNode(node, box, func);
        } else {
            if (box.val < node.val1) {
                box.moveToNode(node.sub0, 0, function() {
                    insertVal(node.sub0, box, func);
                });
            } else if (node.text2 && box.val > node.val2) {
                box.moveToNode(node.sub2, 0, function() {
                    insertVal(node.sub2, box, func);
                });
            } else {
                box.moveToNode(node.sub1, 0, function() {
                    insertVal(node.sub1, box, func);
                });
            }
        }
    }

    function searchVal(node, box, func) {
        function returnFound() {
            func(true, function() {
                box.remove();
            });
        }
        if (box.val == node.val1) {
            box.moveToNode(node, 1, returnFound);
        } else if (box.val == node.val2) {
            box.moveToNode(node, 2, returnFound);
        } else if (node.level) {
            if (box.val < node.val1) {
                box.moveToNode(node.sub0, 0, function() {
                    searchVal(node.sub0, box, func);
                });
            } else if (node.text2 && box.val > node.val2) {
                box.moveToNode(node.sub2, 0, function() {
                    searchVal(node.sub2, box, func);
                });
            } else {
                box.moveToNode(node.sub1, 0, function() {
                    searchVal(node.sub1, box, func);
                });
            }
        } else {
            box.moveToNode(node, -1, function() {
                box.remove();
                func(false);
            });
        }
    }

    function maintainNode(node, pos, func) {
        if (pos == 2) {
            if (! node.line1) {
                node.sub1 = node.sub2;
                node.line1 = node.line2;
                node.sub2 = node.line2 = null;
            }
            func();
        } else {
            if (node.text2) {
                if (! node.line1) {
                    node.sub1 = node.sub0;
                    node.line1 = node.line0;
                }
                node.moveInner(2, func);
            } else if (! node.par) {
                if (! node.level) {
                    func();
                } else {
                    var sub = node.sub0;
                    sub.par = sub.line_p = null;
                    root = sub;
                    node.remove(function() {
                        level_pos.shift();
                        levels.pop();
                        arrangeAll(true);
                        setTimeout(func, NODE_MOVE_DURATION);
                    });
                }
            } else {
                var par = node.par;
                var box, box2;
                if (par.text2) {
                    if (node == par.sub2) {
                        box = par.createBoxFrom(2);
                        box.sub1 = node.sub0;
                        box.line1 = node.line0;
                        node.sub0 = node.line0 = null;
                        var sub1 = par.sub1;
                        var vfunc;
                        if (sub1.text2) {
                            box2 = sub1.createBoxFrom(2);
                            box.sub0 = sub1.sub2;
                            box.line0 = sub1.line2;
                            sub1.sub2 = sub1.line2 = null;
                            vfunc = func;
                        } else {
                            box2 = sub1.createBoxFrom(1);
                            box.sub0 = sub1.sub1;
                            box.line0 = sub1.line1;
                            sub1.sub1 = sub1.line1 = null;
                            vfunc = function() {
                                maintainNode(sub1, 1, func);
                            };
                        }
                        box.applyTo(node, 1);
                        box.moveToNode(node, 1, function() {
                            box.clean().remove();
                        });
                        box2.applyTo(par, 2);
                        box2.moveToNode(par, 2, function() {
                            box2.clean().remove(vfunc);
                        });
                    } else if (node == par.sub0) {
                        box = par.createBoxFrom(1);
                        var sub1 = par.sub1;
                        var vfunc;
                        box2 = sub1.createBoxFrom(1);
                        box.sub1 = sub1.sub0;
                        box.line1 = sub1.line0;
                        if (sub1.text2) {
                            sub1.sub0 = sub1.line0 = null;
                            sub1.moveInner(2);
                            vfunc = func;
                        } else {
                            sub1.sub0 = sub1.sub1;
                            sub1.line0 = sub1.line1;
                            sub1.sub1 = sub1.line1 = null;
                            vfunc = function() {
                                maintainNode(sub1, 1, func);
                            };
                        }
                        box.applyTo(node, 1);
                        box.moveToNode(node, 1, function() {
                            box.clean().remove();
                        });
                        box2.applyTo(par, 1);
                        box2.moveToNode(par, 1, function() {
                            box2.clean().remove(vfunc);
                        });
                    } else {
                        var sub0 = par.sub0,
                            sub2 = par.sub2;
                        var box, box2;
                        if (sub2.text2) {
                            box = par.createBoxFrom(2);
                            box2 = sub2.createBoxFrom(1);
                            box.sub1 = sub2.sub0;
                            box.line1 = sub2.line0;
                            sub2.sub0 = sub2.line0 = null;

                            sub2.moveInner(2);
                            box.applyTo(node, 1);
                            box.moveToNode(node, 1, function() {
                                box.clean().remove();
                            });
                            box2.applyTo(par, 2);
                            box2.moveToNode(par, 2, function() {
                                box2.clean().remove(func);
                            });
                        } else if (sub0.text2) {
                            box = par.createBoxFrom(1);
                            box2 = sub0.createBoxFrom(2);
                            box.sub0 = sub0.sub2;
                            box.line0 = sub0.line2;
                            sub0.sub2 = sub0.line2 = null;
                            box.sub1 = node.sub0;
                            box.line1 = node.line0;
                            node.sub0 = node.line0 = null;
                            
                            box.applyTo(node, 1);
                            box.moveToNode(node, 1, function() {
                                box.clean().remove();
                            });
                            box2.applyTo(par, 1);
                            box2.moveToNode(par, 1, function() {
                                box2.clean().remove(func);
                            });
                        } else {
                            box = par.createBoxFrom(2);
                            box.sub0 = node.sub0;
                            box.line0 = node.line0;
                            node.sub0 = node.line0 = node.par = null;
                            par.sub1 = par.sub2;
                            par.line1 = par.line2;
                            par.sub2 = par.line2 = null;

                            par.moveTo(par.x, par.y);
                            sub2.moveInner(1);
                            box.applyTo(sub2, 1);
                            box.moveToNode(sub2, 1, function() {
                                box.clean().remove(function() {
                                    node.remove(func);
                                });
                            });
                        }
                    }
                } else {
                    var sub
                    if (node == par.sub1) {
                        sub = par.sub0;
                        if (sub.text2) {
                            box = par.createBoxFrom(1);
                            box2 = sub.createBoxFrom(2);
                            box.sub0 = sub.sub2;
                            box.line0 = sub.line2;
                            sub.sub2 = sub.line2 = null;
                            box.sub1 = node.sub0;
                            box.line1 = node.line0;
                            
                            box.applyTo(node, 1);
                            box.moveToNode(node, 1, function() {
                                box.clean().remove();
                            });
                            box2.applyTo(par, 1);
                            box2.moveToNode(par, 1, function() {
                                box2.clean().remove(func);
                            });
                        } else {
                            box = par.createBoxFrom(1);
                            box.sub1 = node.sub0;
                            box.line1 = node.line0;
                            node.sub0 = node.line0 = null;
                            
                            box.applyTo(sub, 2);
                            box.moveToNode(sub, 2, function() {
                                box.clean().remove(function() {
                                    node.remove(function() {
                                        maintainNode(par, 1, func);
                                    });
                                });
                            });
                        }
                    } else {
                        sub = par.sub1;
                        if (sub.text2) {
                            box = par.createBoxFrom(1);
                            box2 = sub.createBoxFrom(1);
                            box.sub1 = sub.sub0;
                            box.line1 = sub.line0;
                            sub.sub0 = sub.line0 = null;
                            
                            sub.moveInner(2);
                            box.applyTo(node, 1);
                            box.moveToNode(node, 1, function() {
                                box.clean().remove();
                            });
                            box2.applyTo(par, 1);
                            box2.moveToNode(par, 1, function() {
                                box2.clean().remove(func);
                            });
                        } else {
                            box = par.createBoxFrom(1);
                            box.sub0 = node.sub0;
                            box.line0 = node.line0;
                            node.sub0 = node.line0 = null;
                            par.sub0 = par.sub1;
                            par.line0 = par.line1;
                            par.sub1 = par.line1 = null;
                            
                            sub.moveInner(1);
                            box.applyTo(sub, 1);
                            box.moveToNode(sub, 1, function() {
                                box.clean().remove(function() {
                                    node.remove(function() {
                                        maintainNode(par, 1, func);
                                    });
                                });
                            });
                        }
                    }
                }
            }
        }
    }

    function deleteVal(node, box, func) {
        function getSuccessor(node) {
            for (; node.level; node = node.sub0);
            return node;
        }
        if (box.val == node.val1) {
            box.moveToNode(node, 1, function() {
                node.text1.remove();
                node.val1 = node.text1 = null;
                if (node.level) {
                    var suc = getSuccessor(node.sub1);
                    var box2 = suc.createBoxFrom(1);
                    box2.moveToNode(node, 1, function() {
                        box2.applyTo(node, 1);
                        box2.clean().remove();
                    });
                    box.moveToNode(suc, 1, function() {
                        box.remove();
                        maintainNode(suc, 1, func);
                    });
                } else {
                    box.remove();
                    maintainNode(node, 1, func);
                }
            });
        } else if (box.val == node.val2) {
            box.moveToNode(node, 2, function() {
                node.text2.remove();
                node.val2 = node.text2 = null;
                if (node.level) {
                    var suc = getSuccessor(node.sub2);
                    var box2 = suc.createBoxFrom(1);
                    box2.moveToNode(node, 2, function() {
                        box2.applyTo(node, 2);
                        box2.clean().remove();
                    });
                    box.moveToNode(suc, 1, function() {
                        box.remove();
                        maintainNode(suc, 1, func);
                    });
                } else {
                    box.remove();
                    maintainNode(node, 2, func);
                }
            });
        } else if (node.level) {
            if (box.val < node.val1) {
                box.moveToNode(node.sub0, 0, function() {
                    deleteVal(node.sub0, box, func);
                });
            } else if (node.line2 && box.val > node.val2) {
                box.moveToNode(node.sub2, 0, function() {
                    deleteVal(node.sub2, box, func);
                });
            } else {
                box.moveToNode(node.sub1, 0, function() {
                    deleteVal(node.sub1, box, func);
                });
            }
        } else {
            box.moveToNode(node, -1, function() {
                box.remove();
                func();
            });
        }
    }

    /* Handlers of events */

    function window_onresize() {
        if (width != window.innerWidth) {
            width = window.innerWidth;
            if (levels.length)
                arrangeAll();
        }
        paper.setSize(width, window.innerHeight - 47);
    }

    function auto_onclick() {
        if (auto_mode) {
            clearInterval(auto_mode);
            auto_mode = 0;
            this.innerHTML = "Auto";
        } else {
            auto_mode = setInterval(function() {
                if (! locking) {
                    random_onclick();
                    var v = parseInt($v.value);
                    if (in_tree[v]) {
                        delete_onclick();
                    } else {
                        insert_onclick();
                    }
                }
            }, 500);
            this.innerHTML = "Stop";
        }
    }

    function random_onclick() {
        $v.value = Math.round(Math.random() * 100);
    }

    function insert_onclick() {
        if (locking) return;
        locking = true;
        var v = parseInt($v.value);
        in_tree[v] = true;
        var box = new Box(width / 2, -BOX_RADIUS, v, null,
                          BOX_FILL_INSERT, BOX_COLOR_INSERT);
        box.moveToNode(root, 0, function() {
            insertVal(root, box, function() {
                arrangeAll();
                locking = false;
            });
        });
    }

    function search_onclick() {
        if (locking) return;
        locking = true;
        var v = parseInt($v.value);
        var box = new Box(width / 2, -BOX_RADIUS, v, null,
                          BOX_FILL_SEARCH, BOX_COLOR_SEARCH);
        box.moveToNode(root, 0, function() {
            searchVal(root, box, function(result, func) {
                alert(result ? "found" : "not found");
                if (func) func();
                locking = false;
            });
        });
    }

    function delete_onclick() {
        if (locking) return;
        locking = true;
        var v = parseInt($v.value);
        delete in_tree[v];
        var box = new Box(width / 2, -BOX_RADIUS, v, null,
                          BOX_FILL_DELETE, BOX_COLOR_DELETE);
        box.moveToNode(root, 0, function() {
            deleteVal(root, box, function() {
                arrangeAll();
                locking = false;
            });
        });
    }

    // init canvas
    width = 100;
    paper = Raphael("canvas", width, 100);
    window_onresize();

    // init btree
    root = new Node(width / 2, TOP_POS, 0);
    levels.push([root]);
    level_pos.push(TOP_POS);
    
    // bind handlers
    var $v = $i("value");
    window.onresize = window_onresize;
    $i("auto").onclick = auto_onclick;
    $i("random").onclick = random_onclick;
    $i("insert").onclick = insert_onclick;
    $i("search").onclick = search_onclick;
    $i("delete").onclick = delete_onclick;
    
})();
