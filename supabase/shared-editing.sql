-- Run ONCE after schema.sql and after disabling new signups in Supabase Auth.
-- Snapshot existing accounts only. A second run deliberately fails atomically
-- instead of silently granting access to accounts created later.
begin;

create table public.reservation_editors (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now()
);

alter table public.reservation_editors enable row level security;
revoke all on public.reservation_editors from public, anon, authenticated;
grant select on public.reservation_editors to authenticated;

create policy "Users can view own shared editing access"
on public.reservation_editors for select to authenticated
using (user_id = (select auth.uid()));

insert into public.reservation_editors (user_id)
select id from auth.users;

-- Shared edits must not transfer ownership or bypass owner-only deletion.
create function public.preserve_reservation_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
    or new.organizer_user_id is distinct from old.organizer_user_id
    or new.organizer_email is distinct from old.organizer_email
    or new.created_at is distinct from old.created_at then
    raise exception 'Reservation ownership and creation metadata cannot be changed'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger reservations_preserve_identity
before update on public.reservations
for each row execute function public.preserve_reservation_identity();

create policy "Existing members can update shared reservations"
on public.reservations for update to authenticated
using (
  (select exists (
    select 1 from public.reservation_editors where user_id = auth.uid()
  ))
)
with check (
  (select exists (
    select 1 from public.reservation_editors where user_id = auth.uid()
  ))
);

commit;
