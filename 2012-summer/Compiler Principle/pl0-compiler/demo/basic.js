function $(q, elem) {
    return elem && elem.querySelector ?
        elem.querySelector(q) : document.querySelector(q);
}
function $all(q, elem) {
    return elem && elem.querySelectorAll ?
        elem.querySelectorAll(q) : document.querySelectorAll(q);
}
function $c(tag) {
    return document.createElement(tag);
}

String.prototype.toHTML = function () {
    return this.replace(/&/g, '&amp;')
               .replace(/</g, '&lt;')
               .replace(/>/g, '&gt;')
               .replace(/"/g, '&quot;')
               .replace(/\n/g, '<br>')
               .replace(/\t/g, '    ')
               .replace(/ /g, '&nbsp;');
};

if (NodeList !== $all('html').constructor)
    NodeList = $all('html').constructor;
NodeList.prototype.toArray = function () {
    return Array.prototype.slice.call(this);
};
NodeList.prototype.forEach = function (func) {
    this.toArray().forEach(func, this);
};
