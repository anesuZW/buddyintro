# Execution Plan Summary

**Generated:** 2026-07-26T06:37:26.870Z  
**Connection:** postgresql://postgres.***:***@aws-1-us-east-1.pooler.supabase.com:5432/postgres  
**Method:** EXPLAIN (ANALYZE, BUFFERS) via DIRECT_URL

---

## Summary

SQL execution time on PostgreSQL is **orders of magnitude lower** than Prisma-reported latency through the pooler. Slow `[prisma:slow]` logs measure **ORM + network**, not query planner cost alone.

| Query | Execution | Planning | Scan types | Notes |
| --- | --- | --- | --- | --- |
| AdminSettings.findUnique | 0.066ms | 0.741ms | Index Scan | — |
| User.findUnique | 0.052ms | 0.636ms | Index Scan | — |
| Story.findMany (published) | 0.178ms | 0.495ms | Seq Scan, Sort | Sequential scan detected — verify index coverage for WHERE/JOIN columns |
| StoryTag.findMany (tagged_user_id) | 0.049ms | 0.576ms | Seq Scan | Sequential scan detected — verify index coverage for WHERE/JOIN columns |
| DiscoveriesPost.findMany | 0.047ms | 0.325ms | Seq Scan, Sort | Sequential scan detected — verify index coverage for WHERE/JOIN columns |
| Notification.count (unread) | 0.136ms | 0.457ms | Index Scan | — |
| Message.count (unread) | 0.063ms | 0.471ms | Index Scan, Bitmap Heap Scan, Bitmap Index Scan | — |
| SharedIntroducerRelationship.findMany | 0.06ms | 0.353ms | Index Scan, Bitmap Heap Scan, Bitmap Index Scan | — |
| Story.count (intro badge pattern) | 0.077ms | 0.821ms | Seq Scan, Index Only Scan, Nested Loop | Sequential scan detected — verify index coverage for WHERE/JOIN columns |

---

## Full EXPLAIN ANALYZE Output

### AdminSettings.findUnique

```
Index Scan using admin_settings_pkey on admin_settings  (cost=0.15..2.37 rows=1 width=117) (actual time=0.016..0.017 rows=1 loops=1)
  Index Cond: (id = 1)
  Buffers: shared hit=2
Planning:
  Buffers: shared hit=215
Planning Time: 0.741 ms
Execution Time: 0.066 ms
```

### User.findUnique

```
Index Scan using users_pkey on users  (cost=0.15..2.37 rows=1 width=249) (actual time=0.018..0.019 rows=1 loops=1)
  Index Cond: (id = '9fd1cd19-bff7-47fe-af71-ef001816dc07'::uuid)
  Buffers: shared hit=2
Planning:
  Buffers: shared hit=174
Planning Time: 0.636 ms
Execution Time: 0.052 ms
```

### Story.findMany (published)

```
Limit  (cost=8.33..8.38 rows=20 width=256) (actual time=0.134..0.139 rows=20 loops=1)
  Buffers: shared hit=7
  ->  Sort  (cost=8.33..8.60 rows=110 width=256) (actual time=0.133..0.135 rows=20 loops=1)
        Sort Key: created_at DESC
        Sort Method: top-N heapsort  Memory: 37kB
        Buffers: shared hit=7
        ->  Seq Scan on stories  (cost=0.00..5.40 rows=110 width=256) (actual time=0.019..0.063 rows=66 loops=1)
              Filter: (status = 'published'::"StoryStatus")
              Rows Removed by Filter: 4
              Buffers: shared hit=4
Planning:
  Buffers: shared hit=135
Planning Time: 0.495 ms
Execution Time: 0.178 ms
```

### StoryTag.findMany (tagged_user_id)

```
Limit  (cost=0.00..1.71 rows=1 width=128) (actual time=0.027..0.027 rows=0 loops=1)
  Buffers: shared hit=1
  ->  Seq Scan on story_tags  (cost=0.00..1.71 rows=1 width=128) (actual time=0.026..0.026 rows=0 loops=1)
        Filter: (tagged_user_id = '9fd1cd19-bff7-47fe-af71-ef001816dc07'::uuid)
        Rows Removed by Filter: 71
        Buffers: shared hit=1
Planning:
  Buffers: shared hit=156
Planning Time: 0.576 ms
Execution Time: 0.049 ms
```

### DiscoveriesPost.findMany

```
Limit  (cost=25.50..25.53 rows=11 width=140) (actual time=0.021..0.024 rows=11 loops=1)
  Buffers: shared hit=1
  ->  Sort  (cost=25.50..26.70 rows=480 width=140) (actual time=0.020..0.022 rows=11 loops=1)
        Sort Key: created_at DESC
        Sort Method: quicksort  Memory: 27kB
        Buffers: shared hit=1
        ->  Seq Scan on discoveries_posts  (cost=0.00..14.80 rows=480 width=140) (actual time=0.009..0.010 rows=13 loops=1)
              Buffers: shared hit=1
Planning:
  Buffers: shared hit=83
Planning Time: 0.325 ms
Execution Time: 0.047 ms
```

### Notification.count (unread)

```
Aggregate  (cost=26.86..26.87 rows=1 width=8) (actual time=0.077..0.078 rows=1 loops=1)
  Buffers: shared hit=20
  ->  Index Scan using notifications_user_id_idx on notifications  (cost=0.14..26.72 rows=56 width=0) (actual time=0.016..0.068 rows=69 loops=1)
        Index Cond: (user_id = '9fd1cd19-bff7-47fe-af71-ef001816dc07'::uuid)
        Filter: (read_at IS NULL)
        Buffers: shared hit=20
Planning:
  Buffers: shared hit=101
Planning Time: 0.457 ms
Execution Time: 0.136 ms
```

### Message.count (unread)

```
Aggregate  (cost=4.45..4.46 rows=1 width=8) (actual time=0.017..0.018 rows=1 loops=1)
  Buffers: shared hit=1
  ->  Bitmap Heap Scan on messages  (cost=1.27..4.44 rows=1 width=0) (actual time=0.014..0.014 rows=0 loops=1)
        Recheck Cond: (receiver_id = '9fd1cd19-bff7-47fe-af71-ef001816dc07'::uuid)
        Filter: (read_at IS NULL)
        Buffers: shared hit=1
        ->  Bitmap Index Scan on messages_receiver_id_sender_id_created_at_idx  (cost=0.00..1.27 rows=3 width=0) (actual time=0.009..0.009 rows=0 loops=1)
              Index Cond: (receiver_id = '9fd1cd19-bff7-47fe-af71-ef001816dc07'::uuid)
              Buffers: shared hit=1
Planning:
  Buffers: shared hit=104
Planning Time: 0.471 ms
Execution Time: 0.063 ms
```

### SharedIntroducerRelationship.findMany

```
Limit  (cost=4.39..5.50 rows=1 width=104) (actual time=0.021..0.022 rows=0 loops=1)
  Buffers: shared hit=2
  ->  Bitmap Heap Scan on shared_introducer_relationships  (cost=4.39..5.50 rows=1 width=104) (actual time=0.020..0.021 rows=0 loops=1)
        Recheck Cond: ((user_a_id = '9fd1cd19-bff7-47fe-af71-ef001816dc07'::uuid) OR (user_b_id = '9fd1cd19-bff7-47fe-af71-ef001816dc07'::uuid))
        Buffers: shared hit=2
        ->  BitmapOr  (cost=4.39..4.39 rows=1 width=0) (actual time=0.014..0.014 rows=0 loops=1)
              Buffers: shared hit=2
              ->  Bitmap Index Scan on shared_introducer_relationships_user_a_id_user_b_id_shared__key  (cost=0.00..1.25 rows=1 width=0) (actual time=0.007..0.007 rows=0 loops=1)
                    Index Cond: (user_a_id = '9fd1cd19-bff7-47fe-af71-ef001816dc07'::uuid)
                    Buffers: shared hit=1
              ->  Bitmap Index Scan on shared_introducer_relationships_user_a_id_user_b_id_shared__key  (cost=0.00..3.14 rows=1 width=0) (actual time=0.006..0.006 rows=0 loops=1)
                    Index Cond: (user_b_id = '9fd1cd19-bff7-47fe-af71-ef001816dc07'::uuid)
                    Buffers: shared hit=1
Planning:
  Buffers: shared hit=87
Planning Time: 0.353 ms
Execution Time: 0.060 ms
```

### Story.count (intro badge pattern)

```
Aggregate  (cost=4.11..4.12 rows=1 width=8) (actual time=0.028..0.029 rows=1 loops=1)
  Buffers: shared hit=1
  ->  Nested Loop  (cost=0.14..4.11 rows=1 width=0) (actual time=0.025..0.026 rows=0 loops=1)
        Buffers: shared hit=1
        ->  Seq Scan on story_tags t  (cost=0.00..1.71 rows=1 width=16) (actual time=0.025..0.025 rows=0 loops=1)
              Filter: (tagged_user_id = '9fd1cd19-bff7-47fe-af71-ef001816dc07'::uuid)
              Rows Removed by Filter: 71
              Buffers: shared hit=1
        ->  Index Only Scan using stories_pkey on stories s  (cost=0.14..2.36 rows=1 width=16) (never executed)
              Index Cond: (id = t.story_id)
              Heap Fetches: 0
Planning:
  Buffers: shared hit=146
Planning Time: 0.821 ms
Execution Time: 0.077 ms
```

