#!/usr/bin/env python
# - * - coding: UTF-8 - * -

import re
import sys

from collections import defaultdict

regx_rule = re.compile(r'([A-Z])->(.+)')
regx_space = re.compile(r'\s+')
regx_twonont = re.compile(r'[A-Z]{2,}')

def remove_white(s):
    return regx_space.sub('', s)

def parse_grammar(f):
    """从输入的流中读入，并输出对应的语法规则。
    若输入不是一个算符文法的语法规则，则返回 False。

    程序忽略所有空白字符，其他每个字符为一个符号，
    假设大写字母为非终结符，其他字符为终结符。

    除了输入的规则外，程序会自动添加一条 S->#F# 的语法规则，
    其中的“F”为第一条规则的左部符号。
    因此要求读入的语法规则必须不含有非终结符“S”以及终结符“#”。
    """

    result = defaultdict(set)
    first_left = ''

    # 读取语法规则
    for line in f:
        line = remove_white(line)
        m = regx_rule.match(line)
        if not m:
            break
        # 获取左部和右部
        left = m.group(1)
        if not first_left:
            first_left = left
        right = m.group(2)
        # 判断是否为算符文法
        if regx_twonont.search(right):
            return False
        # 切割右部并将右部添加到结果集
        right = right.split('|')
        result[left] |= set(right)

    # 添加辅助语法规则
    result['S'] = {'#{0}#'.format(first_left)}

    return [(l, p) for l, r in result.items() for p in r]

def compute_firstvt(g):
    """输入一个算符文法的语法规则，输出所有非终结符的 FIRSTVT 集合"""

    result = defaultdict(set)

    # 第一轮添加由文法规则本身得到的集合
    for left, right in g:
        new_set = result[left]
        if len(right) >= 1 and not right[0].isupper():
            new_set.add(right[0])
        elif len(right) >= 2:
            new_set.add(right[1])
    
    # 迭代添加其他集合
    updated = True
    while updated:
        updated = False
        for left, right in g:
            new_set = set(result[left])
            if len(right) >= 1 and right[0].isupper():
                new_set |= result[right[0]]
            if len(new_set) > len(result[left]):
                result[left] = new_set
                updated = True

    return dict(result)

def compute_lastvt(g):
    """输入一个算符文法的语法规则，输出所有非终结符的 LASTVT 集合"""

    result = defaultdict(set)

    # 第一轮添加由文法规则本身得到的集合
    for left, right in g:
        new_set = result[left]
        if len(right) >= 1 and not right[-1].isupper():
            new_set.add(right[-1])
        elif len(right) >= 2:
            new_set.add(right[-2])
    
    # 迭代添加其他集合
    updated = True
    while updated:
        updated = False
        for left, right in g:
            new_set = set(result[left])
            if len(right) >= 1 and right[-1].isupper():
                new_set |= result[right[-1]]
            if len(new_set) > len(result[left]):
                result[left] = new_set
                updated = True

    return dict(result)

def compute_prior(grammar, firstvt, lastvt):
    """输入算符文法的语法规则、非终结符的 FIRSTVT 和 LASTVT 集合，
    输出该算符文法的优先表。
    如果输入的文法不是一个算符优先文法，返回 False。
    """

    vn = {c for left, right in grammar
            for c in right
            if not c.isupper()}
    result = {k: {k: ' ' for k in vn} for k in vn}
    
    # 根据语法规则计算“=”关系
    for left, right in grammar:
        for i in range(len(right) - 1):
            if right[i].isupper():
                pass
            elif not right[i + 1].isupper():
                result[right[i]][right[i + 1]] = '='
            elif i + 2 < len(right):
                result[right[i]][right[i + 2]] = '='
    
    # 根据 FIRSTVT 计算“<”关系
    for left, right in grammar:
        for i in range(len(right) - 1):
            if right[i].isupper() or not right[i + 1].isupper():
                continue
            a = right[i]
            for b in firstvt[right[i + 1]]:
                if result[a][b] != '<' and result[a][b] != ' ':
                    return False
                result[a][b] = '<'
    
    # 根据 LASTVT 计算“>”关系
    for left, right in grammar:
        for i in range(len(right) - 1):
            if not right[i].isupper():
                continue
            b = right[i + 1]
            for a in lastvt[right[i]]:
                if result[a][b] != '>' and result[a][b] != ' ':
                    return False
                result[a][b] = '>'
    
    return result

def parse_sentence(grammar, prior_table, sentence):
    """根据语法规则、优先表解析判断给定输入串是否为句子。
    如果分析成功，返回 True 及分析过程；
    如果分析失败，返回 False 及已经分析成功的部分。
    """

    def update_states(states, new_states):
        for state, seq in new_states.items():
            if state not in states:
                pass
            elif len(seq) < len(states[state]):
                pass
            else:
                continue
            states[state] = seq

    def reduce_single(grammar, states):
        found_states = list(states.keys())
        for state in found_states:
            lastnt = state[-1]
            for left, right in grammar:
                if right != lastnt:
                    continue
                new_state = state[:-1] + left
                if new_state in found_states:
                    continue
                states[new_state] = states[state] + \
                        [(state, '{0}->{1}'.format(left, right))]
                found_states.append(new_state)

    def reduce_(grammar, states, c):
        new_states = {}

        for state, seq in states.items():
            add_to_new = False

            if len(state) < 1:
                add_to_new = True
            elif not state[-1].isupper():
                if state[-1] not in prior_table:
                    return {}
                if prior_table[state[-1]][c] in ['<', '=']:
                    add_to_new = True
            elif len(state) < 2:
                add_to_new = True
            elif state[-2] not in prior_table:
                return {}
            elif prior_table[state[-2]][c] in ['<', '=']:
                add_to_new = True
            
            # 如果不需要归约直接添加
            if add_to_new:
                update_states(new_states, {
                    state + c: seq + [(state, None)]})
                continue

            # 进行归约
            for left, right in grammar:
                if not state.endswith(right):
                    continue
                states_to_reduce = {
                        state[:-len(right)] + left:
                            seq + [(state, '{0}->{1}'.format(left, right))]
                        }
                reduce_single(grammar, states_to_reduce)
                update_states(new_states,
                        reduce_(grammar, states_to_reduce, c))

        return new_states

    states = {'': []}
    sentence = '#{0}#'.format(sentence)
    for i, c in enumerate(sentence):
        states = reduce_(grammar, states, c)
        if not states:
            return False, sentence[:i]

    # 寻找最短归约路径
    result = None
    for seq in states.values():
        if not result or len(seq) < len(result):
            result = seq

    return True, result

def main():
    if len(sys.argv) > 1:
        f = open(sys.argv[1], 'r')
    else:
        f = sys.stdin

    # 解析语法
    grammar = parse_grammar(f)
    if not grammar:
        print('不是一个算符文法')
        return
    vn = list({left for left, right in grammar})
    vt = list({c for left, right in grammar
                 for c in right
                 if not c.isupper()})

    # 计算 FIRSTVT 并输出
    firstvt = compute_firstvt(grammar)
    for left in vn:
        print('FIRSTVT({0})={{{1}}}'.format(left, 
            ', '.join("'{0}'".format(c) for c in firstvt[left])))

    # 计算 LASTVT 并输出
    lastvt = compute_lastvt(grammar)
    for left in vn:
        print('LASTVT({0})={{{1}}}'.format(left, 
            ', '.join("'{0}'".format(c) for c in lastvt[left])))
    
    # 计算优先表并输出
    prior_table = compute_prior(grammar, firstvt, lastvt)
    if not prior_table:
        print('不是一个算符优先文法')
        return
    print('')
    print('优先表：')
    print('    ' + '  '.join(vt))
    for c in vt:
        print(' {0}  '.format(c) +
                '  '.join(prior_table[c][c2] for c2 in vt))
    print('')

    # 使用文法规则解析输入串
    for line in f:
        line = remove_white(line)
        result, steps = parse_sentence(grammar, prior_table, line)
        if not result:
            print(line + ' 不是一个句子')
        else:
            print(line + ' 是一个句子')
            left = '#{0}#'.format(line)
            width = len(left)
            count = len(steps)
            step_width = len(str(count)) + 1
            format_string = '{{0:>{0}}}  {{1}}    {{2}}{{3}}  {{4}}'.format(step_width)
            for i, (_, act), (cur, _) in zip(range(count), steps, steps[1:]):
                if not act:
                    left = left[1:]
                    act = '进'
                else:
                    act = '归 ' + act
                print(format_string.format(
                    i, cur, ' ' * (width - len(cur) - len(left)), left, act))
        print('')
    
if __name__ == '__main__':
    main()
