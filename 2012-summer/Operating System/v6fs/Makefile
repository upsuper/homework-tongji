KDIR=/lib/modules/$(shell uname -r)/build
MAKE_MOD=$(MAKE) -C $(KDIR) M=$(PWD)/module 

all: module progs

.PHONY: module progs clean

module:
	$(MAKE_MOD) modules

progs:
	$(MAKE) -C progs

clean:
	$(MAKE_MOD) clean
	$(MAKE) -C progs clean
