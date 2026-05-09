-- Meeting-room reservation schema for Supabase PostgreSQL.
-- Run this in the Supabase SQL editor after creating the project.

begin;

create extension if not exists btree_gist;

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  location text,
  capacity integer check (capacity is null or capacity > 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete restrict,
  title text not null check (char_length(trim(title)) > 0),
  description text not null default '',
  start_time timestamptz not null,
  end_time timestamptz not null,
  organizer_user_id uuid not null references auth.users(id) on delete cascade,
  organizer_email text not null,
  attendees text[] not null default '{}',
  send_notification boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reservations_valid_time check (end_time > start_time),
  constraint reservations_room_time_no_overlap exclude using gist (
    room_id with =,
    tstzrange(start_time, end_time, '[)') with &&
  )
);

create index if not exists reservations_start_time_idx
  on public.reservations (start_time);

create index if not exists reservations_organizer_user_id_idx
  on public.reservations (organizer_user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists reservations_set_updated_at on public.reservations;
create trigger reservations_set_updated_at
before update on public.reservations
for each row
execute function public.set_updated_at();

create or replace function public.ensure_reservation_room_is_active()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1
    from public.rooms
    where id = new.room_id
      and active = true
  ) then
    raise exception 'Selected room is not active'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists reservations_require_active_room on public.reservations;
create trigger reservations_require_active_room
before insert or update of room_id on public.reservations
for each row
execute function public.ensure_reservation_room_is_active();

alter table public.rooms enable row level security;
alter table public.reservations enable row level security;

drop policy if exists "Authenticated users can view active rooms" on public.rooms;
create policy "Authenticated users can view active rooms"
on public.rooms
for select
to authenticated
using (active = true);

drop policy if exists "Authenticated users can view reservations" on public.reservations;
create policy "Authenticated users can view reservations"
on public.reservations
for select
to authenticated
using (true);

drop policy if exists "Authenticated users can create own reservations" on public.reservations;
create policy "Authenticated users can create own reservations"
on public.reservations
for insert
to authenticated
with check (
  organizer_user_id = auth.uid()
  and organizer_email = coalesce(auth.jwt() ->> 'email', '')
);

drop policy if exists "Users can update own reservations" on public.reservations;
create policy "Users can update own reservations"
on public.reservations
for update
to authenticated
using (organizer_user_id = auth.uid())
with check (
  organizer_user_id = auth.uid()
  and organizer_email = coalesce(auth.jwt() ->> 'email', '')
);

drop policy if exists "Users can delete own reservations" on public.reservations;
create policy "Users can delete own reservations"
on public.reservations
for delete
to authenticated
using (organizer_user_id = auth.uid());

grant usage on schema public to anon, authenticated;
grant select on public.rooms to authenticated;
grant select, insert, update, delete on public.reservations to authenticated;

commit;
