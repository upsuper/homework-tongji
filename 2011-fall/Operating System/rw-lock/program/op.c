#include <stdio.h>
#include <unistd.h>
#include "op.h"

void doread(int num, int duration) {
    printf("[%d] Start reading...\n", num);
    usleep(duration);
    printf("[%d] Read end\n", num);
}

void dowrite(int num, int duration) {
    printf("[%d] Start writing...\n", num);
    usleep(duration);
    printf("[%d] Write end\n", num);
}
