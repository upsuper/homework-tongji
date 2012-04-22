LDFLAGS=-lpthread

TEST_MODS=reader_pri.o writer_pri.o justice.o

all: test

test: test.o op.o $(TEST_MODS)

test.o: test.c rw.h
op.o: op.c op.h

$(TEST_MODS): %.o: %.c op.h rw.h

.PHONY: clean
clean:
	-rm *.o test
