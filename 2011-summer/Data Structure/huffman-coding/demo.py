#!/usr/bin/env python3.2
# - * - coding: UTF-8 - * -

import string
import random

from functools import reduce

from tkinter import *
from tkinter import ttk
from tkinter import filedialog
from tkinter.scrolledtext import ScrolledText

import huffman
import drawing

class InputKeyword(Toplevel):

    def __init__(self, master):
        Toplevel.__init__(self, master)
        
        self.transient(master)
        self.title('输入关键值')
        self.resizable(False, False)
        self.master = master
        self.protocol('WM_DELETE_WINDOW', self.cancel)
        self.geometry('+%d+%d' % (master.winfo_rootx() + 50,
                                  master.winfo_rooty() + 50))

        frame = ttk.Frame(self)
        frame.grid(column=0, row=0)
        
        ttk.Label(frame, text='字符：').grid(column=0, row=0)
        ttk.Label(frame, text='数量：').grid(column=0, row=1)
    
        self.char = StringVar()
        char_entry = ttk.Entry(frame, textvariable=self.char)
        char_entry.grid(column=1, row=0)
        char_entry.focus()
        
        self.count = StringVar()
        ttk.Entry(frame, textvariable=self.count).grid(column=1, row=1)
        
        button_frame = ttk.Frame(frame)
        button_frame.grid(column=0, row=2, columnspan=2)

        ok_button = ttk.Button(button_frame, text='确定',
                command=self.ok, default=ACTIVE)
        ok_button.grid(column=0, row=0)
        cancel_button = ttk.Button(button_frame, text='取消',
                command=self.cancel)
        cancel_button.grid(column=1, row=0)

        for child in frame.winfo_children():
            child.grid_configure(padx=5, pady=5)

        self.wait_window(self)

    def ok(self):
        self.result = True
        self.master.focus_set()
        self.destroy()

    def cancel(self):
        self.result = False
        self.master.focus_set()
        self.destroy()

class MainWindow:

    def __init__(self, master):

        self.master = master
        master.title('哈夫曼树')
        master.resizable(True, True)

        mainframe = ttk.Frame(master)
        mainframe.grid(column=0, row=0, sticky=(N, W, E, S))
        mainframe.columnconfigure(0, weight=1)
        mainframe.rowconfigure(0, weight=1)
        
        self.notebook = notebook = ttk.Notebook(mainframe)
        notebook.grid(column=0, row=0, sticky=(N, W, E, S))
        
        frame_text = ttk.Frame(notebook, width=40, height=20)
        frame_text.columnconfigure(0, weight=1)
        frame_text.rowconfigure(0, weight=1)
        notebook.add(frame_text, text="文本")
        
        self.text = text = ScrolledText(frame_text)
        text.grid(column=0, row=0, columnspan=4, sticky=(N, W, E, S))

        read_file = ttk.Button(frame_text, text='从文件中读取',
                command=self.read_file)
        read_file.grid(column=0, row=1, sticky=(W, S))

        random_text = ttk.Button(frame_text, text='随机生成文本',
                command=self.random_text)
        random_text.grid(column=0, row=1, sticky=S)

        to_list = ttk.Button(frame_text, text='获取关键值 >>',
                command=self.get_keywords)
        to_list.grid(column=3, row=1, sticky=(E, S))

        frame_list = ttk.Frame(notebook)
        frame_list.columnconfigure(0, weight=1)
        frame_list.rowconfigure(0, weight=1)
        notebook.add(frame_list, text="关键值")

        tree_frame = ttk.Frame(frame_list)
        tree_frame.columnconfigure(0, weight=1)
        tree_frame.rowconfigure(0, weight=1)
        tree_frame.grid(column=0, row=0, columnspan=4, sticky=(W, E, S, N))

        tree = ttk.Treeview(tree_frame, columns=('hex', 'count'))
        self.tree = tree
        tree.column('hex', anchor='center')
        tree.heading('hex', text='ASCII')
        tree.column('count', anchor='e')
        tree.heading('count', text='数量')
        tree.grid(column=0, row=0, sticky=(W, E, S, N))

        tree_scroll = ttk.Scrollbar(tree_frame, orient=VERTICAL, 
                command=tree.yview)
        tree['yscrollcommand'] = tree_scroll.set
        tree_scroll.grid(column=1, row=0, sticky=(E, S, N))
        
        add_char = ttk.Button(frame_list, text='添加关键值',
                command=self.add_char)
        add_char.grid(column=0, row=1, sticky=(W, S))

        remove_char = ttk.Button(frame_list, text='删除关键值',
                command=self.remove_char)
        remove_char.grid(column=0, row=1, sticky=S)

        to_result = ttk.Button(frame_list, text='生成哈夫曼树 >>',
                command=self.get_result)
        to_result.grid(column=3, row=1, sticky=(E, S))

        frame_result = ttk.Frame(notebook)
        frame_result.columnconfigure(1, weight=1)
        frame_result.rowconfigure(0, weight=1)
        notebook.add(frame_result, text="结果")

        list_frame = ttk.Frame(frame_result)
        list_frame.columnconfigure(0, weight=1)
        list_frame.rowconfigure(0, weight=1)
        list_frame.grid(column=0, row=0, sticky=(W, S, N))
        
        char_list = Listbox(list_frame, width=15, font='TkFixedFont')
        self.char_list = char_list
        char_list.grid(column=0, row=0, sticky=(W, S, N))

        list_scroll = ttk.Scrollbar(list_frame, orient=VERTICAL,
                command=char_list.yview)
        char_list['yscrollcommand'] = list_scroll.set
        list_scroll.grid(column=1, row=0, sticky=(E, S, N))

        canvas_frame = ttk.Frame(frame_result)
        canvas_frame.columnconfigure(0, weight=1)
        canvas_frame.rowconfigure(0, weight=1)
        canvas_frame.grid(column=1, row=0, sticky=(W, E, S, N))

        canvas = Canvas(canvas_frame, scrollregion=(0, 0, 500, 500))
        self.canvas = canvas
        canvas.grid(column=0, row=0, sticky=(W, E, S, N))
        
        canvas_hscroll = ttk.Scrollbar(canvas_frame, orient=HORIZONTAL)
        canvas_vscroll = ttk.Scrollbar(canvas_frame, orient=VERTICAL)
        canvas_hscroll['command'] = canvas.xview
        canvas_vscroll['command'] = canvas.yview
        canvas['xscrollcommand'] = canvas_hscroll.set
        canvas['yscrollcommand'] = canvas_vscroll.set
        canvas_hscroll.grid(column=0, row=1, sticky=(S, W, E))
        canvas_vscroll.grid(column=1, row=0, sticky=(E, S, N))

        for child in frame_text.winfo_children() + \
                     frame_list.winfo_children() + \
                     frame_result.winfo_children():
            child.grid_configure(padx=5, pady=5)

        text.focus()

    def read_file(self):
        filename = filedialog.askopenfilename()
        if filename:
            self.text.delete('1.0', 'end')
            self.text.insert('1.0', open(filename, 'r').read())

    def random_text(self):
        self.text.insert('end', ''.join([
            random.choice(string.printable) for i in range(100)]))

    def get_keywords(self):
        children = self.tree.get_children()
        if children:
            self.tree.delete(*children)
        counts = huffman.count_chars(self.text.get('1.0', 'end-1char'))
        for char, count in counts.items():
            self.tree.insert('', 'end', char, text=char,
                    values=[hex(ord(char)), count])
        self.notebook.select(1)

    def add_char(self):
        dialog = InputKeyword(self.master)
        if dialog.result:
            char = dialog.char.get()[0]
            count = int(dialog.count.get())
            if char and count > 0:
                try:
                    item = self.tree.item(char)
                except TclError:
                    self.tree.insert('', 'end', char, text=char,
                            values=[hex(ord(char)), count])
                else:
                    self.tree.set(char, 'count',
                            int(self.tree.set(char, 'count')) + count)
                self.tree.selection_set(char)
                self.tree.focus(char)

    def remove_char(self):
        items = self.tree.selection()
        if items:
            self.tree.delete(*items)

    def get_result(self):
        count = {
                char: int(self.tree.set(char, 'count'))
                for char in self.tree.get_children()
                }
        self.canvas.delete(*self.canvas.find_all())
        tree = huffman.build_tree(count)
        pos = drawing.get_position(tree)
        left_bound = reduce(lambda x, y: min(x, y[0]), pos, 0)
        right_bound = reduce(lambda x, y: max(x, y[1]), pos, 0)
        width = right_bound - left_bound + drawing.NODE_SPACE
        height = len(pos) * drawing.NODE_VSPAN + drawing.NODE_VSPACE
        self.canvas.configure({ 'scrollregion': (0, 0, width, height) })
        drawing.draw(self.canvas, tree, (-left_bound, 0), '', True)

        code_len = max(15, len(pos) + 1)
        self.char_list.delete(0, self.char_list.size() - 1)
        def add_list_item(node):
            if node.left and node.right:
                add_list_item(node.left)
                add_list_item(node.right)
            else:
                self.char_list.insert(END,
                        node.code.ljust(code_len) + node.char)
        add_list_item(tree)
        self.char_list['width'] = code_len + 2
        self.notebook.select(2)

root = Tk()
app = MainWindow(root)
root.grid_columnconfigure(0, weight=1)
root.grid_rowconfigure(0, weight=1)
root.mainloop()
