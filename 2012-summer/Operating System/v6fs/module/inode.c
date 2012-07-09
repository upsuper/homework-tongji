/*
 * Implementation of filesystem of UNIX v6 for Linux.
 *
 * Copyright (C) 2012 Xunzhen Quan.
 *
 */

#include <linux/module.h>
#include <linux/buffer_head.h>
#include <linux/slab.h>
#include <linux/vfs.h>
#include <linux/writeback.h>
#include "v6fs.h"

struct v6fs_inode *v6fs_raw_inode(struct super_block *sb,
		ino_t ino, struct buffer_head **bh)
{
	// TODO
	return NULL;
}

static struct buffer_head *v6fs_update_inode(struct inode *inode)
{
	struct buffer_head * bh;
	struct v6fs_inode * raw_inode;
	struct v6fs_inode_info * v6fs_inode = v6fs_i(inode);
	int i;

	raw_inode = v6fs_raw_inode(inode->i_sb, inode->i_ino, &bh);
	if (!raw_inode)
		return NULL;
	raw_inode->i_mode = v6fs_inode->i_mode;
	raw_inode->i_mode |= inode->i_mode & 07777;
	if (S_ISDIR(inode->i_mode))
		raw_inode->i_mode |= V6FS_IFDIR;
	else if (S_ISCHR(inode->i_mode))
		raw_inode->i_mode |= V6FS_IFCHR;
	else if (S_ISBLK(inode->i_mode))
		raw_inode->i_mode |= V6FS_IFBLK;
	raw_inode->i_uid = inode->i_uid;
	raw_inode->i_gid = inode->i_gid;
	raw_inode->i_nlink = inode->i_nlink;
	raw_inode->i_size0 = (inode->i_size & 0xFF0000) >> 16;
	raw_inode->i_size1 = inode->i_size & 0xFFFF;
	raw_inode->i_atime = inode->i_atime.tv_sec;
	raw_inode->i_mtime = inode->i_mtime.tv_sec;
	if (S_ISCHR(inode->i_mode) || S_ISBLK(inode->i_mode))
		raw_inode->i_addr[0] = old_encode_dev(inode->i_rdev);
	else
		for (i = 0; i < 8; i++)
			raw_inode->i_addr[i] = v6fs_inode->i_data[i];
	mark_buffer_dirty(bh);
	return bh;
}

int v6fs_write_inode(struct inode *inode, struct writeback_control *wbc)
{
	int err = 0;
	struct buffer_head * bh;

	bh = v6fs_update_inode(inode);
	if (!bh)
		return -EIO;
	if (wbc->sync_mode == WB_SYNC_ALL && buffer_dirty(bh)) {
		sync_dirty_buffer(bh);
		if (buffer_req(bh) && !buffer_uptodate(bh)) {
			printk("IO error syncing v6fs inode [%s:%04lx]\n",
				inode->i_sb->s_id, inode->i_ino);
			err = -EIO;
		}
	}
	brelse(bh);
	return err;
}

int v6fs_setsize(struct inode *inode, loff_t newsize)
{
	int err;

	if (!(S_ISREG(inode->i_mode) || S_ISDIR(inode->i_mode)))
		return -EINVAL;
	err = block_truncate_page(inode->i_mapping, newsize, v6fs_get_block);
	if (err)
		return err;

	truncate_setsize(inode, newsize);
	v6fs_truncate_blocks(inode, newsize);

	inode->i_mtime = inode->i_ctime = CURRENT_TIME_SEC;
	if (inode_needs_sync(inode)) {
		sync_mapping_buffers(inode->i_mapping);
		sync_inode_metadata(inode, 1);
	} else {
		mark_inode_dirty(inode);
	}

	return 0;
}

struct inode *v6fs_new_inode(const struct inode *dir, umode_t mode, int *err)
{
	// TODO
	return NULL;
}

void v6fs_free_inode(struct inode *inode)
{
	// TODO
}

void v6fs_evict_inode(struct inode *inode)
{
	truncate_inode_pages(&inode->i_data, 0);
	if (!inode->i_nlink) {
		inode->i_size = 0;
		if (S_ISREG(inode->i_mode) || S_ISDIR(inode->i_mode))
			v6fs_truncate_blocks(inode, 0);
	}
	invalidate_inode_buffers(inode);
	end_writeback(inode);
	if (!inode->i_nlink)
		v6fs_free_inode(inode);
}

void v6fs_set_inode(struct inode *inode, dev_t rdev)
{
	if (S_ISREG(inode->i_mode)) {
		inode->i_op = &v6fs_file_inode_operations;
		inode->i_fop = &v6fs_file_operations;
		inode->i_mapping->a_ops = &v6fs_aops;
	} else if (S_ISDIR(inode->i_mode)) {
		inode->i_op = &v6fs_dir_inode_operations;
		inode->i_fop = &v6fs_dir_operations;
		inode->i_mapping->a_ops = &v6fs_aops;
	} else {
		init_special_inode(inode, inode->i_mode, rdev);
	}
}

static struct inode *v6fs_fill_inode(struct inode *inode)
{
	struct v6fs_inode * raw_inode;
	struct v6fs_inode_info * v6fs_inode = v6fs_i(inode);
	struct buffer_head * bh;
	int i;

	raw_inode = v6fs_raw_inode(inode->i_sb, inode->i_ino, &bh);
	if (!raw_inode) {
		iget_failed(inode);
		return ERR_PTR(-EIO);
	}
	inode->i_mode = raw_inode->i_mode & 07777;
	if (V6FS_ISDIR(raw_inode->i_mode))
		inode->i_mode |= S_IFDIR;
	else if (V6FS_ISCHR(raw_inode->i_mode))
		inode->i_mode |= S_IFCHR;
	else if (V6FS_ISBLK(raw_inode->i_mode))
		inode->i_mode |= S_IFBLK;
	else
		inode->i_mode |= S_IFREG;
	inode->i_uid = (uid_t) raw_inode->i_uid;
	inode->i_gid = (gid_t) raw_inode->i_gid;
	set_nlink(inode, raw_inode->i_nlink);
	inode->i_size = (raw_inode->i_size0 << 16) + raw_inode->i_size1;
	inode->i_mtime.tv_sec = raw_inode->i_mtime;
	inode->i_ctime.tv_sec = raw_inode->i_mtime;
	inode->i_atime.tv_sec = raw_inode->i_atime;
	inode->i_mtime.tv_nsec = 0;
	inode->i_atime.tv_nsec = 0;
	inode->i_ctime.tv_nsec = 0;
	inode->i_blocks = 0; // XXX ?

	v6fs_inode->i_mode = raw_inode->i_mode & (V6FS_IALLOC | V6FS_IFLARG);
	for (i = 0; i < 8; i++)
		v6fs_inode->i_data[i] = raw_inode->i_addr[i];
	v6fs_set_inode(inode, old_decode_dev(raw_inode->i_addr[0]));
	brelse(bh);

	return inode;
}

struct inode *v6fs_iget(struct super_block *sb, unsigned long ino)
{
	struct inode * inode;

	inode = iget_locked(sb, ino);
	if (!inode)
		return ERR_PTR(-ENOMEM);
	if (!(inode->i_state & I_NEW))
		return inode;

	inode = v6fs_fill_inode(inode);
	unlock_new_inode(inode);
	return inode;
}

int v6fs_count_free_inodes(struct super_block *sb)
{
	// TODO
	return 0;
}
