function AOENetwork() {
    var network = this;
    this.events = [];
    this.activities = [];

    this.Event = function() {
        this.earliest = -Infinity;
        this.latest = Infinity;
        this.input = [];
        this.output = [];
        network.events.push(this);
    };
    this.Event.prototype.remove = function() {
        for (var i = this.input.length - 1; i >= 0; --i) {
            this.input[i].remove();
            this.input[i] = undefined;
        }
        for (var i = this.output.length - 1; i >= 0; --i) {
            this.output[i].remove();
            this.output = undefined;
        }
        network.events.remove(this);
    };

    this.Activity = function(from_event, to_event, duration) {
        this.from_event = from_event;
        this.to_event = to_event;
        this.duration = duration;
        from_event.output.push(this);
        to_event.input.push(this);
        network.activities.push(this);
        if (to_event == network.start_event) {
            this.remove();
            throw "Cannot create activity to start event";
        }
        // check if the new activity make graph cyclic
        if (checkCyclic()) {
            this.remove();
            throw "AOE Network cannot be cyclic.";
        }
    };
    this.Activity.prototype.remove = function() {
        this.from_event.output.remove(this);
        this.from_event = undefined;
        this.to_event.input.remove(this);
        this.to_event = undefined;
        network.activities.remove(this);
    };

    function checkCyclic(cur_event) {
        if (cur_event === undefined) {
            var ret = checkCyclic(start_event);
            for (var i = 0; i < network.events.length; ++i) {
                delete network.events[i]._visited;
                delete network.events[i]._onpath;
            }
            return ret;
        }
        if (cur_event._onpath) return true;
        if (cur_event._visited) return false;
        cur_event._visited = true;
        cur_event._onpath = true;
        for (var i = 0; i < cur_event.output.length; ++i) {
            if (checkCyclic(cur_event.output[i].to_event))
                return true;
        }
        cur_event._onpath = false;
        return false;
    }

    var start_event = new this.Event();
    start_event.earliest = 0;
    start_event.latest = 0;
    start_event.is_key = true;
    this.start_event = start_event;
}

AOENetwork.prototype.compute = function() {
    var end_activities = [];
    var events_queue;

    // reset all events
    for (var i = 0; i < this.events.length; ++i) {
        var cur_event = this.events[i];
        cur_event.earliest = -Infinity;
        cur_event.latest = Infinity;
        cur_event._count = 0;
    }
    this.start_event.earliest = 0;

    // create an end event
    var end_event = new this.Event();
    // prevent the end event to be add into the queue
    end_event._count = -1;

    // figure out earliest time of events
    events_queue = [this.start_event];
    for (var i = 0; i < events_queue.length; ++i) {
        var cur_event = events_queue[i];
        cur_event._visited = true;
        var cur_earliest = cur_event.earliest;
        var output = cur_event.output;
        // if no output, connect it with end event
        if (output.length == 0)
            new this.Activity(cur_event, end_event, 0);
        // update all post-event
        for (var j = 0; j < output.length; ++j) {
            var to_event = output[j].to_event;
            // update the earliest time of end event of the activity
            var new_earliest = cur_earliest + output[j].duration;
            if (new_earliest > to_event.earliest)
                to_event.earliest = new_earliest;
            // complete computing one pre-event
            to_event._count += 1;
            // if all pre-event complete, add the event to the queue
            if (to_event._count == to_event.input.length)
                events_queue.push(to_event);
        }
        // reset the count for next roll
        cur_event._count = 0;
    }
    // earliest end time of the network
    this.earliest = end_event.earliest;

    // figure out latest time of events
    events_queue = [end_event];
    end_event.latest = end_event.earliest;
    for (var i = 0; i < events_queue.length; ++i) {
        var cur_event = events_queue[i];
        var cur_latest = cur_event.latest;
        // update all pre-event
        var input = cur_event.input;
        for (var j = 0; j < input.length; ++j) {
            var from_event = input[j].from_event;
            // update the latest time of start event of the activity
            var new_latest = cur_latest - input[j].duration;
            if (new_latest < from_event.latest)
                from_event.latest = new_latest;
            // complete computing one post-event
            from_event._count += 1;
            // if all post-event complete, add the event to the queue
            if (from_event._count == from_event.output.length)
                events_queue.push(from_event);
        }
    }

    // find out key events
    for (var i = 0; i < this.events.length; ++i) {
        var cur_event = this.events[i];
        cur_event.is_key = (cur_event.earliest == cur_event.latest);
    }
    // find out key activities
    for (var i = 0; i < this.activities.length; ++i) {
        var cur_activity = this.activities[i];
        cur_activity.is_key = (cur_activity.from_event.is_key &&
                               cur_activity.to_event.is_key &&
                               cur_activity.to_event.earliest ==
                               cur_activity.from_event.earliest +
                               cur_activity.duration);
    }

    // clean up temporary objects
    for (var i = 0; i < this.events.length; ++i) {
        delete this.events[i]._count;
        delete this.events[i]._visited;
    }
    end_event.remove();
};
