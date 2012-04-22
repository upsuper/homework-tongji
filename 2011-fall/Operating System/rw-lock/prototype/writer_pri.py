# - * - coding: UTF-8 - * -

import iothread
import threading

reader_count = 0
writer_count = 0
reader_count_mutex = threading.Lock()
new_reader_mutex = threading.Lock()
writer_count_mutex = threading.Lock()
writer_mutex = threading.Lock()

class ReaderThread(iothread.ReaderThread):
    def do(self):
        global reader_count

        new_reader_mutex.acquire()
        reader_count_mutex.acquire()
        reader_count += 1
        if reader_count == 1:
            writer_mutex.acquire()
        reader_count_mutex.release()
        new_reader_mutex.release()
    
        self.doread()
    
        reader_count_mutex.acquire()
        reader_count -= 1
        if reader_count == 0:
            writer_mutex.release()
        reader_count_mutex.release()

class WriterThread(iothread.WriterThread):
    def do(self):
        global writer_count
        
        writer_count_mutex.acquire()
        writer_count += 1
        if writer_count == 1:
            new_reader_mutex.acquire()
        writer_count_mutex.release()

        writer_mutex.acquire()
        self.dowrite()
        writer_mutex.release()

        writer_count_mutex.acquire()
        writer_count -= 1
        if writer_count == 0:
            new_reader_mutex.release()
        writer_count_mutex.release()
