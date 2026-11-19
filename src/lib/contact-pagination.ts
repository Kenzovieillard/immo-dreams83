export const contactPageSizes = [10, 20, 50, 100] as const;
export type ContactPageSize = (typeof contactPageSizes)[number];

export function getContactPagination(total: number, page: number, pageSize: ContactPageSize) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(totalPages, Math.max(1, Number.isFinite(page) ? Math.trunc(page) : 1));
  const start = (currentPage - 1) * pageSize;
  const end = Math.min(start + pageSize, total);
  const candidates = totalPages <= 5
    ? Array.from({ length: totalPages }, (_, index) => index + 1)
    : [1, currentPage - 1, currentPage, currentPage + 1, totalPages];
  const pages = [...new Set(candidates.filter(value => value >= 1 && value <= totalPages))].sort((a, b) => a - b);
  return { totalPages, currentPage, start, end, pages };
}
