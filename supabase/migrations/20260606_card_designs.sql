-- Table des designs de carte (1 design actif par commerçant ; versioning = A3)
create table if not exists public.card_designs (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null unique references public.merchants(id) on delete cascade,
  background_color text not null default '#0D6B5E',
  foreground_color text not null default '#FFFFFF',
  label_color text not null default '#BFEEE6',
  program_name text not null default 'Carte de fidélité',
  logo_original_path text,
  logo_assets jsonb not null default '{}'::jsonb,
  fields jsonb not null default '[]'::jsonb,
  barcode jsonb not null default '{"type":"QR","source":"card_token"}'::jsonb,
  google_class_id text,
  google_class_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

create index if not exists card_designs_merchant_idx on public.card_designs(merchant_id);

create or replace function public.touch_card_designs_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_card_designs_updated_at on public.card_designs;
create trigger trg_card_designs_updated_at
  before update on public.card_designs
  for each row execute function public.touch_card_designs_updated_at();

alter table public.card_designs enable row level security;

drop policy if exists card_designs_select on public.card_designs;
create policy card_designs_select on public.card_designs for select
  using (
    public.is_admin()
    or merchant_id in (select id from public.merchants where user_id = auth.uid())
  );

drop policy if exists card_designs_write on public.card_designs;
create policy card_designs_write on public.card_designs for all
  using (public.is_admin())
  with check (public.is_admin());

insert into storage.buckets (id, name, public)
values ('card-assets', 'card-assets', false)
on conflict (id) do nothing;

drop policy if exists card_assets_admin_all on storage.objects;
create policy card_assets_admin_all on storage.objects for all
  using (bucket_id = 'card-assets' and public.is_admin())
  with check (bucket_id = 'card-assets' and public.is_admin());
