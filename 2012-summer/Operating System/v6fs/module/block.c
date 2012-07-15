#include <linux/buffer_head.h>
#include <linux/slab.h>
#include "v6fs.h"

#define DEPTH 3

typedef struct {
	block_t *p;
	block_t key;
	struct buffer_head *bh;
} Indirect;

long v6fs_new_block(struct inode *inode)
{
	struct super_block * sb = inode->i_sb;
	struct v6fs_sb_info * sbi = v6fs_sb(sb);
	block_t new_block = 0;

	mutex_lock(&sbi->s_free_lock);
	if (!sbi->s_nfree)
		goto out;
	sbi->s_nfree--;
	new_block = sbi->s_free[sbi->s_nfree];
	sbi->s_free[sbi->s_nfree] = 0;
	if (sbi->s_nfree == 0) {
		struct buffer_head * bh;
		block_t * free_blocks;
		int i;

		if (!new_block)
			goto out;

		bh = sb_bread(sb, new_block);
		if (!bh)
			goto out;
		free_blocks = (block_t *) bh->b_data;
		sbi->s_nfree = free_blocks[0];
		for (i = 0; i < sbi->s_nfree; i++)
			sbi->s_free[i] = free_blocks[i + 1];
		brelse(bh);
	}
	sb->s_dirt = 1;

out:
	mutex_unlock(&sbi->s_free_lock);
	return new_block;
}

void v6fs_free_block(struct inode *inode, block_t block)
{
	struct super_block * sb = inode->i_sb;
	struct v6fs_sb_info * sbi = v6fs_sb(sb);

	mutex_lock(&sbi->s_free_lock);
	if (sbi->s_nfree == 100) {
		struct buffer_head * bh;
		block_t * free_blocks;
		int i;

		bh = sb_getblk(sb, block);
		lock_buffer(bh);
		free_blocks = (block_t *) bh->b_data;
		free_blocks[0] = sbi->s_nfree;
		for (i = 0; i < sbi->s_nfree; i++) {
			free_blocks[i + 1] = sbi->s_free[i];
			sbi->s_free[i] = 0;
		}
		set_buffer_uptodate(bh);
		unlock_buffer(bh);
		mark_buffer_dirty_inode(bh, inode);
		brelse(bh);
		sbi->s_nfree = 0;
	}
	sbi->s_free[sbi->s_nfree++] = block;
	sb->s_dirt = 1;
	mutex_unlock(&sbi->s_free_lock);
}

static int v6fs_block_to_path(struct inode *inode,
		block_t block, int offsets[DEPTH])
{
	int n = 0;
	char b[BDEVNAME_SIZE];

	if (block < 0) {
		printk("V6FS: block_to_path: block %d < 0 on dev %s\n",
			block, bdevname(inode->i_sb->s_bdev, b));
	} else if (block >= V6FS_FILESIZE_MAX / V6FS_BLOCK_SIZE) {
		printk("V6FS: block_to_path: block %d too big on dev %s\n",
			block, bdevname(inode->i_sb->s_bdev, b));
	} else if (!V6FS_ISLARG(v6fs_i(inode)->i_mode)) {
		/* we will let who call this to deal with extending */
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

static Indirect *v6fs_get_branch(struct inode *inode, int depth, int *offsets,
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

static int v6fs_alloc_branch(struct inode *inode,
		int num, int *offsets, Indirect *branch)
{
	int n = 0;
	int i;
	int parent = v6fs_new_block(inode);

	branch[0].key = parent;
	if (parent)
		for (n = 1; n < num; n++) {
			struct buffer_head * bh;
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

static inline int v6fs_splice_branch(struct inode *inode,
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

/*
 * v6fs_block_extend() extend inode from small file to large file
 */
inline int v6fs_block_extend(struct inode *inode)
{
	int nr, i;
	struct buffer_head * bh;
	block_t * p;
	block_t * i_data;

	nr = v6fs_new_block(inode);
	if (!nr)
		return -ENOSPC;
	i_data = v6fs_i(inode)->i_data;

	bh = sb_getblk(inode->i_sb, nr);
	if (!bh)
		return -EIO;
	lock_buffer(bh);
	memset(bh->b_data, 0, V6FS_BLOCK_SIZE);
	p = (block_t *) bh->b_data;
	for (i = 0; i < 8; i++) {
		p[i] = i_data[i];
		i_data[i] = 0;
	}
	set_buffer_uptodate(bh);
	unlock_buffer(bh);
	v6fs_i(inode)->i_mode |= V6FS_IFLARG;
	i_data[0] = nr;
	mark_buffer_dirty_inode(bh, inode);
	brelse(bh);

	return 0;
}

int v6fs_get_block(struct inode *inode, sector_t block,
		struct buffer_head *bh, int create)
{
	int err = -EIO;
	int offsets[DEPTH];
	Indirect chain[DEPTH];
	Indirect *partial;
	int left;
	int depth = v6fs_block_to_path(inode, block, offsets);

	if (depth == 1 && offsets[0] >= 8) {
		if (!create)
			goto out;
		err = v6fs_block_extend(inode);
		if (err)
			goto out;
		depth = v6fs_block_to_path(inode, block, offsets);
	}

	if (depth == 0)
		goto out;

reread:
	partial = v6fs_get_branch(inode, depth, offsets, chain, &err);
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
	err = v6fs_alloc_branch(inode, left, offsets + (partial - chain), partial);
	if (err)
		goto cleanup;

	if (v6fs_splice_branch(inode, chain, partial, left) < 0)
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

static inline int all_zeroes(block_t *p, block_t *q)
{
	for (; p < q && !*p; p++)
		;
	return p == q;
}

static Indirect *v6fs_find_shared(struct inode *inode, int depth,
		int offsets[DEPTH], Indirect chain[DEPTH], block_t *top)
{
	Indirect * partial, * p;
	int k, err;
	rwlock_t * i_meta_lock = &v6fs_i(inode)->i_meta_lock;

	*top = 0;
	for (k = depth; k > 1 && !offsets[k - 1]; k--)
		;
	partial = v6fs_get_branch(inode, k, offsets, chain, &err);
	if (!partial)
		partial = chain + k - 1;
	
	write_lock(i_meta_lock);
	if (!partial->key && *partial->p) {
		write_unlock(i_meta_lock);
		goto no_top;
	}
	for (p = partial;
			p > chain &&
			all_zeroes((block_t *) p->bh->b_data, p->p);
			p--)
		;

	if (p == chain + k - 1 && p > chain)
		p->p--;         /* XXX why??? */
	else {
		*top = *p->p;
		*p->p = 0;
	}
	write_unlock(i_meta_lock);

	while (partial > p) {
		brelse(partial->bh);
		partial--;
	}
no_top:
	return partial;
}

static void v6fs_free_data(struct inode *inode, block_t *p, block_t *q)
{
	block_t nr;

	for (; p < q; p++) {
		nr = *p;
		if (nr) {
			*p = 0;
			v6fs_free_block(inode, nr);
			mark_inode_dirty(inode);
		}
	}
}

static void v6fs_free_branches(struct inode *inode,
		block_t *p, block_t *q, int depth)
{
	struct buffer_head * bh;
	block_t nr;
	block_t * i_data;

	if (depth--) {
		for (; p < q; p++) {
			nr = *p;
			if (!nr)
				continue;
			*p = 0;
			bh = sb_bread(inode->i_sb, nr);
			if (!bh) {
				printk("V6FS: free_branches: "
					"inode=%lu, block=%u read failed",
					inode->i_ino, nr);
				continue;
			}
			i_data = (block_t *) bh->b_data;
			v6fs_free_branches(inode,
					i_data, i_data + (1 << 8), depth);
			bforget(bh);
			v6fs_free_block(inode, nr);
			mark_inode_dirty(inode);
		}
	} else {
		v6fs_free_data(inode, p, q);
	}
}

void v6fs_truncate_blocks(struct inode *inode, loff_t offset)
{
	struct super_block * sb = inode->i_sb;
	struct v6fs_inode_info * vi = v6fs_i(inode);
	block_t * i_data = vi->i_data;
	int offsets[DEPTH];
	Indirect chain[DEPTH];
	Indirect *partial;
	block_t block = (offset + sb->s_blocksize - 1) >> sb->s_blocksize_bits;
	block_t nr;
	int depth;
	int i;

	depth = v6fs_block_to_path(inode, block, offsets);
	if (depth == 0)
		return;

	if (depth == 1) {
		v6fs_free_data(inode, i_data + block, i_data + 8);
		return;
	}

	partial = v6fs_find_shared(inode, depth, offsets, chain, &nr);
	if (nr) {
		if (partial == chain)
			mark_inode_dirty(inode);
		else
			mark_buffer_dirty_inode(partial->bh, inode);
		v6fs_free_branches(inode, &nr, &nr + 1,
				(chain + depth - 1) - partial);
	}

	for (; partial > chain; partial--) {
		v6fs_free_branches(inode,
				partial->p + 1,
				(block_t *) partial->bh->b_data + (1 << 8),
				(chain + depth - 1) - partial);
		mark_buffer_dirty_inode(partial->bh, inode);
		brelse(partial->bh);
	}

	switch (offsets[0]) {
	default:
		for (i = offsets[0] + 1; i < 7; i++) {
			nr = i_data[i];
			if (nr) {
				i_data[i] = 0;
				mark_inode_dirty(inode);
				v6fs_free_branches(inode, &nr, &nr + 1, 1);
			}
		}
	case 6:
		nr = i_data[7];
		if (nr) {
			i_data[7] = 0;
			mark_inode_dirty(inode);
			v6fs_free_branches(inode, &nr, &nr + 1, 2);
		}
	case 7:
		;
	}
	inode->i_ctime = CURRENT_TIME_SEC;
}

int v6fs_count_free_blocks(struct super_block *sb)
{
	struct v6fs_sb_info * sbi = v6fs_sb(sb);
	struct buffer_head * bh;
	block_t next_block;
	block_t * idata;
	int result;

	result = sbi->s_nfree;
	next_block = sbi->s_free[0];
	if (!next_block)
		result = 0;
	while (next_block) {
		bh = sb_bread(sb, next_block);
		if (!bh)
			break;
		idata = (block_t *) bh->b_data;
		result += idata[0];
		next_block = idata[1];
		brelse(bh);
	}

	return result;
}
