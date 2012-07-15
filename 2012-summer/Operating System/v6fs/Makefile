LINUX_SRC=/usr/src/linux-$(shell uname -r)
MAKE_MOD=$(MAKE) -C $(LINUX_SRC) SUBDIRS=$(PWD)/module 

all: module progs

.PHONY: module progs clean

module:
	$(MAKE_MOD) modules

progs:
	$(MAKE) -C progs

clean:
	$(MAKE_MOD) clean
	$(MAKE) -C progs clean
