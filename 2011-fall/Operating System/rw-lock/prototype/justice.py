# - * - coding: UTF-8 - * -

import iothread
import threading

reader_count = 0
reader_count_mutex = threading.Lock()
new_operate_mutex = threading.Lock()
writer_mutex = threading.Lock()

class ReaderThread(iothread.ReaderThread):
    def do(self):
        global reader_count

        new_operate_mutex.acquire()
        reader_count_mutex.acquire()
        reader_count += 1
        if reader_count == 1:
            writer_mutex.acquire()
        reader_count_mutex.release()
        new_operate_mutex.release()

        self.doread()

        reader_count_mutex.acquire()
        reader_count -= 1
        if reader_count == 0:
            writer_mutex.release()
        reader_count_mutex.release()

class WriterThread(iothread.WriterThread):
    def do(self):
        new_operate_mutex.acquire()

        writer_mutex.acquire()
        self.dowrite()
        writer_mutex.release()

        new_operate_mutex.release()
