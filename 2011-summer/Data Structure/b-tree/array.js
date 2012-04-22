Array.prototype.remove = function(obj) {
    for (var i = 0, j = 0; j < this.length; ++i, ++j) {
        if (this[j] === obj)
            ++j;
        if (i != j) {
            this[i] = this[j];
            this[j] = undefined;
        }
    }
    while (this.length > 0 && this[this.length - 1] === undefined)
        this.pop();
};

Array.prototype.insertAfter = function(elem, after) {
    var tmp_array = [];
    while (this.length) {
        var next = this.pop();
        if (next !== after) {
            tmp_array.push(next);
        } else {
            this.push(next);
            break;
        }
    }
    this.push(elem);
    while (tmp_array.length) {
        this.push(tmp_array.pop());
    }
};
