#include <linux/buffer_head.h>
#include "v6fs.h"

static void v6fs_write_failed(struct address_space *mapping, loff_t to)
{
	struct inode * inode = mapping->host;
	if (to > inode->i_size) {
		truncate_pagecache(inode, to, inode->i_size);
		v6fs_truncate_blocks(inode, inode->i_size);
	}
}

static int v6fs_readpage(struct file *file, struct page *page)
{
	return block_read_full_page(page, v6fs_get_block);
}

static int v6fs_writepage(struct page *page, struct writeback_control *wbc)
{
	return block_write_full_page(page, v6fs_get_block, wbc);
}

static int v6fs_write_begin(struct file *file, struct address_space *mapping,
		loff_t pos, unsigned len, unsigned flags,
		struct page **pagep, void **fsdata)
{
	int ret;
	ret = block_write_begin(mapping, pos, len, flags, pagep,
				v6fs_get_block);
	if (ret < 0)
		v6fs_write_failed(mapping, pos + len);
	return ret;
}

static sector_t v6fs_bmap(struct address_space *mapping, sector_t block)
{
	return generic_block_bmap(mapping, block, v6fs_get_block);
}

const struct address_space_operations v6fs_aops = {
	.readpage	= v6fs_readpage,
	.writepage	= v6fs_writepage,
	.write_begin	= v6fs_write_begin,
	.write_end	= generic_write_end,
	.bmap		= v6fs_bmap
};
