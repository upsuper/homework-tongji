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

if (module !== undefined) {
    exports.MySet = MySet;
}
