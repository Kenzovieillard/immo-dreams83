import "server-only";

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { CommercialEstimationDetail } from "@/types/commercial";

function safeText(value: string | number | null | undefined) {
  return String(value ?? "Non renseigné").replace(/[\u{1F000}-\u{1FAFF}]/gu, "");
}

function wrap(text: string, font: PDFFont, size: number, width: number) {
  const words = safeText(text).split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= width) line = candidate;
    else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export async function generateEstimationPdf(estimation: CommercialEstimationDetail) {
  const document = await PDFDocument.create();
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const dark = rgb(0.09, 0.13, 0.12);
  const green = rgb(0.18, 0.29, 0.23);
  const orange = rgb(0.91, 0.38, 0.12);
  let page!: PDFPage;
  let y = 0;
  const newPage = () => {
    page = document.addPage([595.28, 841.89]);
    page.drawRectangle({ x: 0, y: 0, width: 595.28, height: 841.89, color: rgb(0.98, 0.97, 0.94) });
    page.drawRectangle({ x: 0, y: 770, width: 595.28, height: 71.89, color: green });
    page.drawText("IMMO DREAMS83", { x: 44, y: 802, size: 18, font: bold, color: rgb(1, 1, 1) });
    page.drawText("Rapport d'estimation immobilière", { x: 44, y: 781, size: 10, font: regular, color: rgb(0.87, 0.91, 0.88) });
    y = 735;
  };
  const ensure = (height: number) => { if (y - height < 55) newPage(); };
  const heading = (text: string) => {
    ensure(35); page.drawText(text, { x: 44, y, size: 14, font: bold, color: green });
    page.drawRectangle({ x: 44, y: y - 8, width: 507, height: 2, color: orange }); y -= 32;
  };
  const field = (label: string, value: string | number | null | undefined) => {
    ensure(32); page.drawText(safeText(label), { x: 44, y, size: 9, font: bold, color: green });
    const lines = wrap(safeText(value), regular, 10, 340);
    lines.forEach((line, index) => page.drawText(line, { x: 205, y: y - index * 13, size: 10, font: regular, color: dark }));
    y -= Math.max(24, lines.length * 13 + 6);
  };

  newPage();
  page.drawText(estimation.reference ?? `EST-${estimation.id.slice(0, 8).toUpperCase()}`, { x: 430, y: 805, size: 9, font: bold, color: rgb(1, 1, 1) });
  heading("Propriétaire et bien");
  field("Propriétaire", estimation.contactName);
  field("Coordonnées", `${estimation.contactEmail}${estimation.contactPhone ? ` · ${estimation.contactPhone}` : ""}`);
  field("Adresse", `${estimation.address}, ${estimation.postalCode ?? ""} ${estimation.city}`);
  field("Type", estimation.propertyType);
  field("Caractéristiques", `${estimation.surface} m²${estimation.rooms ? ` · ${estimation.rooms} pièces` : ""}${estimation.constructionYear ? ` · année ${estimation.constructionYear}` : ""}`);
  field("État", estimation.propertyCondition);

  heading("Estimation");
  field("Valeur estimée", estimation.estimatedValue ? `${estimation.estimatedValue.toLocaleString("fr-FR")} €` : null);
  field("Fourchette basse", estimation.estimateLow ? `${estimation.estimateLow.toLocaleString("fr-FR")} €` : null);
  field("Fourchette haute", estimation.estimateHigh ? `${estimation.estimateHigh.toLocaleString("fr-FR")} €` : null);
  field("Prix de mise en vente", estimation.listingPrice ? `${estimation.listingPrice.toLocaleString("fr-FR")} €` : null);
  field("Conseiller", estimation.assignedToName);
  field("Statut", estimation.status);

  heading("Observations");
  field("Notes", estimation.notes);
  if (estimation.marketComparables.length > 0) {
    heading("Comparables de marché");
    estimation.marketComparables.forEach((item, index) => field(`Comparable ${index + 1}`, `${item.label}${item.surface ? ` · ${item.surface} m²` : ""}${item.price ? ` · ${item.price.toLocaleString("fr-FR")} €` : ""}`));
  }

  ensure(50);
  page.drawText(`Document généré le ${new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Paris" }).format(new Date())}`, { x: 44, y: 42, size: 8, font: regular, color: rgb(0.4, 0.45, 0.42) });
  page.drawText("Ce rapport constitue un avis de valeur et non une expertise judiciaire.", { x: 44, y: 29, size: 8, font: regular, color: rgb(0.4, 0.45, 0.42) });
  document.setTitle(`Estimation ${estimation.reference ?? estimation.id} - IMMO DREAMS83`);
  document.setAuthor("IMMO DREAMS83");
  document.setSubject("Rapport d'estimation immobilière");
  return document.save();
}
