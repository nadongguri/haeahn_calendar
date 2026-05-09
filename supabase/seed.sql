insert into public.rooms (name, location, capacity, active)
values
  ('Aurora', '3F North', 6, true),
  ('Beacon', '3F South', 10, true),
  ('Cedar', '4F East', 4, true),
  ('Delta Boardroom', '5F West', 14, true)
on conflict do nothing;
