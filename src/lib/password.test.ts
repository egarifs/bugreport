import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "./db";
import { hashPassword, verifyLogin } from "./password";

test("verifyLogin: benar, salah, kunci, status", async () => {
  const email = `pw_${Date.now()}@example.com`;
  const u = await prisma.user.create({ data: { email, status: "ACTIVE", passwordHash: await hashPassword("rahasia-panjang-1") } });
  assert.equal((await verifyLogin(email.toUpperCase(), "rahasia-panjang-1"))?.id, u.id);
  assert.equal(await verifyLogin(email, "salah"), null);
  assert.equal(await verifyLogin("tidak.ada@example.com", "x"), null);
  for (let i = 0; i < 5; i++) await verifyLogin(email, "salah");
  assert.equal(await verifyLogin(email, "rahasia-panjang-1"), null, "terkunci walau sandi benar");
  await prisma.user.update({ where: { id: u.id }, data: { lockedUntil: null, status: "SUSPENDED" } });
  assert.equal(await verifyLogin(email, "rahasia-panjang-1"), null, "ditangguhkan tidak bisa masuk");
  const nohash = await prisma.user.create({ data: { email: `n_${email}`, status: "ACTIVE" } });
  assert.equal(await verifyLogin(nohash.email, ""), null, "tanpa sandi tidak bisa masuk");
});
