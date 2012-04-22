# - * - coding: UTF-8 - * -

import iothread
import threading

reader_count = 0
reader_mutex = threading.Lock()
writer_mutex = threading.Lock()

class ReaderThread(iothread.ReaderThread):
    def do(self):
        global reader_count
        
        reader_mutex.acquire()
        reader_count += 1
        if reader_count == 1:
            writer_mutex.acquire()
        reader_mutex.release()
    
        self.doread()
    
        reader_mutex.acquire()
        reader_count -= 1
        if reader_count == 0:
            writer_mutex.release()
        reader_mutex.release()

class WriterThread(iothread.WriterThread):
    def do(self):
        writer_mutex.acquire()
        self.dowrite()
        writer_mutex.release()
