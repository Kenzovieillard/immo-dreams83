import assert from "node:assert/strict";
import { test } from "node:test";
import {
  calendarDays,
  commercialLabel,
  commercialTone,
  money,
  parisDay,
  priceGap,
} from "../src/lib/commercial-presentation";

test("calendar week starts Monday across month and year boundaries", () => {
  const days = calendarDays("2027-01-01", "week");
  assert.equal(days[0], "2026-12-28");
  assert.equal(days[6], "2027-01-03");
  assert.equal(new Set(days).size, 7);
});
test("month grid includes complete weeks and leap day", () => {
  const days = calendarDays("2028-02-15", "month");
  assert.equal(days.length, 42);
  assert.ok(days.includes("2028-02-29"));
  assert.equal(new Date(days[0]).getUTCDay(), 1);
});
test("visits are grouped by Paris day, including summer and winter time", () => {
  assert.equal(parisDay("2026-07-01T22:30:00Z"), "2026-07-02");
  assert.equal(parisDay("2026-01-01T22:30:00Z"), "2026-01-01");
});
test("unknown price is not a fictional zero and an offer gap requires a valid asking price", () => {
  assert.equal(money(null), "Non renseigné");
  assert.match(money(0), /0/);
  assert.equal(priceGap(850000, 900000)?.toFixed(1), "-5.6");
  assert.equal(priceGap(100, 0), null);
});
test("persisted enums have French labels and correct visual status", () => {
  assert.equal(commercialLabel("SIGNED_BY_BUYER"), "Signée acquéreur");
  assert.equal(commercialLabel("FUTURE_STATUS"), "FUTURE_STATUS");
  assert.equal(commercialTone("NEGOTIATING"), "warning");
  assert.equal(commercialTone("CANCELLED"), "danger");
  assert.equal(commercialTone("CONFIRMED"), "success");
});
