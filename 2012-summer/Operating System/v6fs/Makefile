LINUX_SRC=/usr/src/linux-$(shell uname -r)
MAKE_MOD=$(MAKE) -C $(LINUX_SRC) SUBDIRS=$(PWD)/module 

all: v6fs.ko

v6fs.ko:
	$(MAKE_MOD) modules
	cp module/v6fs.ko ./

.PHONY: clean
clean:
	rm v6fs.ko
	$(MAKE_MOD) clean
