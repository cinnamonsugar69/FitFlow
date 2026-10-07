import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const staff = "00000000-0000-0000-0000-000000000001";
const manager = "00000000-0000-0000-0000-000000000002";
const outsider = "00000000-0000-0000-0000-000000000003";
const db = new PGlite();
const issue = (extra = {}) => ({
  member_name: "Test Member", phone: "555-0100", category: "Billing",
  priority: "Normal", assigned_to: "Unassigned", description: "Test issue",
  status: "Open", created_by: "Spoofed Manager", ...extra,
});
async function insert(value) {
  const keys = Object.keys(value);
  return db.query(`insert into public."Issues" (${keys.join(",")}) values (${keys.map((_, i) => `$${i + 1}`).join(",")}) returning *`, Object.values(value));
}
async function asUser(role, id, action, commit = false) {
  await db.exec("begin");
  try {
    await db.exec(`set local role ${role}`);
    await db.query("select set_config('request.jwt.claim.sub', $1, true)", [id ?? ""]);
    const result = await action();
    await db.exec(commit ? "commit" : "rollback");
    return result;
  } catch (error) { await db.exec("rollback"); throw error; }
}
before(async () => {
  // Emulate Supabase's auth boundary; the actual migration runs unchanged.
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth, public to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    create table public."Issues" (
      id uuid primary key default gen_random_uuid(), member_name text, phone text,
      category text, priority text, assigned_to text, description text,
      status text, created_at timestamptz default now(), created_by text
    );
    insert into auth.users values ('${staff}'), ('${manager}'), ('${outsider}');
    insert into public."Issues" (member_name, status, assigned_to, created_by)
      values ('Legacy Member', 'Open', 'Unassigned', 'Front Desk Staff');
    alter table public."Issues" enable row level security;
    grant all on public."Issues" to anon, authenticated;
    grant select (member_name) on public."Issues" to anon;
    grant update (created_by) on public."Issues" to authenticated;
    create policy demo_open_access on public."Issues" for all using (true) with check (true);
  `);
  await db.exec(await readFile(new URL("../supabase/migrations/202610070001_staff_identity.sql", import.meta.url), "utf8"));
  await db.query("insert into public.staff_profiles values ($1, 'Alex Staff', 'staff'), ($2, 'Morgan Manager', 'manager')", [staff, manager]);
  await asUser("authenticated", staff, () => insert(issue()), true);
  await asUser("authenticated", manager, () => insert(issue({ assigned_to: "General Manager" })), true);
});
after(async () => { await db.close(); });

test("anonymous users cannot read or create issues", async () => {
  await assert.rejects(asUser("anon", null, () => db.query('select * from public."Issues"')), /permission denied/);
  await assert.rejects(asUser("anon", null, () => db.query('select member_name from public."Issues"')), /permission denied/);
  await assert.rejects(asUser("anon", null, () => insert(issue())), /permission denied/);
});
test("unapproved authenticated users have no issue access", async () => {
  const result = await asUser("authenticated", outsider, () => db.query('select * from public."Issues"'));
  assert.equal(result.rows.length, 0);
  await assert.rejects(asUser("authenticated", outsider, () => insert(issue())), /Approved staff access/);
});
test("staff see only their own issues; managers also see historical issues", async () => {
  const own = await asUser("authenticated", staff, () => db.query('select * from public."Issues"'));
  assert.equal(own.rows.length, 1);
  assert.equal(own.rows[0].created_by_user_id, staff);
  const all = await asUser("authenticated", manager, () => db.query('select * from public."Issues"'));
  assert.equal(all.rows.length, 3);
  assert.ok(all.rows.some(row => row.created_by === "Front Desk Staff" && row.created_by_user_id === null));
});
test("database overwrites forged identity and submission date", async () => {
  const { rows } = await asUser("authenticated", staff, () => insert(issue({ created_by_user_id: manager, created_at: "2000-01-01" })));
  assert.equal(rows[0].created_by, "Alex Staff");
  assert.equal(rows[0].created_by_user_id, staff);
  assert.ok(new Date(rows[0].created_at).getFullYear() > 2000);
});
test("staff cannot assign an issue on creation or submit it resolved", async () => {
  await assert.rejects(asUser("authenticated", staff, () => insert(issue({ assigned_to: "General Manager" }))), /row-level security/);
  await assert.rejects(asUser("authenticated", staff, () => insert(issue({ status: "Resolved" }))), /Invalid issue submission/);
});
test("staff cannot update issues even by calling the database directly", async () => {
  const result = await asUser("authenticated", staff, () => db.query('update public."Issues" set status = \'Resolved\' returning id'));
  assert.equal(result.rows.length, 0);
  const all = await db.query('select status from public."Issues"');
  assert.ok(all.rows.every(row => row.status === "Open"));
});
test("managers can assign and resolve existing issues", async () => {
  const result = await asUser("authenticated", manager, () => db.query('update public."Issues" set status = \'Resolved\', assigned_to = \'Assistant Manager\' returning *'));
  assert.equal(result.rows.length, 3);
  assert.ok(result.rows.every(row => row.status === "Resolved" && row.assigned_to === "Assistant Manager"));
});
test("management updates reject invalid statuses and assignments", async () => {
  await assert.rejects(asUser("authenticated", manager, () => db.query('update public."Issues" set status = \'Invalid\'')), /Invalid issue status/);
  await assert.rejects(asUser("authenticated", manager, () => db.query('update public."Issues" set assigned_to = \'Invalid\'')), /Invalid issue status/);
});
test("managers cannot rewrite the author or member details", async () => {
  await assert.rejects(asUser("authenticated", manager, () => db.query('update public."Issues" set created_by = \'Someone Else\'')), /permission denied/);
  await assert.rejects(asUser("authenticated", manager, () => db.query('update public."Issues" set phone = \'Changed\'')), /permission denied/);
});
test("no browser user can grant themselves or someone else a role", async () => {
  for (const id of [staff, manager, outsider]) {
    await assert.rejects(asUser("authenticated", id, () => db.query("update public.staff_profiles set role = 'manager'")), /permission denied/);
    await assert.rejects(asUser("authenticated", id, () => db.query("insert into public.staff_profiles values ($1, 'Intruder', 'manager')", [outsider])), /permission denied/);
  }
  const profiles = await asUser("authenticated", staff, () => db.query("select * from public.staff_profiles"));
  assert.equal(profiles.rows.length, 1);
  assert.equal(profiles.rows[0].id, staff);
});
test("deletion is denied to staff and managers", async () => {
  for (const id of [staff, manager]) await assert.rejects(asUser("authenticated", id, () => db.query('delete from public."Issues"')), /permission denied/);
});
test("removing an approved profile immediately removes database access", async () => {
  await db.query("delete from public.staff_profiles where id = $1", [staff]);
  try {
    const result = await asUser("authenticated", staff, () => db.query('select * from public."Issues"'));
    assert.equal(result.rows.length, 0);
    await assert.rejects(asUser("authenticated", staff, () => insert(issue())), /Approved staff access/);
  } finally { await db.query("insert into public.staff_profiles values ($1, 'Alex Staff', 'staff')", [staff]); }
});
test("empty fields and oversized descriptions are rejected", async () => {
  for (const changes of [{ member_name: " " }, { phone: null }, { category: "" }, { description: "x".repeat(2001) }])
    await assert.rejects(asUser("authenticated", staff, () => insert(issue(changes))), /Invalid issue submission/);
});
