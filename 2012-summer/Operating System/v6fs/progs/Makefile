all: mkfs.v6fs

CFLAGS+=-I$(PWD)/include

mkfs.v6fs: mkfs.o
	$(CC) -o $@ $<

mkfs.o: mkfs.c

.PHONY: clean
clean:
	-rm *.o mkfs.v6fs
