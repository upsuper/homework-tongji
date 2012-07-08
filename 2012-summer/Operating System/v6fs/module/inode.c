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

static int v6fs_write_inode(struct inode *inode, struct writeback_control *wbc)
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

static int v6fs_statfs(struct dentry *dentry, struct kstatfs *buf)
{
        // TODO
}

static int v6fs_remount(struct super_block *sb, int *flags, char *data)
{
        // TODO
}

static void v6fs_evict_inode(struct inode *inode)
{
        truncate_inode_pages(&inode->i_data, 0);
        if (!inode->i_nlink) {
                inode->i_size = 0;
                v6fs_truncate(inode);
        }
        invalidate_inode_buffers(inode);
        end_writeback(inode);
        if (!inode->i_nlink)
                v6fs_free_inode(inode);
}

static void v6fs_put_super(struct super_block *sb)
{
        struct v6fs_sb_info * sbi = v6fs_sb(sb);
        if (!(sb->s_flags & MS_RDONLY))
                mark_buffer_dirty(sbi->s_sbh);
        brelse(sbi->s_sbh);
        sb->s_fs_info = NULL;
        kfree(sbi);
}

static struct kmem_cache * v6fs_inode_cachep;

static struct inode *v6fs_alloc_inode(struct super_block *sb)
{
        struct v6fs_inode_info * ei;
        ei = (struct v6fs_inode_info *)
                kmem_cache_alloc(v6fs_inode_cachep, GFP_KERNEL);
        if (!ei)
                return NULL;
        return &ei->vfs_inode;
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

static void init_once(void *foo)
{
        struct v6fs_inode_info * ei = (struct v6fs_inode_info *) foo;
        rwlock_init(&ei->i_meta_lock);
        inode_init_once(&ei->vfs_inode);
}

static int init_inodecache(void)
{
        v6fs_inode_cachep = kmem_cache_create("v6fs_inode_cache",
                                             sizeof(struct v6fs_inode_info),
                                             0, (SLAB_RECLAIM_ACCOUNT|
                                                SLAB_MEM_SPREAD),
                                             init_once);
        if (v6fs_inode_cachep == NULL)
                return -ENOMEM;
        return 0;
}

static void destroy_inodecache(void)
{
        kmem_cache_destroy(v6fs_inode_cachep);
}

static const struct super_operations v6fs_sops = {
        .alloc_inode    = v6fs_alloc_inode,
        .destroy_inode  = v6fs_destroy_inode,
        .write_inode    = v6fs_write_inode,
        .evict_inode    = v6fs_evict_inode,
        .put_super      = v6fs_put_super,
        .statfs         = v6fs_statfs,
        .remount_fs     = v6fs_remount,
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

        if (!sb_set_blocksize(sb, V6FS_BLOCK_SIZE))
                goto out_bad_hblock;

        if (!(bh = sb_bread(sb, 1)))
                goto out_bad_sb;

        vs = (struct v6fs_super_block *) bh->b_data;
        sbi->s_vs       = vs;
        sbi->s_sbh      = bh;
        sbi->s_isize    = vs->s_isize;
        sbi->s_fsize    = vs->s_fsize;
        sbi->s_nfree    = vs->s_nfree;
        sbi->s_ninode   = vs->s_ninode;
        
        sb->s_maxbytes          = V6FS_FILESIZE_MAX;
        sb->s_max_links         = V6FS_LINK_MAX;
        sb->s_magic             = V6FS_MAGIC;

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

struct inode *v6fs_new_inode(const struct inode *dir, umode_t mode, int *err)
{
        // TODO
}

void v6fs_free_inode(struct inode *inode)
{
        // TODO
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
        if (unlikely(ret)) {
                loff_t isize = mapping->host->i_size;
                if (pos + len > isize)
                        vmtruncate(mapping->host, isize);
        }

        return ret;
}

static sector_t v6fs_bmap(struct address_space *mapping, sector_t block)
{
        return generic_block_bmap(mapping, block, v6fs_get_block);
}

static const struct address_space_operations v6fs_aops = {
        .readpage       = v6fs_readpage,
        .writepage      = v6fs_writepage,
        .write_begin    = v6fs_write_begin,
        .write_end      = generic_write_end,
        .bmap           = v6fs_bmap
};

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
        } else
                init_special_inode(inode, inode->i_mode, rdev);
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
        inode->i_mtime.tv_sec = inode->i_ctime.tv_sec = raw_inode->i_mtime;
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

void v6fs_truncate(struct inode *inode)
{
        if (!(S_ISREG(inode->i_mode) || S_ISDIR(inode->i_mode)))
                return;
        // TODO
}

static struct dentry *v6fs_mount(struct file_system_type *fs_type,
        int flags, const char *dev_name, void *data)
{
        return mount_bdev(fs_type, flags, dev_name, data, v6fs_fill_super);
}

static struct file_system_type v6fs_fs_type = {
        .owner          = THIS_MODULE,
        .name           = "v6fs",
        .mount          = v6fs_mount,
        .kill_sb        = kill_block_super,
        .fs_flags       = FS_REQUIRES_DEV,
};

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

MODULE_AUTHOR("Xunzhen Quan <quanxunzhen@gmail.com");
MODULE_DESCRIPTION("Implementation of filesystem of UNIX v6 for Linux");
MODULE_LICENSE("GPL");
module_init(init_v6fs_fs)
module_exit(exit_v6fs_fs)
