#ifndef PROGS_V6FS_ERR_H
#define PROGS_V6FS_ERR_H

#include <stdio.h>
#include <stdlib.h>
#include <stdarg.h>

static inline void errmsg(const char *filename, char doexit, int excode,
		char adderr, const char *fmt, ...)
{
	fprintf(stderr, "%s: ", filename);
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

#define err(F, E, FMT...)	errmsg(F, 1, E, 1, FMT)
#define errx(F, E, FMT...)	errmsg(F, 1, E, 0, FMT)
#define warn(F, FMT...)		errmsg(F, 0, 0, 1, FMT)
#define warnx(F, FMT...)	errmsg(F, 0, 0, 0, FMT)

#endif /* PROGS_V6FS_ERR_H */
