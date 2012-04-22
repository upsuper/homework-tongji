#!/usr/bin/python
# - * - coding: UTF-8 - * -

import sys

def test_it(mod_name, data):
    print '[%s] Test start: ' % (mod_name, )
    mod = __import__(mod_name)
    threads = []
    for num, rw, delay, duration in data:
        if rw == 'R':
            thread = mod.ReaderThread(num, delay, duration)
        elif rw == 'W':
            thread = mod.WriterThread(num, delay, duration)
        threads.append(thread)
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()
    print '[%s] Test end' % (mod_name, )
    print
    
data = []
for line in sys.stdin:
    line = line.split()
    data.append((int(line[0]), line[1], int(line[2]), int(line[3])))

test_it('reader_pri', data)
test_it('writer_pri', data)
test_it('justice', data)
