#include <linux/buffer_head.h>
#include <linux/slab.h>
#include "v6fs.h"

#define DEPTH 3

typedef struct {
        block_t *p;
        block_t key;
        struct buffer_head *bh;
} Indirect;

int v6fs_new_block(struct inode *inode)
{
        // TODO
}

void v6fs_free_block(struct inode *inode, unsigned long block)
{
        // TODO
}

static int block_to_path(struct inode *inode, long block, int offsets[DEPTH])
{
        struct v6fs_inode_info * v6fs_inode = v6fs_i(inode);
        int n = 0;
        char b[BDEVNAME_SIZE];

        if (block < 0) {
                printk("V6FS: block_to_path: block %ld < 0 on dev %s\n",
                        block, bdevname(inode->i_sb->s_bdev, b));
        } else if (block >= V6FS_FILESIZE_MAX / V6FS_BLOCK_SIZE) {
                printk("V6FS: block_to_path: block %ld too big on dev %s\n",
                        block, bdevname(inode->i_sb->s_bdev, b));
        } else if (!V6FS_ISLARG(v6fs_inode->i_mode)) {
                if (block < 8)
                        offsets[n++] = block;
        } else {
                if (block < (7 << 8)) {
                        offsets[n++] = block >> 8;
                        offsets[n++] = block & ((1 << 8) - 1);
                } else {
                        block -= 7 << 8;
                        offsets[n++] = 7;
                        offsets[n++] = block >> 8;
                        offsets[n++] = block & ((1 << 8) - 1);
                }
        }
        return n;
}

static inline void add_chain(Indirect *p, struct buffer_head *bh, block_t *v)
{
        p->key = *(p->p = v);
        p->bh = bh;
}

static inline int verify_chain(Indirect *from, Indirect *to)
{
        while (from <= to && from->key == *from->p)
                from++;
        return (from > to);
}

static Indirect *get_branch(struct inode *inode, int depth, int *offsets,
                Indirect chain[DEPTH], int *err)
{
        struct super_block *sb = inode->i_sb;
        Indirect *p = chain;
        struct buffer_head *bh;
        
        *err = 0;
        add_chain(chain, NULL, v6fs_i(inode)->i_data + *offsets);
        if (!p->key)
                goto no_block;
        while (--depth) {
                bh = sb_bread(sb, p->key);
                if (!bh)
                        goto failure;
                read_lock(&v6fs_i(inode)->i_meta_lock);
                if (!verify_chain(chain, p))
                        goto changed;
                add_chain(++p, bh, (block_t *) bh->b_data + *++offsets);
                read_unlock(&v6fs_i(inode)->i_meta_lock);
                if (!p->key)
                        goto no_block;
        }
        return NULL;
        
changed:
        read_unlock(&v6fs_i(inode)->i_meta_lock);
        brelse(bh);
        *err = -EAGAIN;
        goto no_block;
failure:
        *err = -EIO;
no_block:
        return p;
}

static int alloc_branch(struct inode *inode,
                int num, int *offsets, Indirect *branch)
{
        int n = 0;
        int i;
        int parent = v6fs_new_block(inode);
        
        branch[0].key = parent;
        if (parent)
                for (n = 1; n < num; n++) {
                        struct buffer_head *bh;
                        int nr = v6fs_new_block(inode);
                        if (!nr)
                                break;
                        branch[n].key = nr;
                        bh = sb_getblk(inode->i_sb, parent);
                        lock_buffer(bh);
                        memset(bh->b_data, 0, bh->b_size);
                        branch[n].bh = bh;
                        branch[n].p = (block_t *) bh->b_data + offsets[n];
                        *branch[n].p = branch[n].key;
                        set_buffer_uptodate(bh);
                        unlock_buffer(bh);
                        mark_buffer_dirty_inode(bh, inode);
                        parent = nr;
                }
        if (n == num)
                return 0;
        
        for (i = 1; i < n; i++)
                bforget(branch[i].bh);
        for (i = 0; i < n; i++)
                v6fs_free_block(inode, branch[i].key);
        return -ENOSPC;
}

static inline int splice_branch(struct inode *inode,
                Indirect chain[DEPTH], Indirect *where, int num)
{
        int i;
        
        write_lock(&v6fs_i(inode)->i_meta_lock);
        if (!verify_chain(chain, where - 1) || *where->p)
                goto changed;
        *where->p = where->key;
        write_unlock(&v6fs_i(inode)->i_meta_lock);
               
        inode->i_ctime = CURRENT_TIME_SEC;
        
        if (where->bh)
                mark_buffer_dirty_inode(where->bh, inode);
        mark_inode_dirty(inode);
        return 0;

changed:
        write_unlock(&v6fs_i(inode)->i_meta_lock);
        for (i = 1; i < num; i++)
                bforget(where[i].bh);
        for (i = 0; i < num; i++)
                v6fs_free_block(inode, where[i].key);
        return -EAGAIN;
}

int v6fs_get_block(struct inode *inode, sector_t block,
                struct buffer_head *bh, int create)
{
        int err = -EIO;
        int offsets[DEPTH];
        Indirect chain[DEPTH];
        Indirect *partial;
        int left;
        int depth = block_to_path(inode, block, offsets);

        if (depth == 0)
                goto out;
        
reread:
        partial = get_branch(inode, depth, offsets, chain, &err);
        if (!partial) {
got_it:
                map_bh(bh, inode->i_sb, chain[depth - 1].key);
                partial = chain + depth - 1;
                goto cleanup;
        }

        if (!create || err == -EIO)
                goto cleanup;

        if (err == -EAGAIN)
                goto changed;
        
        left = (chain + depth) - partial;
        err = alloc_branch(inode, left, offsets + (partial - chain), partial);
        if (err)
                goto cleanup;

        if (splice_branch(inode, chain, partial, left) < 0)
                goto changed;

        set_buffer_new(bh);
        goto got_it;

changed:
        while (partial > chain) {
                brelse(partial->bh);
                partial--;
        }
        goto reread;

cleanup:
        while (partial > chain) {
                brelse(partial->bh);
                partial--;
        }
out:
        return err;
}
