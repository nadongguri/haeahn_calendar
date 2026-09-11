import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";

test("shared editing remains limited to existing members without changing ownership", async () => {
  const db = new PGlite({ extensions: { btree_gist } });
  const sql = async (name) => readFile(new URL(`../supabase/${name}`, import.meta.url), "utf8");
  const owner = "00000000-0000-0000-0000-000000000001";
  const member = "00000000-0000-0000-0000-000000000002";
  const newcomer = "00000000-0000-0000-0000-000000000003";
  const room = "00000000-0000-0000-0000-000000000004";
  const booking = "00000000-0000-0000-0000-000000000005";
  const ownBooking = "00000000-0000-0000-0000-000000000006";
  async function signIn(user, role = "authenticated") {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ sub: user, email: `${user}@example.test` })]);
    await db.exec(`set role ${role}`);
  }
  async function denied(statement, code = "42501") {
    await assert.rejects(db.query(statement), (error) => error.code === code);
  }
  try {
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth;
      create table auth.users (id uuid primary key);
      create function auth.jwt() returns jsonb language sql stable as
        $$ select nullif(current_setting('request.jwt.claims', true), '')::jsonb $$;
      create function auth.uid() returns uuid language sql stable as
        $$ select (auth.jwt() ->> 'sub')::uuid $$;
      grant usage on schema auth to anon, authenticated;
      insert into auth.users values ('${owner}'), ('${member}');
    `);
    await db.exec(await sql("schema.sql"));
    await db.exec(`insert into public.rooms (id, name) values ('${room}', 'Test room')`);
    await signIn(owner);
    await db.exec(`insert into public.reservations
      (id, room_id, title, start_time, end_time, organizer_user_id, organizer_email)
      values ('${booking}', '${room}', 'Original', '2026-09-11 09:00Z', '2026-09-11 10:00Z', '${owner}', '${owner}@example.test')`);
    await signIn(member);
    assert.equal((await db.query(`update public.reservations set title = 'Denied' where id = '${booking}' returning id`)).rows.length, 0);
    await db.exec("reset role");
    await db.exec(await sql("shared-editing.sql"));
    await db.exec(`insert into auth.users values ('${newcomer}')`);
    await signIn(member);
    assert.equal((await db.query("select * from public.reservation_editors")).rows.length, 1);
    assert.equal((await db.query(`update public.reservations set title = 'Shared edit' where id = '${booking}' returning id`)).rows.length, 1);
    const row = (await db.query(`select * from public.reservations where id = '${booking}'`)).rows[0];
    assert.equal(row.organizer_user_id, owner);
    assert.equal(row.organizer_email, `${owner}@example.test`);
    for (const assignment of [
      `organizer_user_id = '${member}'`,
      `organizer_email = '${member}@example.test'`,
      `id = '${ownBooking}'`,
      "created_at = now() + interval '1 day'"
    ]) await denied(`update public.reservations set ${assignment} where id = '${booking}'`);
    assert.equal((await db.query(`delete from public.reservations where id = '${booking}' returning id`)).rows.length, 0);
    await denied(`insert into public.reservation_editors (user_id) values ('${newcomer}')`);
    await denied("delete from public.reservation_editors");
    await denied(`insert into public.reservations (room_id, title, start_time, end_time, organizer_user_id, organizer_email)
      values ('${room}', 'Spoof', '2026-09-11 11:00Z', '2026-09-11 12:00Z', '${owner}', '${owner}@example.test')`);
    await db.exec(`insert into public.reservations (id, room_id, title, start_time, end_time, organizer_user_id, organizer_email)
      values ('${ownBooking}', '${room}', 'Own', '2026-09-11 10:00Z', '2026-09-11 11:00Z', '${member}', '${member}@example.test')`);
    await denied(`update public.reservations set end_time = '2026-09-11 10:30Z' where id = '${booking}'`, "23P01");
    await signIn(newcomer);
    assert.equal((await db.query("select * from public.reservation_editors")).rows.length, 0);
    assert.equal((await db.query(`update public.reservations set title = 'Denied' where id = '${booking}' returning id`)).rows.length, 0);
    await signIn(newcomer, "anon");
    await denied(`update public.reservations set title = 'Anonymous' where id = '${booking}'`);
    await db.exec("reset role");
    await assert.rejects(db.exec(await sql("shared-editing.sql")), (error) => error.code === "42P07");
    await db.exec("rollback");
    assert.equal((await db.query("select count(*)::int as count from public.reservation_editors")).rows[0].count, 2);
    await db.exec(await sql("disable-shared-editing.sql"));
    await signIn(member);
    assert.equal((await db.query(`update public.reservations set title = 'Revoked' where id = '${booking}' returning id`)).rows.length, 0);
    assert.equal((await db.query(`update public.reservations set title = 'Still own' where id = '${ownBooking}' returning id`)).rows.length, 1);
    assert.equal((await db.query(`delete from public.reservations where id = '${ownBooking}' returning id`)).rows.length, 1);
    await signIn(owner);
    assert.equal((await db.query(`delete from public.reservations where id = '${booking}' returning id`)).rows.length, 1);
  } finally {
    await db.close();
  }
});
