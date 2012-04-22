# - * - coding: UTF-8 - * -

import sys
import time
import threading

TIME_SCALE = 0.2

def log(text):
    sys.stderr.write(text + '\n')

class IOThread(threading.Thread):
    def __init__(self, num, delay, duration):
        threading.Thread.__init__(self)
        self.num = num
        self.delay = delay * TIME_SCALE
        self.duration = duration * TIME_SCALE

    def run(self):
        time.sleep(self.delay)
        self.do()

class ReaderThread(IOThread):
    def doread(self):
        log('[%d] Start reading...' % (self.num, ))
        time.sleep(self.duration)
        log('[%d] Read end' % (self.num, ))

class WriterThread(IOThread):
    def dowrite(self):
        log('[%d] Start writing...' % (self.num, ))
        time.sleep(self.duration)
        log('[%d] Write end' % (self.num, ))
