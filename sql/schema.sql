-- M46 Supabase Schema (Phase 2)

-- USERS --------------------------------------------------------------------
create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  handle text unique not null check (handle ~ '^[a-z0-9_\\-]{3,30}$'),
  display_name text not null default '',
  save_mode boolean not null default false,
  age_mode boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists user_follow_tags (
  user_id uuid references app_users(id) on delete cascade,
  tag text not null,
  position smallint not null default 0,
  primary key (user_id, tag)
);

create table if not exists user_mute_tags (
  user_id uuid references app_users(id) on delete cascade,
  tag text not null,
  primary key (user_id, tag)
);

create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references app_users(id) on delete cascade,
  email text not null check (position('@' in email) > 1),
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists creator_profiles (
  user_id uuid primary key references app_users(id) on delete cascade,
  display_name text not null,
  avatar text,
  bio text,
  tagline text,
  updated_at timestamptz not null default now()
);

create table if not exists account_passkeys (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references accounts(id) on delete cascade,
  credential_id text unique not null,
  transports text[] not null default '{}',
  backed_up boolean not null default false,
  device_label text not null,
  attestation_object bytea,
  client_data_hash text not null,
  created_at timestamptz not null default now()
);

-- POSTS ---------------------------------------------------------------------
create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references app_users(id) on delete cascade,
  title text not null,
  description text not null,
  storage_key text not null check (storage_key ~ '^https?://'),
  duration_seconds smallint not null check (duration_seconds between 1 and 30),
  resolution text not null check (
    resolution ~ '^[0-9]+x[0-9]+$'
    and (split_part(resolution, 'x', 2)::int) >= (split_part(resolution, 'x', 1)::int)
    and (split_part(resolution, 'x', 1)::int) >= 360
    and (split_part(resolution, 'x', 2)::int) between 640 and 2400
  ),
  ai_score numeric(5,2) not null default 0,
  sensitive boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists post_stats (
  post_id uuid primary key references posts(id) on delete cascade,
  views bigint not null default 0,
  watch_seconds bigint not null default 0,
  bookmarks bigint not null default 0,
  follows bigint not null default 0,
  popularity numeric(7,2) not null default 0
);

create table if not exists ai_tags (
  post_id uuid references posts(id) on delete cascade,
  tag text not null,
  trust numeric(4,2) not null default 0,
  created_at timestamptz not null default now(),
  primary key (post_id, tag)
);

create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references posts(id) on delete cascade,
  author_id uuid references app_users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists bookmarks (
  user_id uuid references app_users(id) on delete cascade,
  post_id uuid references posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create table if not exists follows (
  user_id uuid references app_users(id) on delete cascade,
  creator_handle text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, creator_handle)
);

-- SESSIONS ------------------------------------------------------------------
create table if not exists app_sessions (
  token text primary key,
  user_id uuid references app_users(id) on delete cascade,
  expires_at timestamptz not null
);

create index if not exists idx_app_sessions_user on app_sessions(user_id);

-- FUNCTIONS -----------------------------------------------------------------
create or replace function recompute_popularity(p_post uuid) returns void as $$
update post_stats
set popularity = (views * 0.4 + bookmarks * 0.3 + follows * 0.2 + (watch_seconds / 60.0) * 0.1)
where post_id = p_post;
$$ language sql;

create or replace function feed_default()
returns table(
  id uuid,
  title text,
  description text,
  duration_seconds smallint,
  resolution text,
  storage_key text,
  tags text[],
  popularity numeric,
  author_handle text,
  author_display text,
  author_avatar text,
  created_at timestamptz
) as $$
  select
    p.id,
    p.title,
    p.description,
    p.duration_seconds,
    p.resolution,
    p.storage_key,
    coalesce(array_agg(t.tag order by t.trust desc) filter (where t.tag is not null), '{}') as tags,
    ps.popularity,
    u.handle as author_handle,
    coalesce(cp.display_name, u.handle) as author_display,
    cp.avatar as author_avatar,
    p.created_at
  from posts p
  join app_users u on u.id = p.owner_id
  left join creator_profiles cp on cp.user_id = u.id
  left join ai_tags t on t.post_id = p.id
  left join post_stats ps on ps.post_id = p.id
  group by p.id, ps.popularity, u.handle, cp.display_name, cp.avatar
  order by ps.popularity desc nulls last, p.created_at desc
  limit 60;
$$ language sql stable;

create or replace function feed_by_tag(p_tag text)
returns table(
  id uuid,
  title text,
  description text,
  duration_seconds smallint,
  resolution text,
  storage_key text,
  tags text[],
  popularity numeric,
  author_handle text,
  author_display text,
  author_avatar text,
  created_at timestamptz
) as $$
  select *
  from feed_default()
  where p_tag = any(tags);
$$ language sql stable;

-- ---------------------------------------------------------------------------
-- RLS / PERFORMANCE SAFETY FOR MCP CLIENTS
-- SupabaseMCP から参照/更新する際に余計な失敗を避けるため、
-- 主要テーブルの RLS を無効化し、よく使う列へインデックスを張る
-- ---------------------------------------------------------------------------
alter table if exists app_users disable row level security;
alter table if exists accounts disable row level security;
alter table if exists creator_profiles disable row level security;
alter table if exists account_passkeys disable row level security;
alter table if exists posts disable row level security;
alter table if exists post_stats disable row level security;
alter table if exists ai_tags disable row level security;
alter table if exists comments disable row level security;
alter table if exists bookmarks disable row level security;
alter table if exists follows disable row level security;
alter table if exists app_sessions disable row level security;

create index if not exists idx_posts_owner_id on posts(owner_id);
create index if not exists idx_posts_created_at on posts(created_at desc);
create index if not exists idx_ai_tags_tag on ai_tags(tag);
create index if not exists idx_ai_tags_post on ai_tags(post_id);
create index if not exists idx_post_stats_popularity on post_stats(popularity desc);
