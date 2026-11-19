"use client";

import { Fragment, useId } from "react";
import { Button } from "@/components/ui/button";
import { contactPageSizes, getContactPagination, type ContactPageSize } from "@/lib/contact-pagination";

export function ContactPagination({ total, page, pageSize, onPageChange, onPageSizeChange }: {
  total: number;
  page: number;
  pageSize: ContactPageSize;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: ContactPageSize) => void;
}) {
  const id = useId();
  const { currentPage, totalPages, start, end, pages } = getContactPagination(total, page, pageSize);
  const selectClass = "h-9 rounded-lg border border-[var(--crm-riviera-border-default)] bg-[var(--crm-riviera-bg-surface)] px-2 text-sm text-[var(--crm-riviera-text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--crm-riviera-bg-action)]";

  return (
    <nav aria-label="Pagination des contacts" className="flex flex-col gap-3 border-t border-[var(--crm-riviera-border-default)] bg-[var(--crm-riviera-bg-canvas)] px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p role="status" aria-live="polite" className="text-xs text-[var(--crm-riviera-text-secondary)]">
          <span className="font-semibold text-[var(--crm-riviera-text-primary)]">Page {currentPage} sur {totalPages}</span>
          {" · "}{total ? start + 1 : 0}–{end} sur {total} contacts
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <div className="flex items-center gap-2">
            <label htmlFor={`${id}-size`} className="text-xs">Contacts par page</label>
            <select id={`${id}-size`} value={pageSize} className={selectClass} onChange={event => onPageSizeChange(Number(event.target.value) as ContactPageSize)}>
              {contactPageSizes.map(size => <option key={size} value={size}>{size}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor={`${id}-page`} className="text-xs">Aller à la page</label>
            <select id={`${id}-page`} value={currentPage} disabled={totalPages === 1} className={selectClass} onChange={event => onPageChange(Number(event.target.value))}>
              {Array.from({ length: totalPages }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}
            </select>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-1 sm:justify-end sm:gap-2">
        <Button type="button" variant="outline" className="h-9 rounded-lg" disabled={currentPage === 1} onClick={() => onPageChange(currentPage - 1)}>Précédent</Button>
        <div className="flex flex-wrap items-center justify-center gap-1">
          {pages.map((number, index) => (
            <Fragment key={number}>
              {index > 0 && number - pages[index - 1] > 1 ? <span aria-hidden="true" className="px-1 text-xs">…</span> : null}
              <Button type="button" variant="ghost" aria-label={`Page ${number}`} aria-current={number === currentPage ? "page" : undefined} onClick={() => onPageChange(number)} className={`h-9 min-w-9 rounded-lg px-2 text-xs ${number === currentPage ? "bg-[var(--crm-riviera-bg-action)] text-white hover:bg-[var(--crm-riviera-bg-action)] hover:text-white" : "text-[var(--crm-riviera-text-secondary)]"}`}>{number}</Button>
            </Fragment>
          ))}
        </div>
        <Button type="button" variant="outline" className="h-9 rounded-lg" disabled={currentPage === totalPages} onClick={() => onPageChange(currentPage + 1)}>Suivant</Button>
      </div>
    </nav>
  );
}
