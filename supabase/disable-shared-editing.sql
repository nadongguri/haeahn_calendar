-- Revoke the temporary exception without deleting accounts or reservations.
-- Run after shared-editing.sql. The identity protection remains in place.
begin;
drop policy if exists "Existing members can update shared reservations"
  on public.reservations;
delete from public.reservation_editors;
commit;
