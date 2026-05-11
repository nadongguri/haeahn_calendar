begin;

update public.rooms
set active = false
where name <> '9층 회의실';

insert into public.rooms (name, location, capacity, active)
values ('9층 회의실', '9층', 8, true)
on conflict (name)
do update set
  location = excluded.location,
  capacity = excluded.capacity,
  active = true;

commit;
