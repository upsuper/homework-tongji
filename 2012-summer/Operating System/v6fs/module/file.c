#include "v6fs.h"

const struct file_operations v6fs_file_operations = {
	.llseek		= generic_file_llseek,
	.read		= do_sync_read,
	.aio_read	= generic_file_aio_read,
	.write		= do_sync_write,
	.aio_write	= generic_file_aio_write,
	.mmap		= generic_file_mmap,
	.fsync		= generic_file_fsync,
	.splice_read	= generic_file_splice_read,
};

static int v6fs_setattr(struct dentry *dentry, struct iattr *iattr)
{
	struct inode * inode = dentry->d_inode;
	int err;

	err = inode_change_ok(inode, iattr);
	if (err)
		return err;

	if (iattr->ia_valid & ATTR_SIZE && iattr->ia_size != inode->i_size) {
		err = v6fs_setsize(inode, iattr->ia_size);
		if (err)
			return err;
	}
	setattr_copy(inode, iattr);
	mark_inode_dirty(inode);
	return 0;
}

const struct inode_operations v6fs_file_inode_operations = {
	.setattr	= v6fs_setattr,
};
