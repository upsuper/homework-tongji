# - * - coding: UTF-8 - * -

from functools import reduce
from itertools import zip_longest as lzip

NODE_WIDTH = 35
NODE_HEIGHT = 22
NODE_SPACE = 10
NODE_VSPACE = 50

NODE_VSPAN = NODE_HEIGHT + NODE_VSPACE
HALF_NODE_HEIGHT = NODE_HEIGHT / 2.0
HALF_NODE_WIDTH = NODE_WIDTH / 2.0

def get_position(node):
    ret = [(-HALF_NODE_WIDTH, HALF_NODE_WIDTH)]
    if node.char:
        return ret
    left = get_position(node.left)
    right = get_position(node.right)
    width = reduce(lambda w, lr:
                    max(w, lr[0][1] -lr[1][0] + NODE_SPACE),
                    zip(left, right), 0)
    half = width / 2.0
    node.left.offset = -half
    node.right.offset = half
    for l, r in lzip(left, right):
        if l is None:
            ret.append((r[0] + half, r[1] + half))
        elif r is None:
            ret.append((l[0] - half, l[1] - half))
        else:
            ret.append((l[0] - half, r[1] + half))
    return ret

def get_height(pos):
    height = (len(pos) + 1) * NODE_VSPAN + NODE_VSPACE
    return height

def draw(canvas, node, orig, text, root=False):
    if root:
        x = orig[0] + NODE_SPACE / 2.0
        y = NODE_VSPACE / 2.0
    else:
        x = orig[0] + node.offset
        y = orig[1] + NODE_VSPAN
        canvas.create_line(orig[0], orig[1], x, y)
        if text == '0':
            offset = -5
        else:
            offset = 5
        canvas.create_text((orig[0] + x) / 2.0 + offset,
                           (orig[1] + y) / 2.0, text=text)
    if node.left:
        draw(canvas, node.left, (x, y), '0')
    if node.right:
        draw(canvas, node.right, (x, y), '1')
    canvas.create_oval(x - HALF_NODE_WIDTH, y - HALF_NODE_HEIGHT,
                       x + HALF_NODE_WIDTH, y + HALF_NODE_HEIGHT,
                       fill='white', outline='black')
    canvas.create_text(x, y, text=node.count)
    if node.char:
        canvas.create_text(x, y + NODE_HEIGHT, text=node.char)
