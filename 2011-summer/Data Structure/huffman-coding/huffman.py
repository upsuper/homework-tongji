# - * - coding: UTF-8 - * -

from functools import reduce

def count_chars(s):
    def update_dict(dic, ch):
        if ch not in dic:
            dic[ch] = 0
        dic[ch] += 1
        return dic
    return reduce(update_dict, s, { });

def build_tree(char_counts):
    nodes = [TreeNode(count, char)
            for char, count in char_counts.items()]
    while len(nodes) > 1:
        first_min = min(nodes)
        del nodes[nodes.index(first_min)]
        second_min = min(nodes)
        del nodes[nodes.index(second_min)]
        nodes.append(TreeNode(
            first_min.count + second_min.count,
            left=first_min, right=second_min))

    def set_code(node, code):
        node.code = code
        if node.left:
            set_code(node.left, code + '0')
        if node.right:
            set_code(node.right, code + '1')
    set_code(nodes[0], '')

    return nodes[0]

class TreeNode:
    def __init__(self, count, char=None, left=None, right=None):
        self.count = count
        self.char = char
        self.left = left
        self.right = right

    __lt__ = lambda self, other: self.count < other.count
    __le__ = lambda self, other: self.count <= other.count
    __eq__ = lambda self, other: self.count == other.count
    __ne__ = lambda self, other: self.count != other.count
    __gt__ = lambda self, other: self.count > other.count
    __ge__ = lambda self, other: self.count >= other.count
