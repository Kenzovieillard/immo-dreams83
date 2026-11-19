import assert from "node:assert/strict";
import { test } from "node:test";
import { createCommercialSyncQueue } from "../src/lib/commercial-sync-queue";

const tick = () => new Promise((resolve) => setTimeout(resolve, 10));

test("coalesces a burst into one canonical read", async () => {
  let calls = 0;
  const queue = createCommercialSyncQueue({ refresh: async () => { calls++; }, onError: (error) => assert.fail(String(error)), delayMs: 0 });
  for (let i = 0; i < 100; i++) queue.request();
  await tick();
  assert.equal(calls, 1);
  queue.dispose();
});

test("retains invalidations during drag/draft and flushes on resume", async () => {
  let calls = 0;
  const queue = createCommercialSyncQueue({ refresh: async () => { calls++; }, onError: (error) => assert.fail(String(error)), delayMs: 0 });
  queue.request();
  queue.setPaused(true);
  queue.request();
  await tick();
  assert.equal(calls, 0);
  queue.setPaused(false);
  await tick();
  assert.equal(calls, 1);
  queue.dispose();
});

test("events arriving during a read trigger one subsequent read, never overlap", async () => {
  let finish = () => {};
  let calls = 0;
  const queue = createCommercialSyncQueue({ refresh: async () => { calls++; if (calls === 1) await new Promise<void>((resolve) => { finish = resolve; }); }, onError: (error) => assert.fail(String(error)), delayMs: 0 });
  queue.request();
  await tick();
  queue.request(); queue.request();
  await tick();
  assert.equal(calls, 1);
  finish();
  await tick();
  assert.equal(calls, 2);
  queue.dispose();
});

test("read failures are surfaced without an unbounded retry loop", async () => {
  let calls = 0;
  let errors = 0;
  let successes = 0;
  const queue = createCommercialSyncQueue({ refresh: async () => { if (++calls === 1) throw new Error("network"); }, onError: () => { errors++; }, onSuccess: () => { successes++; }, delayMs: 0 });
  queue.request(); await tick(); await tick();
  assert.equal(calls, 1); assert.equal(errors, 1);
  queue.request(); await tick();
  assert.equal(successes, 1);
  queue.dispose();
});

test("dispose cancels pending reads and suppresses late completion callbacks", async () => {
  let calls = 0;
  const queue = createCommercialSyncQueue({ refresh: async () => { calls++; }, onError: (error) => assert.fail(String(error)), delayMs: 0 });
  queue.request(); queue.dispose(); await tick();
  assert.equal(calls, 0);
  let finish = () => {};
  const active = createCommercialSyncQueue({ refresh: () => new Promise<void>((resolve) => { finish = resolve; }), onError: (error) => assert.fail(String(error)), onSuccess: () => assert.fail("callback after disposal"), delayMs: 0 });
  active.request(); await tick(); active.dispose(); finish(); await tick();
});
