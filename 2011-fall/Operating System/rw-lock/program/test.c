#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <pthread.h>
#include "rw.h"

#define TIME_SCALE 10000

typedef struct _Item {
    int num;
    enum { READER, WRITER } type;
    useconds_t delay, duration;
    Oper func;
    struct _Item *next;
} Item;

typedef struct _Thread {
    pthread_t id;
    struct _Thread *next;
} Thread;

Item *items = NULL;

RW methods[] = {
    { "reader_pri", reader_pri_reader, reader_pri_writer },
    { "writer_pri", writer_pri_reader, writer_pri_writer },
    { "justice", justice_reader, justice_writer },
    { NULL, NULL, NULL }
};

void *start_thread(void *arg) {
    Item *item = (Item *) arg;
    // printf("[%d] Thread created\n", item->num);
    usleep(item->delay);
    // printf("[%d] Start waiting...\n", item->num);
    item->func(item->num, item->duration);
    // printf("[%d] Thread destory\n", item->num);
}

int main() {
    int num, delay, duration;
    char t[2];

    // read data
    while (1) {
        scanf("%d %s %d %d", &num, t, &delay, &duration);
        if (feof(stdin))
            break;
        Item *item;
        item = (Item *) malloc(sizeof(Item));
        item->num = num;
        item->type = t[0] == 'R' ? READER : WRITER;
        item->delay = delay * TIME_SCALE;
        item->duration = duration * TIME_SCALE;
        item->next = items;
        items = item;
    }

    // do test
    int i;
    for (i = 0; methods[i].name != NULL; ++i) {
        printf("START %s\n", methods[i].name);
        Item *item;
        Thread *threads = NULL;
        for (item = items; item != NULL; item = item->next) {
            item->func = item->type == READER ? methods[i].r : methods[i].w;
            pthread_t id;
            if (pthread_create(&id, NULL, start_thread, item)) {
                fprintf(stderr, "[%d] Thread creating error!\n", item->num);
                abort();
            }
            Thread *thread = (Thread *) malloc(sizeof(Thread));
            thread->id = id;
            thread->next = threads;
            threads = thread;
        }
        Thread *thread;
        for (thread = threads; thread != NULL; thread = threads) {
            if (pthread_join(thread->id, NULL)) {
                fprintf(stderr, "Thread joining error!\n");
                abort();
            }
            threads = thread->next;
            free(thread);
        }
        printf("END %s\n\n", methods[i].name);
    }

    // clean
    Item *item;
    for (item = items; item != NULL; item = items) {
        items = item->next;
        free(item);
    }

    return 0;
}
