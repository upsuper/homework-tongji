#include <pthread.h>
#include "op.h"
#include "rw.h"

static int reader_count = 0;
static int writer_count = 0;
static pthread_mutex_t reader_count_mutex = PTHREAD_MUTEX_INITIALIZER;
static pthread_mutex_t new_reader_mutex = PTHREAD_MUTEX_INITIALIZER;
static pthread_mutex_t writer_count_mutex = PTHREAD_MUTEX_INITIALIZER;
static pthread_mutex_t writer_mutex = PTHREAD_MUTEX_INITIALIZER;

void writer_pri_reader(int num, int duration) {
    pthread_mutex_lock(&new_reader_mutex);
    pthread_mutex_lock(&reader_count_mutex);
    ++reader_count;
    if (reader_count == 1)
        pthread_mutex_lock(&writer_mutex);
    pthread_mutex_unlock(&reader_count_mutex);
    pthread_mutex_unlock(&new_reader_mutex);

    doread(num, duration);

    pthread_mutex_lock(&reader_count_mutex);
    --reader_count;
    if (reader_count == 0)
        pthread_mutex_unlock(&writer_mutex);
    pthread_mutex_unlock(&reader_count_mutex);
}

void writer_pri_writer(int num, int duration) {
    pthread_mutex_lock(&writer_count_mutex);
    ++writer_count;
    if (writer_count == 1)
        pthread_mutex_lock(&new_reader_mutex);
    pthread_mutex_unlock(&writer_count_mutex);

    pthread_mutex_lock(&writer_mutex);
    dowrite(num, duration);
    pthread_mutex_unlock(&writer_mutex);

    pthread_mutex_lock(&writer_count_mutex);
    --writer_count;
    if (writer_count == 0)
        pthread_mutex_unlock(&new_reader_mutex);
    pthread_mutex_unlock(&writer_count_mutex);
}
