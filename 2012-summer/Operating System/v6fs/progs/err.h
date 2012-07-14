#ifndef PROGS_V6FS_ERR_H
#define PROGS_V6FS_ERR_H

#include <stdio.h>
#include <stdlib.h>
#include <stdarg.h>

static inline void errmsg(char doexit, int excode, char adderr,
		const char *fmt, ...)
{
	fprintf(stderr, "%s: ", __FILE__);
	if (fmt != NULL) {
		va_list argp;
		va_start(argp, fmt);
		vfprintf(stderr, fmt, argp);
		va_end(argp);
		if (adderr)
			fprintf(stderr, ": ");
	}
	if (adderr)
		fprintf(stderr, "%m");
	fprintf(stderr, "\n");
	if (doexit)
		exit(excode);
}

#define err(E, FMT...)	errmsg(1, E, 1, FMT)
#define errx(E, FMT...)	errmsg(1, E, 0, FMT)
#define warn(FMT...)	errmsg(0, 0, 1, FMT)
#define warnx(FMT...)	errmsg(0, 0, 0, FMT)

#endif /* PROGS_V6FS_ERR_H */
