# From Claude: action-item lists Claude keeps in HQ

The **From Claude** view (sidebar → ✨ From Claude) shows to-do lists that
Claude files from calls, coaching sessions and project threads. The first list
is the running action items from Predictable Profits calls (1:1s with
Stephanie and the group trainings).

RB works the items in the app (status and notes). Claude adds and updates them
from outside the app. HQ is the source of truth for whether an item is still
open: a Claude session should read the status back here before it reports on
or changes an item.

## Where the data lives

Table `claude_todos` in the HQ Supabase project (schema in
[`supabase/schema.sql`](../supabase/schema.sql), section "CLAUDE TO-DOS").

It is a **separate table on purpose**. The app's save (`BrillDB.saveAll` →
`reconcile`) rewrites `projects`, `project_todos` and `notes` to exactly what
the open app holds and deletes every other row. Anything written straight
into those tables from outside the app is lost on RB's next save. The app
never reconciles `claude_todos`. It only updates one row at a time by id.

## How it is grouped

    list           e.g. "Predictable Profits"
      source + source_date   e.g. "Thu, Nov 5 · Group training: Spark magnets"
        items      ordered by sort_order

The view can also group by status or by owner, filter to one list (tabs), and
show or hide done/dropped items. Those choices are remembered per browser.

## Columns

| column | what to put in it |
|---|---|
| `ext_key` | Stable key Claude upserts by. Format `<list-slug>:<yyyy-mm-dd>:<short-slug>`, e.g. `pp:2026-11-05:cta-price`. Never reuse a key for a different item. |
| `list` | Top-level list. Current lists: `Predictable Profits`, `Brill Marketing`. |
| `source` | Where the item came from, in RB's words: `1:1 with Stephanie: roadmap review`, `Group training: Spark magnets`, `Bi-weekly marketing review`. |
| `source_date` | Date of that call or session (a date, no time). |
| `title` | The action, as a short imperative sentence. |
| `why` | One line on why it matters, so the context survives between calls. |
| `notes` | Longer detail. RB edits this in the app too, so read before overwriting. |
| `status` | `todo`, `in_progress`, `waiting`, `done` or `dropped`. RB changes it in the app. |
| `owner` | Who does it: `RB`, `Claude`, `Lynda`, `Stephanie`, ... |
| `links` | JSON array of `{ "label", "url" }`. http(s) URLs become links; anything else (a NAS path) shows as plain text. |
| `sort_order` | Order inside its source group. |

`updated_at` and `done_at` are kept by a trigger. Don't set them.

## Writing from a Claude session

Use the Supabase connector for the HQ project ("Shared For Small Apps") and
`execute_sql`. The connector bypasses RLS, so `user_id` must be set
explicitly to RB's HQ user id (look it up rather than hard-coding it):

```sql
select id from auth.users where email = 'robert@brillmedia.co';
```

Add or refresh items with an upsert on `(user_id, ext_key)`. Don't overwrite
`status` or `notes` on conflict unless the change is deliberate, because RB
may have changed them in the app:

```sql
insert into claude_todos (user_id, ext_key, list, source, source_date, title, why, owner, links, sort_order)
values
  ('<rb-user-id>', 'pp:2026-11-05:cta-price', 'Predictable Profits',
   'Group training: Spark magnets', '2026-11-05',
   'Take the price off the "Learn about the Diagnostic" CTA box',
   'Joe: just make them click through; justify the price on the next page.',
   'Claude', '[{"label":"Live page","url":"https://brillmedia.co/landing/case-study-ad-template/"}]', 1)
on conflict (user_id, ext_key) do update set
  title = excluded.title, why = excluded.why, owner = excluded.owner,
  links = excluded.links, source = excluded.source, source_date = excluded.source_date,
  sort_order = excluded.sort_order;
```

Change a status only when Claude did the work (or RB said so in a thread):

```sql
update claude_todos set status = 'done' where ext_key = 'pp:2026-11-05:cta-price';
```

Read back what is open, newest call first:

```sql
select list, source_date, source, title, status, owner, notes
from claude_todos
where status not in ('done','dropped')
order by list, source_date desc, sort_order;
```

The app polls every 30 seconds, so new items show up without a reload.
