-- Brill HQ Todo — Supabase schema (normalized, per-item, row-level security)
-- Run this in the Supabase dashboard → SQL Editor. Safe to re-run.
-- Single-user model: every row is owned by auth.uid(); RLS keeps it private.

-- ============ PROJECTS ============
create table if not exists projects (
  id          text primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text default '',
  status      text default 'Active',       -- Active | Paused | Done
  owner       text default '',
  due         text default '',
  notes       text default '',
  personal    boolean default false,
  ai          boolean default false,       -- AI Projects group
  archived    boolean default false,
  is_template boolean default false,
  pinned      boolean default false,       -- favorited / pinned to the top
  sort_order  double precision default 0,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ============ PROJECT TO-DOS ============
create table if not exists project_todos (
  id          text primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id  text not null references projects(id) on delete cascade,
  body        text default '',             -- the to-do text
  completed   boolean default false,
  urgency     text default 'medium',       -- low | medium | high
  notes       text default '',
  sort_order  double precision default 0,
  created_at  timestamptz default now()
);
create index if not exists project_todos_project_idx on project_todos(project_id);

-- ============ LONG NOTES ============
create table if not exists notes (
  id          text primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title       text default '',
  body        text default '',             -- rich-text HTML
  grp         text default '',             -- group / heading ("group" is a reserved word)
  archived    boolean default false,
  pinned      boolean default false,       -- favorited / pinned to the top
  sort_order  double precision default 0,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- For databases created before the "pinned" columns existed (safe to re-run):
alter table projects add column if not exists pinned boolean default false;
alter table notes    add column if not exists pinned boolean default false;

-- ============ FILES (metadata; blobs live in the 'uploads' Storage bucket) ============
create table if not exists files (
  id           text primary key,
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name         text default '',
  ext          text default '',
  size         bigint default 0,
  mime         text default '',
  project_id   text references projects(id) on delete cascade,
  note_id      text references notes(id) on delete cascade,
  storage_path text default '',            -- path within the uploads bucket
  content_text text default '',            -- extracted text, for in-file search
  uploaded_at  timestamptz default now()
);
create index if not exists files_search_idx
  on files using gin (to_tsvector('english', coalesce(name,'') || ' ' || coalesce(content_text,'')));

-- ============ INBOX (AI intake) ============
create table if not exists inbox (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  task       text not null,
  priority   text default 'normal',        -- urgent | high | normal | low
  project    text default '',              -- optional target project name (AI Projects)
  notes      text default '',
  routed     boolean default false,        -- filed into a project yet?
  added      timestamptz default now()
);

-- ============ LEGACY TASK OVERRIDES ============
-- The "Tasks" view still reads its base task list from the static todo-data.js;
-- these rows override state per positional key ("sectionId::index").
create table if not exists task_overrides (
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  task_key    text not null,
  completed   boolean default false,
  edited_text text,
  note        text,
  deleted     boolean default false,
  archived    boolean default false,       -- hidden from the active Tasks view, kept under "Archived"
  primary key (user_id, task_key)
);
alter table task_overrides add column if not exists archived boolean default false;

-- ============ ROW LEVEL SECURITY ============
alter table projects       enable row level security;
alter table project_todos  enable row level security;
alter table notes          enable row level security;
alter table files          enable row level security;
alter table inbox          enable row level security;
alter table task_overrides enable row level security;

do $$
declare t text;
begin
  foreach t in array array['projects','project_todos','notes','files','inbox','task_overrides'] loop
    execute format('drop policy if exists own_all on %I;', t);
    execute format(
      'create policy own_all on %I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());', t);
  end loop;
end $$;

-- ============ STORAGE (file uploads) ============
insert into storage.buckets (id, name, public) values ('uploads','uploads', false)
  on conflict (id) do nothing;

drop policy if exists uploads_own on storage.objects;
create policy uploads_own on storage.objects for all to authenticated
  using (bucket_id = 'uploads' and owner = auth.uid())
  with check (bucket_id = 'uploads' and owner = auth.uid());

-- ============ REMINDERS ============
-- Set from the Assistant ("remind me Friday at 9 to...") or the Reminders view.
-- Delivered either in-app (the open app polls for due rows and shows a toast +
-- browser notification) or by Web Push from api/send-reminders.js (a Vercel
-- cron, using the service-role key) to the devices in push_subscriptions.
create table if not exists reminders (
  id            text primary key,
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title         text not null,
  notes         text default '',
  due_at        timestamptz not null,
  repeat        text default 'none',       -- none | daily | weekdays | weekly | monthly
  fired_at      timestamptz,               -- when it was delivered (null = still pending)
  last_fired_at timestamptz,               -- most recent delivery (repeating reminders keep going)
  fired_via     text default '',           -- app | push
  done          boolean default false,     -- dismissed by the user
  project_id    text default '',           -- optional link back to a project (no FK: deleting the project keeps the reminder)
  note_id       text default '',           -- optional link back to a long note
  created_at    timestamptz default now()
);
create index if not exists reminders_pending_idx on reminders(due_at) where fired_at is null and done = false;
create index if not exists reminders_user_idx on reminders(user_id);

-- ============ PUSH SUBSCRIPTIONS (one row per device that enabled notifications) ============
create table if not exists push_subscriptions (
  id            text primary key,
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint      text not null unique,      -- the push service URL; also the natural key
  subscription  jsonb not null,            -- full PushSubscription JSON (endpoint + keys), what web-push needs
  user_agent    text default '',
  created_at    timestamptz default now(),
  last_seen_at  timestamptz default now()
);
create index if not exists push_subscriptions_user_idx on push_subscriptions(user_id);

alter table reminders          enable row level security;
alter table push_subscriptions enable row level security;

do $$
declare t text;
begin
  foreach t in array array['reminders','push_subscriptions'] loop
    execute format('drop policy if exists own_all on %I;', t);
    execute format(
      'create policy own_all on %I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());', t);
  end loop;
end $$;
