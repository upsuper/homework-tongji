#include <pthread.h>
#include "op.h"
#include "rw.h"

static int reader_count = 0;
static pthread_mutex_t reader_mutex = PTHREAD_MUTEX_INITIALIZER;
static pthread_mutex_t writer_mutex = PTHREAD_MUTEX_INITIALIZER;

void reader_pri_reader(int num, int duration) {
    pthread_mutex_lock(&reader_mutex);
    ++reader_count;
    if (reader_count == 1)
        pthread_mutex_lock(&writer_mutex);
    pthread_mutex_unlock(&reader_mutex);

    doread(num, duration);

    pthread_mutex_lock(&reader_mutex);
    --reader_count;
    if (reader_count == 0)
        pthread_mutex_unlock(&writer_mutex);
    pthread_mutex_unlock(&reader_mutex);
}

void reader_pri_writer(int num, int duration) {
    pthread_mutex_lock(&writer_mutex);
    dowrite(num, duration);
    pthread_mutex_unlock(&writer_mutex);
}
