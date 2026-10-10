-- Recipes table + public image bucket for JB's Kitchen.
-- Shape mirrors @recipes/shared RecipeSchema: slug/category/title are columns
-- (routing + indexing); everything else lives in `body` jsonb.
-- The API uses the service role (bypasses RLS); the policies below govern
-- direct anon / signed-in access (read-only).

create table public.recipes (
  id         uuid primary key default gen_random_uuid(),
  slug       text   not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  -- path segments, e.g. {dinner,salad}; every segment is a kebab slug
  category   text[] not null check (
    cardinality(category) >= 1
    and array_to_string(category, '/') ~ '^[a-z0-9]+(-[a-z0-9]+)*(/[a-z0-9]+(-[a-z0-9]+)*)*$'
  ),
  title      text   not null check (length(title) > 0),
  -- subtitle, prepTime, cookTime, totalTime, serves, ingredients, instructions,
  -- tips, image (storage key in bucket recipe-images), source_url
  body       jsonb  not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recipes_category_slug_key unique (category, slug)
);

-- prefix/containment lookups for the category tree
create index recipes_category_idx on public.recipes using gin (category);

create function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger recipes_set_updated_at
  before update on public.recipes
  for each row execute function public.set_updated_at();

alter table public.recipes enable row level security;

-- Anyone (including anon) can read.
create policy "recipes are publicly readable"
  on public.recipes for select
  to anon, authenticated
  using (true);

-- No insert/update/delete policies on purpose: all writes go through the API's
-- service role (which bypasses RLS) so ALLOWED_EMAILS and upload limits cannot be
-- bypassed by a signed-in user calling PostgREST directly with the public anon key.

-- Image bucket: public read by URL, service-role write.
insert into storage.buckets (id, name, public)
values ('recipe-images', 'recipe-images', true)
on conflict (id) do update set public = true;

-- The bucket is public, so object URLs are readable without any policy. No storage
-- policies are created: listing and all writes are service-role only (the API).
