import assert from "node:assert/strict";
import { test } from "node:test";
import { contactPageSizes, getContactPagination } from "../src/lib/contact-pagination";

test("contacts : tailles proposées et dernière page partielle", () => {
  assert.deepEqual(contactPageSizes, [10, 20, 50, 100]);
  for (const size of contactPageSizes) {
    const last = getContactPagination(189, 999, size);
    assert.equal(last.totalPages, Math.ceil(189 / size));
    assert.equal(last.end, 189);
    assert(last.end - last.start <= size);
  }
});
test("contacts : pagination vide et bornes après filtrage", () => {
  assert.deepEqual(getContactPagination(0, 9, 20), { totalPages: 1, currentPage: 1, start: 0, end: 0, pages: [1] });
  assert.equal(getContactPagination(23, 9, 20).currentPage, 2);
  assert.equal(getContactPagination(189, -3, 20).currentPage, 1);
  assert.equal(getContactPagination(189, Number.NaN, 20).currentPage, 1);
});
test("contacts : pages numérotées bornées et sans doublons", () => {
  assert.deepEqual(getContactPagination(50, 3, 10).pages, [1, 2, 3, 4, 5]);
  assert.deepEqual(getContactPagination(189, 5, 20).pages, [1, 4, 5, 6, 10]);
  assert.deepEqual(getContactPagination(189, 10, 20).pages, [1, 9, 10]);
});
