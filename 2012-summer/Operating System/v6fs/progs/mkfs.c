#include <unistd.h>
#include <mntent.h>
#include <err.h>
#include <fcntl.h>
#include <sys/ioctl.h>
#include <sys/stat.h>
#include <string.h>
#include <time.h>

#include <v6fs/v6fs.h>

#include "err.h"
#include "writeall.h"

#ifndef _PATH_MOUNTED
# define _PATH_MOUNTED		"/etc/mtab"
#endif

#ifndef _PATH_MNTTAB
# define _PATH_MNTTAB		"/etc/fstab"
#endif

#define _PATH_MOUNTED_LOCK	_PATH_MOUNTED "~"
#define _PATH_MOUNTED_TMP	_PATH_MOUNTED ".tmp"

#ifndef _PATH_DEV
# define _PATH_DEV		"/dev/"
#endif

#define BLKGETSIZE	_IO(0x12, 96)

#define MKFS_USAGE	1
#define MKFS_ERROR	2

#define VERBOSE(FMT...)	warnx(FMT)

static char * program_name = "mkfs.v6fs";

static int verbose = 0;
static unsigned long inode_blocks = 0;
static unsigned long inodes;
static unsigned long blocks = 0;
static char * device_name = NULL;

static struct stat statbuf;
static int is_blk = 0;
static int dev = -1;

static char block[V6FS_BLOCK_SIZE];
static block_t linked_blocks = 0;

static void __attribute__((__noreturn__)) usage(void)
{
	fprintf(stderr, "Usage: %s "
			"[-i inode-blocks] [-v] "
			"device [blocks]\n", program_name);
	exit(MKFS_USAGE);
}

/* parse */

static void parse_arg(int argc, char *argv[])
{
	int i;
	char * p;

	if (argc && *argv)
		program_name = *argv;
	if ((p = strrchr(program_name, '/')) != NULL)
		program_name = p + 1;

	while ((i = getopt(argc, argv, "i:vh")) != -1) {
		switch (i) {
		case 'i':
			inode_blocks = strtol(optarg, &p, 0);
			if (*p)
				errx(MKFS_ERROR,
					"inode-blocks must be an integer");
			break;
		case 'v':
			verbose = 1;
			break;
		case 'h':
		default:
			usage();
		}
	}
	argc -= optind;
	argv += optind;
	if (argc > 0) {
		device_name = argv[0];
		argc--;
		argv++;
	}
	if (argc > 0) {
		blocks = strtol(argv[0], &p, 0);
		if (*p)
			errx(MKFS_ERROR, "blocks must be an integer");
	}
}

/* check */

static void check_params_before(void)
{
	if (verbose)
		VERBOSE("checking device_name...");
	if (!device_name)
		usage();
}

static void check_params_after(void)
{
	unsigned long normal_blocks = blocks - inode_blocks - 2;

	if (verbose)
		VERBOSE("checking blocks number...");
	if (normal_blocks <= 100)
		errx(MKFS_ERROR, "normal blocks must be not less than 100");
	if (normal_blocks / inode_blocks < V6FS_INODE_PER_BLOCK)
		errx(MKFS_ERROR, "too many inode blocks");
}

static void check_mount(void)
{
	FILE * f;
	struct mntent * mnt;

	if (verbose)
		VERBOSE("checking whether device has been mounted...");
	if ((f = setmntent(_PATH_MOUNTED, "r")) == NULL)
		return;
	while ((mnt = getmntent(f)) != NULL)
		if (strcmp(device_name, mnt->mnt_fsname) == 0)
			break;
	endmntent(f);
	if (!mnt)
		return;
	err(MKFS_ERROR, "%s is mounted; "
			"will not make a filesystem here!", device_name);
}

/* operate */

static void stat_dev(void)
{
	if (verbose)
		VERBOSE("stating device...");
	if (stat(device_name, &statbuf) < 0)
		err(MKFS_ERROR, "%s: stat failed", device_name);
	is_blk = S_ISBLK(statbuf.st_mode);
}

static void open_dev(void)
{
	int tmp;

	if (verbose)
		VERBOSE("opening device...");
	if (is_blk)
		dev = open(device_name, O_RDWR | O_EXCL);
	else
		dev = open(device_name, O_RDWR);
	if (dev < 0)
		err(MKFS_ERROR, "%s: open failed", device_name);

	if (!blocks) {
		if (verbose)
			VERBOSE("reading block number...");
		if (is_blk) {
			tmp = ioctl(dev, BLKGETSIZE, &blocks);
			if (tmp < 0)
				err(MKFS_ERROR, "cannot determine size of %s",
						device_name);
			blocks = blocks * 512 / V6FS_BLOCK_SIZE;
		} else {
			blocks = statbuf.st_size / V6FS_BLOCK_SIZE;
		}
		if (verbose)
			VERBOSE("set blocks = %d", blocks);
	}
	if (blocks > V6FS_MAX_BLOCKS) {
		warnx("will only use %u blocks", V6FS_MAX_BLOCKS);
		blocks = V6FS_MAX_BLOCKS;
	}

	if (!inode_blocks) {
		/* inode number : normal blocks ~= 3.06 */
		inode_blocks = blocks / 50;
		if (verbose)
			VERBOSE("set inode_blocks = %d", inode_blocks);
	}
}

static void write_block(int blk, char * buffer)
{
	if (verbose)
		VERBOSE("writing block %d...", blk);
	if (lseek(dev, blk * V6FS_BLOCK_SIZE, SEEK_SET) < 0)
		err(MKFS_ERROR, "%s: seek failed in write_block",
				device_name);
	if (write_all(dev, buffer, V6FS_BLOCK_SIZE))
		err(MKFS_ERROR, "%s: write failed in write_block",
				device_name);
}

static void create_super_block(void)
{
	struct v6fs_super_block * sb;
	block_t file_blocks;
	block_t nfree;
	int i;

	if (verbose)
		VERBOSE("creating super block...");

	memset(block, 0, sizeof(block));
	sb = (struct v6fs_super_block *) block;

	sb->s_isize = inode_blocks;
	sb->s_fsize = blocks;
	sb->s_time = time(NULL);

	linked_blocks = inode_blocks + 1;
	file_blocks = blocks - inode_blocks - 2;
	nfree = (file_blocks + 1 - 1) % 100;
	linked_blocks++;	/* for block of root */
	if (nfree == 0)
		nfree = 100;
	sb->s_nfree = nfree;
	for (i = nfree - 1; i >= 0; i--)
		sb->s_free[i] = ++linked_blocks;

	inodes = inode_blocks * V6FS_INODE_PER_BLOCK;
	for (i = 1; i < inodes && sb->s_ninode < 100; i++)
		if (i != V6FS_ROOT_INO)
			sb->s_inode[sb->s_ninode++]= i;

	write_block(1, block);
}

static void init_inodes(void)
{
	struct v6fs_inode * vi;
	int i;

	if (verbose)
		VERBOSE("initing inodes...");

	for (i = 2; i <= inode_blocks + 1; i++) {
		memset(block, 0, sizeof(block));
		if (V6FS_INODE_BLOCK(V6FS_ROOT_INO) == i) {
			vi = (struct v6fs_inode *)
				(block + V6FS_INODE_OFFSET(V6FS_ROOT_INO));
			vi->i_mode = V6FS_IFALLOC | V6FS_IFDIR | 0755;
			vi->i_nlink = 2;
			vi->i_size1 = 2 * V6FS_DIRENT_SIZE;
			vi->i_addr[0] = inode_blocks + 2;  /* first non-inode block */
			vi->i_atime = vi->i_mtime = time(NULL);
		}
		write_block(i, block);
	}
}

static void init_root_block(void)
{
	block_t blk = inode_blocks + 2;
	struct v6fs_dirent * de;

	if (verbose)
		VERBOSE("initing root block...");

	memset(block, 0, sizeof(block));
	de = (struct v6fs_dirent *) block;

	de[0].inode = 1;
	strcpy(de[0].name, ".");
	de[1].inode = 1;
	strcpy(de[1].name, "..");

	write_block(blk, block);
}

static void link_free_blocks(void)
{
	block_t next_block = linked_blocks;
	block_t * free_blocks;
	int i;

	if (verbose)
		VERBOSE("linking free blocks...");

	while (next_block) {
		memset(block, 0, sizeof(block));
		free_blocks = (block_t *) block;
		*free_blocks++ = 100;
		for (i = 99; i >= 0; i--)
			free_blocks[i] = ++linked_blocks;
		if (linked_blocks >= blocks)
			free_blocks[0] = 0;
		write_block(next_block, block);
		next_block = free_blocks[0];
	}
}

static void close_dev(void)
{
	close(dev);
}

int main(int argc, char *argv[])
{
	parse_arg(argc, argv);

	check_params_before();
	check_mount();

	stat_dev();
	open_dev();
	check_params_after();
	create_super_block();
	init_inodes();
	init_root_block();
	link_free_blocks();
	close_dev();

	return 0;
}
