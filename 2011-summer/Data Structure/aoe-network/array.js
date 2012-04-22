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
