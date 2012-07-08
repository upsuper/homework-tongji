#ifndef FS_V6FS_H
#define FS_V6FS_H

#include <linux/fs.h>

#define V6FS_MAGIC              0x2D9DF82C      /* some random number */
#define V6FS_BLOCK_SIZE         512
#define V6FS_BLOCK_BITS         (V6FS_BLOCK_SIZE << 3)
#define V6FS_FILESIZE_MAX       ((1 << 24) - 1)
#define V6FS_LINK_MAX           ((1 << 8) - 1)
#define V6FS_FILENAME_MAX       14

#define V6FS_ROOT_INO           1

#define V6FS_IALLOC     0100000
#define V6FS_IFMT       060000
#define V6FS_IFDIR      040000
#define V6FS_IFCHR      020000
#define V6FS_IFBLK      060000
#define V6FS_IFLARG     010000

#define V6FS_ISDIR(m)   (((m) & V6FS_IFMT) == V6FS_IFDIR)
#define V6FS_ISCHR(m)   (((m) & V6FS_IFMT) == V6FS_IFCHR)
#define V6FS_ISBLK(m)   (((m) & V6FS_IFMT) == V6FS_IFBLK)
#define V6FS_ISLARG(m)  (((m) & V6FS_IFLARG) == V6FS_IFLARG)

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

struct v6fs_inode_info {
        unsigned short i_mode;
        block_t i_data[8];
        rwlock_t i_meta_lock;
        struct inode vfs_inode;
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
        __u16 s_time[2];
};

struct v6fs_sb_info {
        unsigned int s_isize;
        unsigned int s_fsize;
        unsigned int s_nfree;
        unsigned int s_free[100];
        unsigned int s_ninode;
        unsigned int s_inode[100];
        struct buffer_head * s_sbh;
        struct v6fs_super_block * s_vs;
        unsigned short s_mount_state;
};

struct v6fs_dir_entry {
        __u16 inode;
        char name[V6FS_FILENAME_MAX];
};

extern struct inode *v6fs_iget(struct super_block *, unsigned long);
extern struct inode *v6fs_new_inode(const struct inode *, umode_t, int *);
extern void v6fs_free_inode(struct inode *);
extern int v6fs_new_block(struct inode *);
extern void v6fs_free_block(struct inode *, unsigned long block);
extern int v6fs_get_block(struct inode *, sector_t, struct buffer_head *, int);
extern void v6fs_truncate(struct inode *);

extern const struct inode_operations v6fs_file_inode_operations;
extern const struct inode_operations v6fs_dir_inode_operations;
extern const struct file_operations v6fs_file_operations;
extern const struct file_operations v6fs_dir_operations;

static inline struct v6fs_sb_info *v6fs_sb(struct super_block *sb)
{
        return sb->s_fs_info;
}

static inline struct v6fs_inode_info *v6fs_i(struct inode *inode)
{
        return list_entry(inode, struct v6fs_inode_info, vfs_inode);
}

#endif /* FS_V6FS_H */
