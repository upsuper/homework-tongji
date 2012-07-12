#include <linux/buffer_head.h>
#include "v6fs.h"

static inline unsigned long dir_pages(struct inode *inode)
{
	return (inode->i_size + PAGE_CACHE_SIZE - 1) >> PAGE_CACHE_SHIFT;
}

static struct page *v6fs_get_page(struct inode *inode, unsigned long n)
{
	struct page * page = read_mapping_page(inode->i_mapping, n, NULL);
	if (!IS_ERR(page))
		kmap(page);
	return page;
}

static inline void v6fs_put_page(struct page *page)
{
	kunmap(page);
	page_cache_release(page);
}

static unsigned int v6fs_page_bound(struct inode *inode, unsigned long nr)
{
	unsigned int bound = PAGE_CACHE_SIZE;
	if (nr == (inode->i_size >> PAGE_CACHE_SHIFT))
		bound = inode->i_size & (PAGE_CACHE_SIZE - 1);
	return bound;
}

static int v6fs_readdir(struct file *filp, void *dirent, filldir_t filldir)
{
	loff_t pos = filp->f_pos;
	struct inode * inode = filp->f_path.dentry->d_inode;
	unsigned int offset = pos & ~PAGE_CACHE_MASK;
	unsigned long n = pos >> PAGE_CACHE_SHIFT;
	unsigned long npages = dir_pages(inode);

	pos = (pos + V6FS_DIRENT_SIZE - 1) & (V6FS_DIRENT_SIZE - 1);
	if (pos >= inode->i_size)
		goto done;

	for (; n < npages; n++, offset = 0) {
		char * p, * kaddr, * limit;
		struct page * page = v6fs_get_page(inode, n);
		struct v6fs_dirent * dirent;

		if (IS_ERR(page))
			continue;
		kaddr = (char *) page_address(page);
		limit = kaddr + v6fs_page_bound(inode, n) - V6FS_DIRENT_SIZE;
		for (p = kaddr + offset; p <= limit; p += V6FS_DIRENT_SIZE) {
			int over;
			dirent = (struct v6fs_dirent *) p;
			if (!dirent->inode)
				continue;

			offset = p - kaddr;
			over = filldir(dirent, dirent->name,
				strnlen(dirent->name, V6FS_FILESIZE_MAX),
				(n << PAGE_CACHE_SHIFT) | offset,
				dirent->inode, DT_UNKNOWN);
			if (over) {
				v6fs_put_page(page);
				goto done;
			}
		}
		v6fs_put_page(page);
	}

done:
	filp->f_pos = (n << PAGE_CACHE_SHIFT) | offset;
	return 0;
}

const struct file_operations v6fs_dir_operations = {
	.llseek		= generic_file_llseek,
	.read		= generic_read_dir,
	.readdir	= v6fs_readdir,
	.fsync		= generic_file_fsync,
};

static inline int v6fs_match(int len, const char *name, const char *buffer)
{
	if (len < V6FS_FILENAME_MAX && buffer[len])
		return 0;
	return !memcmp(name, buffer, len);
}

static struct v6fs_dirent *v6fs_find_entry(struct dentry *dentry,
		struct page **res_page)
{
	const char * name = dentry->d_name.name;
	int namelen = dentry->d_name.len;
	struct inode * dir = dentry->d_parent->d_inode;
	unsigned long n;
	unsigned long npages = dir_pages(dir);
	struct page * page = NULL;
	char * p;

	*res_page = NULL;

	for (n = 0; n < npages; n++) {
		char * kaddr, * limit;
		struct v6fs_dirent * de;

		page = v6fs_get_page(dir, n);
		if (IS_ERR(page))
			continue;

		kaddr = (char *) page_address(page);
		limit = kaddr + v6fs_page_bound(dir, n) - V6FS_DIRENT_SIZE;
		for (p = kaddr; p <= limit; p += V6FS_DIRENT_SIZE) {
			de = (struct v6fs_dirent *) p;
			if (!de->inode)
				continue;
			if (v6fs_match(namelen, name, de->name))
				goto found;
		}
		v6fs_put_page(page);
	}
	return NULL;

found:
	*res_page = page;
	return (struct v6fs_dirent *) p;
}

static ino_t v6fs_inode_by_name(struct dentry *dentry)
{
	struct page * page;
	struct v6fs_dirent * de = v6fs_find_entry(dentry, &page);
	ino_t inode = 0;

	if (de) {
		inode = de->inode;
		v6fs_put_page(page);
	}
	return inode;
}

static struct dentry *v6fs_lookup(struct inode *dir,
		struct dentry *dentry, struct nameidata *nd)
{
	struct inode * inode = NULL;
	ino_t ino;

	if (dentry->d_name.len > V6FS_FILENAME_MAX)
		return ERR_PTR(-ENAMETOOLONG);

	ino = v6fs_inode_by_name(dentry);
	if (ino) {
		inode = v6fs_iget(dir->i_sb, ino);
		if (IS_ERR(inode))
			return ERR_CAST(inode);
	}
	d_add(dentry, inode);
	return NULL;
}

static int v6fs_prepare_chunk(struct page *page, loff_t pos, unsigned int len)
{
	return __block_write_begin(page, pos, len, v6fs_get_block);
}

static int v6fs_commit_chunk(struct page *page, loff_t pos, unsigned int len)
{
	struct address_space * mapping = page->mapping;
	struct inode * dir = mapping->host;
	int err = 0;
	block_write_end(NULL, mapping, pos, len, len, page, NULL);

	if (pos + len > dir->i_size) {
		i_size_write(dir, pos + len);
		mark_inode_dirty(dir);
	}
	if (IS_DIRSYNC(dir))
		err = write_one_page(page, 1);
	else
		unlock_page(page);
	return err;
}

static int v6fs_add_link(struct dentry *dentry, struct inode *inode)
{
	struct inode * dir = dentry->d_parent->d_inode;
	const char * name = dentry->d_name.name;
	int namelen = dentry->d_name.len;
	struct page * page = NULL;
	unsigned long npages = dir_pages(dir);
	unsigned long n;
	struct v6fs_dirent * de;
	loff_t pos;
	int err;
	char * p;

	for (n = 0; n <= npages; n++) {
		char * kaddr, * limit, * dir_end;

		page = v6fs_get_page(dir, n);
		err = PTR_ERR(page);
		if (IS_ERR(page))
			goto out;

		lock_page(page);
		kaddr = (char *) page_address(page);
		dir_end = kaddr + v6fs_page_bound(dir, n);
		limit = kaddr + PAGE_CACHE_SIZE - V6FS_DIRENT_SIZE;
		for (p = kaddr; p <= limit; p += V6FS_DIRENT_SIZE) {
			de = (struct v6fs_dirent *) p;
			if (p == dir_end)
				de->inode = 0;
			if (!de->inode)
				goto got_it;
		}
		unlock_page(page);
		v6fs_put_page(page);
	}
	BUG();
	return -EINVAL;

got_it:
	pos = page_offset(page) + (p - (char *) page_address(page));
	err = v6fs_prepare_chunk(page, pos, V6FS_DIRENT_SIZE);
	if (err)
		goto out_unlock;
	memcpy(de->name, name, namelen);
	memset(de->name + namelen, 0, V6FS_DIRENT_SIZE - namelen - 2);
	de->inode = inode->i_ino;
	err = v6fs_commit_chunk(page, pos, V6FS_DIRENT_SIZE);
	dir->i_mtime = dir->i_ctime = CURRENT_TIME_SEC;
	mark_inode_dirty(dir);
out_put:
	v6fs_put_page(page);
out:
	return err;

out_unlock:
	unlock_page(page);
	goto out_put;
}

static int v6fs_add_nondir(struct dentry *dentry, struct inode *inode)
{
	int err = v6fs_add_link(dentry, inode);
	if (!err) {
		d_instantiate(dentry, inode);
		return 0;
	}
	inode_dec_link_count(inode);
	iput(inode);
	return err;
}

static int v6fs_mknod(struct inode *dir,
		struct dentry *dentry, umode_t mode, dev_t rdev)
{
	int err;
	struct inode * inode;

	if (!old_valid_dev(rdev))
		return -EINVAL;

	inode = v6fs_new_inode(dir, mode);
	err = PTR_ERR(inode);
	if (!IS_ERR(inode)) {
		v6fs_set_inode(inode, rdev);
		mark_inode_dirty(inode);
		err = v6fs_add_nondir(dentry, inode);
	}
	return err;
}

static int v6fs_create(struct inode *dir,
		struct dentry *dentry, umode_t mode, struct nameidata *nd)
{
	return v6fs_mknod(dir, dentry, mode, 0);
}

static int v6fs_link(struct dentry *old_dentry,
		struct inode *dir, struct dentry *dentry)
{
	struct inode * inode = old_dentry->d_inode;

	inode->i_ctime = CURRENT_TIME_SEC;
	inode_inc_link_count(inode);
	ihold(inode);
	return v6fs_add_nondir(dentry, inode);
}

static int v6fs_make_empty(struct inode *inode, struct inode *dir)
{
	struct page * page = grab_cache_page(inode->i_mapping, 0);
	struct v6fs_dirent * de;
	char * kaddr;
	int err;

	if (!page)
		return -ENOMEM;
	err = v6fs_prepare_chunk(page, 0, 2 * V6FS_DIRENT_SIZE);
	if (err) {
		unlock_page(page);
		goto out;
	}

	kaddr = kmap_atomic(page);
	memset(kaddr, 0, PAGE_CACHE_SIZE);
	de = (struct v6fs_dirent *) kaddr;
	de->inode = inode->i_ino;
	strcpy(de->name, ".");
	de += 1;
	de->inode = dir->i_ino;
	strcpy(de->name, "..");
	kunmap_atomic(kaddr);

	err = v6fs_commit_chunk(page, 0, 2 * V6FS_DIRENT_SIZE);
out:
	page_cache_release(page);
	return err;
}

static int v6fs_mkdir(struct inode *dir, struct dentry *dentry, umode_t mode)
{
	struct inode * inode;
	int err;

	inode_inc_link_count(dir);
	inode = v6fs_new_inode(dir, S_IFDIR | mode);
	err = PTR_ERR(inode);
	if (IS_ERR(inode))
		goto out_dir;

	v6fs_set_inode(inode, 0);
	inode_inc_link_count(inode);
	err = v6fs_make_empty(inode, dir);
	if (err)
		goto out_fail;
	err = v6fs_add_link(dentry, inode);
	if (err)
		goto out_fail;

	d_instantiate(dentry, inode);
out:
	return err;

out_fail:
	inode_dec_link_count(inode);
	inode_dec_link_count(inode);
	iput(inode);
out_dir:
	inode_dec_link_count(dir);
	goto out;
}

static int v6fs_delete_entry(struct v6fs_dirent *de, struct page *page)
{
	struct inode * inode = page->mapping->host;
	char * kaddr = page_address(page);
	loff_t pos = page_offset(page) + ((char *) de - kaddr);
	int err;

	lock_page(page);
	err = v6fs_prepare_chunk(page, pos, V6FS_DIRENT_SIZE);
	if (!err) {
		memset(de, 0, V6FS_DIRENT_SIZE);
		err = v6fs_commit_chunk(page, pos, V6FS_DIRENT_SIZE);
	} else {
		unlock_page(page);
	}
	v6fs_put_page(page);
	inode->i_ctime = inode->i_mtime = CURRENT_TIME_SEC;
	mark_inode_dirty(inode);
	return err;
}

static int v6fs_unlink(struct inode *dir, struct dentry *dentry)
{
	int err = -ENOENT;
	struct inode * inode = dentry->d_inode;
	struct page * page;
	struct v6fs_dirent * de;

	de = v6fs_find_entry(dentry, &page);
	if (!de)
		goto out;

	err = v6fs_delete_entry(de, page);
	if (err)
		goto out;

	inode->i_ctime = dir->i_ctime;
	inode_dec_link_count(inode);
out:
	return err;
}

static int v6fs_empty_dir(struct inode *inode)
{
	struct page * page;
	unsigned long n, npages = dir_pages(inode);

	for (n = 0; n < npages; n++) {
		char * p, * kaddr, * limit;
		struct v6fs_dirent * de;

		page = v6fs_get_page(inode, n);
		if (IS_ERR(page))
			continue;

		kaddr = (char *) page_address(page);
		limit = kaddr + v6fs_page_bound(inode, n) - V6FS_DIRENT_SIZE;
		for (p = kaddr; p <= limit; p += V6FS_DIRENT_SIZE) {
			de = (struct v6fs_dirent *) p;
			if (!de->inode)
				continue;
			if (de->name[0] != '.')
				goto not_empty;
			if (!de->name[1]) {
				/* XXX why need? */
				if (de->inode != inode->i_ino)
					goto not_empty;
			} else if (de->name[1] != '.') {
				goto not_empty;
			} else if (de->name[2]) {
				goto not_empty;
			}
		}
		v6fs_put_page(page);
	}
	return 1;

not_empty:
	v6fs_put_page(page);
	return 0;
}

static int v6fs_rmdir(struct inode *dir, struct dentry *dentry)
{
	struct inode * inode = dentry->d_inode;
	int err = -ENOTEMPTY;

	if (v6fs_empty_dir(inode)) {
		err = v6fs_unlink(dir, dentry);
		if (!err) {
			inode_dec_link_count(dir);
			inode_dec_link_count(inode);
		}
	}
	return err;
}

static struct v6fs_dirent *v6fs_dotdot(struct inode *dir, struct page **p)
{
	struct page * page = v6fs_get_page(dir, 0);
	struct v6fs_dirent * de = NULL;
	if (!IS_ERR(page)) {
		de = (struct v6fs_dirent *) page_address(page) + 1;
		*p = page;
	}
	return de;
}

static void v6fs_set_link(struct v6fs_dirent *de,
		struct page *page, struct inode *inode)
{
	struct inode *dir = page->mapping->host;
	loff_t pos = page_offset(page) +
		((char *) de - (char *) page_address(page));
	int err;

	lock_page(page);

	err = v6fs_prepare_chunk(page, pos, V6FS_DIRENT_SIZE);
	if (!err) {
		de->inode = inode->i_ino;
		err = v6fs_commit_chunk(page, pos, V6FS_DIRENT_SIZE);
	} else {
		unlock_page(page);
	}
	v6fs_put_page(page);
	dir->i_mtime = dir->i_ctime = CURRENT_TIME_SEC;
	mark_inode_dirty(dir);
}

static int v6fs_rename(struct inode *old_dir, struct dentry *old_dentry,
		struct inode *new_dir, struct dentry *new_dentry)
{
	struct inode * old_inode = old_dentry->d_inode;
	struct inode * new_inode = new_dentry->d_inode;
	struct page * dir_page = NULL;
	struct v6fs_dirent * dir_de = NULL;
	struct page * old_page;
	struct v6fs_dirent * old_de;
	int err;

	err = -ENOENT;
	old_de = v6fs_find_entry(old_dentry, &old_page);
	if (!old_de)
		goto out;

	if (S_ISDIR(old_inode->i_mode)) {
		err = -EIO;
		dir_de = v6fs_dotdot(old_inode, &dir_page);
		if (!dir_de)
			goto out_old;
	}

	if (new_inode) {
		struct page * new_page;
		struct v6fs_dirent * new_de;

		err = -ENOTEMPTY;
		if (dir_de && !v6fs_empty_dir(new_inode))
			goto out_dir;

		err = -ENOENT;
		new_de = v6fs_find_entry(new_dentry, &new_page);
		if (!new_de)
			goto out_dir;
		v6fs_set_link(new_de, new_page, old_inode);
		new_inode->i_ctime = CURRENT_TIME_SEC;
		if (dir_de)
			drop_nlink(new_inode);
		inode_dec_link_count(new_inode);
	} else {
		err = v6fs_add_link(new_dentry, old_inode);
		if (err)
			goto out_dir;
		if (dir_de)
			inode_inc_link_count(new_dir);
	}

	v6fs_delete_entry(old_de, old_page);
	mark_inode_dirty(old_inode);

	if (dir_de) {
		v6fs_set_link(dir_de, dir_page, new_dir);
		inode_dec_link_count(old_dir);
	}
	return 0;

out_dir:
	if (dir_de) {
		kunmap(dir_page);
		page_cache_release(dir_page);
	}
out_old:
	kunmap(old_page);
	page_cache_release(old_page);
out:
	return err;
}

const struct inode_operations v6fs_dir_inode_operations = {
	.create		= v6fs_create,
	.lookup		= v6fs_lookup,
	.link		= v6fs_link,
	.unlink		= v6fs_unlink,
	.mkdir		= v6fs_mkdir,
	.rmdir		= v6fs_rmdir,
	.mknod		= v6fs_mknod,
	.rename		= v6fs_rename,
};
