#include <linux/fs.h>
#include <linux/vfs.h>
#include <linux/slab.h>
#include <linux/time.h>
#include <linux/module.h>
#include <linux/buffer_head.h>
#include "v6fs.h"

static struct kmem_cache * v6fs_inode_cachep;

static struct inode *v6fs_alloc_inode(struct super_block *sb)
{
	struct v6fs_inode_info * vi;
	vi = (struct v6fs_inode_info *)
		kmem_cache_alloc(v6fs_inode_cachep, GFP_KERNEL);
	if (!vi)
		return NULL;
	return &vi->vfs_inode;
}

static void v6fs_i_callback(struct rcu_head *head)
{
	struct inode * inode = container_of(head, struct inode, i_rcu);
	kmem_cache_free(v6fs_inode_cachep, v6fs_i(inode));
}

static void v6fs_destroy_inode(struct inode *inode)
{
	call_rcu(&inode->i_rcu, v6fs_i_callback);
}

static void v6fs_sync_super(struct super_block *sb, int wait)
{
	struct v6fs_sb_info * sbi = v6fs_sb(sb);
	struct v6fs_super_block * vs = sbi->s_vs;
	struct buffer_head * bh = sbi->s_sbh;
	int i;

	vs->s_nfree = sbi->s_nfree;
	vs->s_ninode = sbi->s_ninode;
	vs->s_time = get_seconds();
	for (i = 0; i < 100; i++)
		vs->s_free[i] = sbi->s_free[i];
	for (i = 0; i < 100; i++)
		vs->s_inode[i] = sbi->s_inode[i];

	mark_buffer_dirty(bh);
	if (wait)
		sync_dirty_buffer(bh);
	sb->s_dirt = 0;
}

static int v6fs_sync_fs(struct super_block *sb, int wait)
{
	v6fs_sync_super(sb, wait);
	return 0;
}

static void v6fs_write_super(struct super_block *sb)
{
	if (!(sb->s_flags & MS_RDONLY))
		v6fs_sync_fs(sb, 1);
	else
		sb->s_dirt = 0;
}

static void v6fs_put_super(struct super_block *sb)
{
	struct v6fs_sb_info * sbi = v6fs_sb(sb);
	if (sb->s_dirt)
		v6fs_write_super(sb);
	brelse(sbi->s_sbh);
	sb->s_fs_info = NULL;
	kfree(sbi);
}

static int v6fs_statfs(struct dentry *dentry, struct kstatfs *buf)
{
	struct super_block * sb = dentry->d_sb;
	struct v6fs_sb_info * sbi = v6fs_sb(sb);
	u64 id = huge_encode_dev(sb->s_bdev->bd_dev);
	buf->f_type	= V6FS_MAGIC;
	buf->f_bsize	= sb->s_blocksize;
	buf->f_blocks	= sbi->s_fsize - sbi->s_isize - 2;
	buf->f_bfree	= v6fs_count_free_blocks(sb);
	buf->f_bavail	= buf->f_bfree;
	buf->f_ffree	= v6fs_count_free_inodes(sb);
	buf->f_files	= sbi->s_isize * V6FS_INODE_PER_BLOCK;
	buf->f_namelen	= V6FS_FILENAME_MAX;
	buf->f_fsid.val[0] = (u32) id;
	buf->f_fsid.val[1] = (u32) (id >> 32);
	return 0;
}

static const struct super_operations v6fs_sops = {
	.alloc_inode	= v6fs_alloc_inode,
	.destroy_inode	= v6fs_destroy_inode,
	.write_inode	= v6fs_write_inode,
	.evict_inode	= v6fs_evict_inode,
	.put_super	= v6fs_put_super,
	.write_super	= v6fs_write_super,
	.sync_fs	= v6fs_sync_fs,
	.statfs		= v6fs_statfs,
};

static int v6fs_fill_super(struct super_block *sb, void *data, int silent)
{
	struct buffer_head * bh;
	struct v6fs_sb_info * sbi;
	struct v6fs_super_block * vs;
	struct inode * root_inode;
	int i;
	int ret = -EINVAL;

	sbi = kzalloc(sizeof(*sbi), GFP_KERNEL);
	if (!sbi)
		return -ENOMEM;
	sb->s_fs_info = sbi;

	BUILD_BUG_ON(32 != sizeof(struct v6fs_inode));
	BUILD_BUG_ON(16 != sizeof(struct v6fs_dirent));

	if (!sb_set_blocksize(sb, V6FS_BLOCK_SIZE))
		goto out_bad_hblock;

	if (!(bh = sb_bread(sb, 1)))
		goto out_bad_sb;

	vs = (struct v6fs_super_block *) bh->b_data;
	sbi->s_vs	= vs;
	sbi->s_sbh	= bh;
	sbi->s_isize	= vs->s_isize;
	sbi->s_fsize	= vs->s_fsize;
	sbi->s_nfree	= vs->s_nfree;
	sbi->s_ninode	= vs->s_ninode;

	if (!sbi->s_fsize || !sbi->s_isize || sbi->s_fsize < sbi->s_isize + 1)
		goto out_error_sb;

	mutex_init(&sbi->s_free_lock);
	mutex_init(&sbi->s_inode_lock);

	sb->s_maxbytes	= V6FS_FILESIZE_MAX;
	sb->s_max_links	= V6FS_LINK_MAX;
	sb->s_magic	= V6FS_MAGIC;

	for (i = 0; i < 100; i++)
		sbi->s_free[i] = vs->s_free[i];
	for (i = 0; i < 100; i++)
		sbi->s_inode[i] = vs->s_inode[i];

	sb->s_op = &v6fs_sops;
	root_inode = v6fs_iget(sb, V6FS_ROOT_INO);
	if (IS_ERR(root_inode)) {
		ret = PTR_ERR(root_inode);
		goto out_no_root;
	}

	ret = -ENOMEM;
	sb->s_root = d_make_root(root_inode);
	if (!sb->s_root)
		goto out_no_root;

	return 0;

out_no_root:
	if (!silent)
		printk("V6FS: get root inode failed\n");
	goto out;

out_error_sb:
	printk("V6FS: bad superblock detect\n");
	goto out;

out_bad_sb:
	printk("V6FS: unable to read superblock\n");
	goto out;

out_bad_hblock:
	printk("V6FS: blocksize too small for device\n");
	goto out;

out:
	sb->s_fs_info = NULL;
	kfree(sbi);
	return ret;
}

static struct dentry *v6fs_mount(struct file_system_type *fs_type,
		int flags, const char *dev_name, void *data)
{
	return mount_bdev(fs_type, flags, dev_name, data, v6fs_fill_super);
}

static struct file_system_type v6fs_fs_type = {
	.owner		= THIS_MODULE,
	.name		= "v6fs",
	.mount		= v6fs_mount,
	.kill_sb	= kill_block_super,
	.fs_flags	= FS_REQUIRES_DEV,
};

static void init_once(void *foo)
{
	struct v6fs_inode_info * vi = (struct v6fs_inode_info *) foo;
	rwlock_init(&vi->i_meta_lock);
	inode_init_once(&vi->vfs_inode);
}

static int init_inodecache(void)
{
	v6fs_inode_cachep = kmem_cache_create("v6fs_inode_cache",
				sizeof(struct v6fs_inode_info),
				0, (SLAB_RECLAIM_ACCOUNT | SLAB_MEM_SPREAD),
				init_once);
	if (v6fs_inode_cachep == NULL)
		return -ENOMEM;
	return 0;
}

static void destroy_inodecache(void)
{
	kmem_cache_destroy(v6fs_inode_cachep);
}

static int __init init_v6fs_fs(void)
{
	int err = init_inodecache();
	if (err)
		goto out1;
	err = register_filesystem(&v6fs_fs_type);
	if (err)
		goto out;
	return 0;
out:
	destroy_inodecache();
out1:
	return err;
}

static void __exit exit_v6fs_fs(void)
{
	unregister_filesystem(&v6fs_fs_type);
	destroy_inodecache();
}

MODULE_AUTHOR("Xunzhen Quan <quanxunzhen@gmail.com>");
MODULE_DESCRIPTION("Implementation of filesystem of UNIX v6 for Linux");
MODULE_LICENSE("GPL");
module_init(init_v6fs_fs)
module_exit(exit_v6fs_fs)
