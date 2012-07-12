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

static struct v6fs_inode *v6fs_raw_inode(struct super_block *sb,
		ino_t ino, struct buffer_head **p)
{
	struct buffer_head * bh;
	struct v6fs_sb_info * sbi = v6fs_sb(sb);
	block_t block;
	int offset;

	if (ino < 1)
		return ERR_PTR(-EINVAL);
	block = V6FS_INODE_BLOCK(ino);
	offset = V6FS_INODE_OFFSET(ino);
	if (block > sbi->s_isize + 1)
		return ERR_PTR(-EINVAL);

	bh = sb_bread(sb, block);
	if (!bh)
		return ERR_PTR(-EIO);
	
	*p = bh;
	return (struct v6fs_inode *) bh->b_data + offset;
}

static struct buffer_head *v6fs_update_inode(struct inode *inode)
{
	struct buffer_head * bh;
	struct v6fs_inode * raw_inode;
	struct v6fs_inode_info * vi = v6fs_i(inode);
	int i;

	raw_inode = v6fs_raw_inode(inode->i_sb, inode->i_ino, &bh);
	if (!raw_inode)
		return NULL;
	raw_inode->i_mode = vi->i_mode;
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
			raw_inode->i_addr[i] = vi->i_data[i];
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

static int v6fs_collect_inodes(struct super_block *sb,
		unsigned long *ino, struct buffer_head **bh)
{
	struct v6fs_sb_info * sbi = v6fs_sb(sb);
	struct v6fs_inode * raw_inode;
	struct buffer_head * p = NULL;
	block_t i;
	unsigned int j;

	*bh = NULL;
	*ino = 0;
	for (i = 0; i < sbi->s_isize; i++) {
		p = sb_bread(sb, i + 2);
		if (!p)
			continue;
		for (j = 0; j < V6FS_INODE_PER_BLOCK; j++) {
			raw_inode = (struct v6fs_inode *) p->b_data + j;
			if (raw_inode->i_mode & V6FS_IALLOC)
				continue;
			if (*bh)
				brelse(*bh);
			*bh = p;
			*ino = i * V6FS_INODE_PER_BLOCK + j;
			if (sbi->s_ninode == 100)
				return 0;
			sbi->s_inode[sbi->s_ninode++] = *ino;
		}
		if (*bh != p)
			brelse(p);
	}

	return *ino ? 0 : -ENOSPC;
}

struct inode *v6fs_new_inode(const struct inode *dir, umode_t mode)
{
	struct super_block * sb = dir->i_sb;
	struct v6fs_sb_info * sbi = v6fs_sb(sb);
	struct buffer_head * bh;
	struct inode * inode;
	struct v6fs_inode * raw_inode;
	struct v6fs_inode_info * vi;
	unsigned long ino;
	int err;

	err = -ENOMEM;
	inode = new_inode(sb);
	if (!inode)
		goto out_err;

	mutex_lock(&sbi->s_inode_lock);
	if (!sbi->s_ninode) {
		err = v6fs_collect_inodes(sb, &ino, &bh);
		if (err)
			goto out_unlock;
	} else {
		sbi->s_ninode--;
		ino = sbi->s_inode[sbi->s_ninode];
		sbi->s_inode[sbi->s_ninode] = 0;

		err = -EIO;
		bh = sb_bread(sb, V6FS_INODE_BLOCK(ino));
		if (!bh)
			goto out_unlock;
	}

	vi = v6fs_i(inode);
	vi->i_mode = V6FS_IALLOC;
	raw_inode = (struct v6fs_inode *)
		(bh->b_data + V6FS_INODE_OFFSET(ino));
	raw_inode->i_mode = V6FS_IALLOC;
	mutex_unlock(&sbi->s_inode_lock);
	sb->s_dirt = 1;
	mark_buffer_dirty(bh);
	brelse(bh);

	inode_init_owner(inode, dir, mode);
	inode->i_ino = ino;
	inode->i_blocks = 0;
	inode->i_mtime = inode->i_atime = inode->i_ctime = CURRENT_TIME_SEC;
	memset(vi->i_data, 0, sizeof(vi->i_data));
	insert_inode_hash(inode);
	mark_inode_dirty(inode);

	return inode;

out_unlock:
	mutex_unlock(&sbi->s_inode_lock);
	iput(inode);
out_err:
	return ERR_PTR(err);
}

void v6fs_free_inode(struct inode *inode)
{
	struct super_block * sb = inode->i_sb;
	struct v6fs_sb_info * sbi = v6fs_sb(sb);
	struct buffer_head * bh;
	struct v6fs_inode * raw_inode;
	unsigned long ino;

	ino = inode->i_ino;
	bh = sb_bread(sb, V6FS_INODE_BLOCK(ino));
	if (!bh)
		return;

	raw_inode = (struct v6fs_inode *)
		(bh->b_data + V6FS_INODE_OFFSET(ino));
	raw_inode->i_mode = 0;
	mark_buffer_dirty(bh);

	mutex_lock(&sbi->s_inode_lock);
	if (!raw_inode->i_mode && sbi->s_ninode < 100)
		sbi->s_inode[sbi->s_ninode++] = ino;
	mutex_unlock(&sbi->s_inode_lock);

	brelse(bh);
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
	struct v6fs_inode_info * vi = v6fs_i(inode);
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
	inode->i_blocks = 0;

	vi->i_mode = raw_inode->i_mode & (V6FS_IALLOC | V6FS_IFLARG);
	for (i = 0; i < 8; i++)
		vi->i_data[i] = raw_inode->i_addr[i];
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
	struct v6fs_sb_info * sbi = v6fs_sb(sb);
	struct buffer_head * bh;
	struct v6fs_inode * raw_inode;
	int result = 0;
	block_t i;
	unsigned int j;

	for (i = 0; i < sbi->s_isize; i++) {
		bh = sb_bread(sb, i + 2);
		if (!bh)
			continue;
		for (j = 0; j < V6FS_INODE_PER_BLOCK; j++) {
			raw_inode = (struct v6fs_inode *) bh->b_data + j;
			if (!(raw_inode->i_mode & V6FS_IALLOC))
				result++;
		}
		brelse(bh);
	}
	return result;
}
