#ifndef _LINUX_V6FS_H
#define _LINUX_V6FS_H

#include <linux/types.h>

#define V6FS_MAGIC		0x2D9DF82C      /* some random number */
#define V6FS_BLOCK_SIZE_BITS	9
#define V6FS_BLOCK_SIZE		(1 << V6FS_BLOCK_SIZE_BITS)
#define V6FS_FILESIZE_MAX	((1 << 24) - 1)
#define V6FS_LINK_MAX		((1 << 8) - 1)
#define V6FS_FILENAME_MAX	14
#define V6FS_INODE_SIZE		(sizeof(struct v6fs_inode))
#define V6FS_INODE_PER_BLOCK	(V6FS_BLOCK_SIZE / V6FS_INODE_SIZE)
#define V6FS_DIRENT_SIZE	(sizeof(struct v6fs_dirent))
#define V6FS_MAX_BLOCKS		((1 << 16) - 1)

#define V6FS_ROOT_INO		1

#define V6FS_INODE_BLOCK(n)	((((n) - 1) / V6FS_INODE_PER_BLOCK) + 2)
#define V6FS_INODE_OFFSET(n)	\
		((((n) - 1) & (V6FS_INODE_PER_BLOCK - 1)) * V6FS_INODE_SIZE)

#define V6FS_IFALLOC	0100000
#define V6FS_IFMT	060000
#define V6FS_IFDIR	040000
#define V6FS_IFCHR	020000
#define V6FS_IFBLK	060000
#define V6FS_IFLARG	010000

#define V6FS_ISDIR(m)	(((m) & V6FS_IFMT) == V6FS_IFDIR)
#define V6FS_ISCHR(m)	(((m) & V6FS_IFMT) == V6FS_IFCHR)
#define V6FS_ISBLK(m)	(((m) & V6FS_IFMT) == V6FS_IFBLK)
#define V6FS_ISLARG(m)	(((m) & V6FS_IFLARG) == V6FS_IFLARG)

typedef __u16 block_t;

struct v6fs_inode {
	__u16 i_mode;
	__u8  i_nlink;
	__u8  i_uid;
	__u8  i_gid;
	__u8  i_size0;
	__u16 i_size1;
	__u16 i_addr[8];
	__u32 i_atime;
	__u32 i_mtime;
};

struct v6fs_dirent {
	__u16 inode;
	char name[V6FS_FILENAME_MAX];
};

struct v6fs_super_block {
	__u16 s_isize;
	__u16 s_fsize;
	__u16 s_nfree;
	__u16 s_free[100];
	__u16 s_ninode;
	__u16 s_inode[100];
	__u8  s_flock;
	__u8  s_ilock;
	__u8  s_fmod;
	__u8  s_ronly;
	__u32 s_time;
};

#endif /* _LINUX_V6FS_H */
