#!/usr/bin/env python
# - * - coding: UTF-8 - * -

CLASS_ATTR = 'status'
COUNT_ATTR = 'count'

from math import log
from pprint import pprint
from collections import defaultdict

log2 = lambda x: log(x, 2)

def select_attr(data, attrs):
    max_ig = 0.0
    result = ''
    for attr in attrs:
        value_count = defaultdict(int)
        for item in data:
            value_count[item[attr]] += item[COUNT_ATTR]
        count_sum = sum(value_count.values())
        info_gain = 0.0
        for v in value_count.values():
            p = float(v) / count_sum
            info_gain += p * log2(p)
        info_gain = -info_gain

        if info_gain > max_ig:
            max_ig = info_gain
            result = attr

    return result

def generate_tree(data, attrs):
    class_ = data[0][CLASS_ATTR]
    for item in data:
        if item[CLASS_ATTR] != class_:
            break
    else:
        return class_
    
    if not attrs:
        vote = defaultdict(int)
        for item in data:
            vote[item[CLASS_ATTR]] += item[COUNT_ATTR]
        max_vote = 0
        for k, v in vote.items():
            if v > max_vote:
                max_vote = v
                class_ = k
        return class_

    criterion = select_attr(data, attrs)
    new_datas = defaultdict(list)
    for item in data:
        new_datas[item[criterion]].append(item)

    new_attrs = [a for a in attrs if a != criterion]
    splitting = {}
    for v, new_data in new_datas.items():
        splitting[v] = generate_tree(new_data, new_attrs)
    return criterion, splitting

def classify(tree, item):
    if isinstance(tree, str):
        return tree
    attr, subtree = tree
    if item[attr] not in subtree:
        return None
    return classify(subtree[item[attr]], item)

def read_data(f):
    f = open(f, 'r')
    attrs = f.readline().split()
    data = []
    for line in f:
        values = line.split()
        data.append({k: v for k, v in zip(attrs, values)})
    return attrs, data

if __name__ == '__main__':
    attrs, data = read_data('data.txt')

    for item in data:
        item[COUNT_ATTR] = int(item[COUNT_ATTR])
    attrs.remove(CLASS_ATTR)
    attrs.remove(COUNT_ATTR)

    tree = generate_tree(data, attrs)
    print 'Decision Tree: '
    pprint(tree)

    print
    print 'Input items to classify:'
    print '\t'.join(attrs)
    while True:
        try:
            line = raw_input()
        except EOFError:
            break
        item = line.split()
        if len(item) != len(attrs):
            print '\t'.join(attrs)
            continue
        item = dict(zip(attrs, item))
        class_ = classify(tree, item)
        print CLASS_ATTR + ':', class_
