#ifndef _H_OS_L04PR_RW
#define _H_OS_L04PR_RW

typedef void (*Oper)(int num, int duration);
typedef Oper Reader;
typedef Oper Writer;

typedef struct {
    const char *name;
    Reader r;
    Writer w;
} RW;

void reader_pri_reader(int num, int duration);
void reader_pri_writer(int num, int duration);
void writer_pri_reader(int num, int duration);
void writer_pri_writer(int num, int duration);
void justice_reader(int num, int duration);
void justice_writer(int num, int duration);

#endif // _H_OS_L04PR_RW
