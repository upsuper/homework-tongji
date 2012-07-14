#ifndef PROGS_V6FS_WRITEALL_H
#define PROGS_V6FS_WRITEALL_H

#include <unistd.h>
#include <errno.h>

static inline int write_all(int fd, const void *buf, size_t count)
{
	while (count) {
		ssize_t tmp;

		errno = 0;
		tmp = write(fd, buf, count);
		if (tmp > 0) {
			count -= tmp;
			buf += tmp;
		} else {
			switch (errno) {
			case EAGAIN:
				usleep(100000);
			case EINTR:
				break;
			default:
				return -1;
			}
		}
	}
	return 0;
}

#endif /* PROGS_V6FS_WRITEALL_H */
