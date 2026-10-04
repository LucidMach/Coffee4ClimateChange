import { beforeAll, afterAll, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

let db: PGlite;
const ids = {
  owner: "00000000-0000-4000-8000-000000000001",
  member: "00000000-0000-4000-8000-000000000002",
  recipient: "00000000-0000-4000-8000-000000000003",
  outsider: "00000000-0000-4000-8000-000000000004",
  supplierA: "10000000-0000-4000-8000-000000000001",
  supplierB: "10000000-0000-4000-8000-000000000002",
  recipientOrg: "10000000-0000-4000-8000-000000000003",
  listingA: "20000000-0000-4000-8000-000000000001",
  listingB: "20000000-0000-4000-8000-000000000002",
};
beforeAll(async () => {
  db = new PGlite();
  // Simulate Supabase's auth namespace and caller JWT subject locally. This
  // verifies real Postgres RLS, not a live Supabase Auth/JWT connection.
  await db.exec(
    "create role anon; create role authenticated; create schema auth; create table auth.users (id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;",
  );
  await db.exec(
    readFileSync(
      resolve("supabase/migrations/202610040001_foundation.sql"),
      "utf8",
    ),
  );
  for (const id of [ids.owner, ids.member, ids.recipient, ids.outsider])
    await db.query("insert into auth.users values ($1)", [id]);
  for (const [id, kind] of [
    [ids.supplierA, "supplier"],
    [ids.supplierB, "supplier"],
    [ids.recipientOrg, "recipient"],
  ])
    await db.query(
      "insert into public.organizations(id,name,kind,fixture) values ($1,'Test business',$2,true)",
      [id, kind],
    );
  for (const [organization, user, role] of [
    [ids.supplierA, ids.owner, "owner"],
    [ids.supplierA, ids.member, "member"],
    [ids.recipientOrg, ids.recipient, "owner"],
  ])
    await db.query(
      "insert into public.organization_members values ($1,$2,$3)",
      [organization, user, role],
    );
  await db.query(
    "insert into public.recipients(organization_id,display_name,materials,minimum_kg,capacity_kg,fixture) values ($1,'Test recipient',array['grounds'],5,100,true)",
    [ids.recipientOrg],
  );
  for (const [listing, supplier] of [
    [ids.listingA, ids.supplierA],
    [ids.listingB, ids.supplierB],
  ])
    await db.query(
      "insert into public.listings(id,supplier_org_id,material,quantity_kg,collected_at,available_at,expires_at,facts,fixture) values ($1,$2,'grounds',30,now(),now(),now()+interval '1 day','{}',true)",
      [listing, supplier],
    );
  await db.query(
    "insert into public.transfers(listing_id,supplier_org_id,recipient_org_id,agreed_kg,pickup_at,terms) values ($1,$2,$3,10,now(),'{}')",
    [ids.listingA, ids.supplierA, ids.recipientOrg],
  );
  await db.query(
    "insert into public.ai_generations(listing_id,supplier_org_id,mode,result) values ($1,$2,'rules','{}')",
    [ids.listingA, ids.supplierA],
  );
}, 20000);
afterAll(async () => {
  await db?.close();
});
async function asUser(user: string) {
  await db.exec("reset role;");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [
    user,
  ]);
  await db.exec("set role authenticated;");
}
it("allows a non-owner member to read their organization's listings and explanation history", async () => {
  await asUser(ids.member);
  expect((await db.query("select id from public.listings")).rows).toEqual([
    { id: ids.listingA },
  ]);
  expect(
    (await db.query("select id from public.ai_generations")).rows,
  ).toHaveLength(1);
  await expect(
    db.query("update public.transfers set status='completed'"),
  ).rejects.toThrow(/permission denied/i);
});
it("allows the participating recipient to read a handover while withholding supplier AI notes", async () => {
  await asUser(ids.recipient);
  expect((await db.query("select id from public.transfers")).rows).toHaveLength(
    1,
  );
  expect((await db.query("select id from public.listings")).rows).toEqual([
    { id: ids.listingA },
  ]);
  expect(
    (await db.query("select id from public.ai_generations")).rows,
  ).toHaveLength(0);
});
it("isolates outsiders and denies anonymous access or self-assigned membership", async () => {
  await asUser(ids.outsider);
  expect((await db.query("select id from public.listings")).rows).toHaveLength(
    0,
  );
  expect((await db.query("select id from public.transfers")).rows).toHaveLength(
    0,
  );
  await expect(
    db.query("insert into public.organization_members values ($1,$2,'owner')", [
      ids.supplierA,
      ids.outsider,
    ]),
  ).rejects.toThrow(/permission denied/i);
  await db.exec("reset role; set role anon;");
  await expect(db.query("select * from public.listings")).rejects.toThrow(
    /permission denied/i,
  );
});
it("rejects mismatched supplier ownership at the database foreign-key boundary", async () => {
  await db.exec("reset role;");
  await expect(
    db.query(
      "insert into public.transfers(listing_id,supplier_org_id,recipient_org_id,agreed_kg,pickup_at,terms) values ($1,$2,$3,10,now(),'{}')",
      [ids.listingA, ids.supplierB, ids.recipientOrg],
    ),
  ).rejects.toThrow(/foreign key/i);
});
