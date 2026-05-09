-- Existing Supabase projects can run this once to keep only one active room.

begin;

update public.rooms
set active = false
where name <> '미팅룸';

insert into public.rooms (name, location, capacity, active)
values ('미팅룸', '해안', 8, true)
on conflict (name)
do update set
  location = excluded.location,
  capacity = excluded.capacity,
  active = true;

commit;
