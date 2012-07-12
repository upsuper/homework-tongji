#ifndef FS_V6FS_H
#define FS_V6FS_H

#include <linux/fs.h>
#include <v6fs/v6fs.h>

struct v6fs_inode_info {
	unsigned short i_mode;
	block_t i_data[8];
	rwlock_t i_meta_lock;
	struct inode vfs_inode;
};
struct v6fs_sb_info {
	unsigned int s_isize;
	unsigned int s_fsize;
	unsigned int s_nfree;
	unsigned int s_free[100];
	struct mutex s_free_lock;
	unsigned int s_ninode;
	unsigned int s_inode[100];
	struct mutex s_inode_lock;
	struct buffer_head * s_sbh;
	struct v6fs_super_block * s_vs;
	unsigned short s_mount_state;
};

/* inode.c */
extern struct inode *v6fs_iget(struct super_block *, unsigned long);
extern int v6fs_write_inode(struct inode *, struct writeback_control *);
extern struct inode *v6fs_new_inode(const struct inode *, umode_t);
extern void v6fs_evict_inode(struct inode *);
extern void v6fs_set_inode(struct inode *, dev_t);
extern int v6fs_setsize(struct inode *, loff_t);
extern int v6fs_count_free_inodes(struct super_block *); 
/* block.c */
extern long v6fs_new_block(struct inode *);
extern void v6fs_free_block(struct inode *, block_t);
extern int v6fs_get_block(struct inode *, sector_t, struct buffer_head *, int);
extern void v6fs_truncate_blocks(struct inode *, loff_t);
extern int v6fs_count_free_blocks(struct super_block *);

extern const struct inode_operations v6fs_file_inode_operations;
extern const struct inode_operations v6fs_dir_inode_operations;
extern const struct file_operations v6fs_file_operations;
extern const struct file_operations v6fs_dir_operations;
extern const struct address_space_operations v6fs_aops;

static inline struct v6fs_sb_info *v6fs_sb(struct super_block *sb)
{
	return sb->s_fs_info;
}

static inline struct v6fs_inode_info *v6fs_i(struct inode *inode)
{
	return list_entry(inode, struct v6fs_inode_info, vfs_inode);
}

#endif /* FS_V6FS_H */
