import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { Order } from "./types";
import { formatPrice } from "./format";

const BRAND = "Cheap Shot Hockey";

// Lines that render in bold in the PDF and anchor the document's
// visual structure. Kept here so buildReceiptLines stays the single
// source of truth for both content and emphasis.
function isHeading(line: string, lines: string[]): boolean {
  return line === lines[0] || line === "Items" || line === "Ship to" || line.startsWith("Total:");
}

/**
 * The textual content of an order receipt, as ordered lines.
 *
 * Pure and deterministic (ASCII only, so it survives PDF WinAnsi
 * encoding) so it can be unit-tested without rendering a PDF, and so
 * the PDF renderer has a single source of truth. A blank string marks
 * a vertical gap.
 */
export function buildReceiptLines(order: Order): string[] {
  const lines: string[] = [];
  lines.push(`${BRAND} - Receipt`);
  lines.push(`Order ${order.id}`);
  lines.push(`Placed ${new Date(order.createdAt).toUTCString()}`);
  lines.push(`Status: ${order.status}`);
  if (order.guestEmail) lines.push(`Email: ${order.guestEmail}`);
  lines.push("");
  lines.push("Items");
  for (const l of order.lines) {
    lines.push(
      `  ${l.quantity} x ${l.name}   ${formatPrice(l.unitPriceCents * l.quantity, order.region)}`,
    );
  }
  lines.push("");
  lines.push(`Subtotal: ${formatPrice(order.subtotalCents, order.region)}`);
  lines.push(`Tax: ${formatPrice(order.taxCents, order.region)}`);
  lines.push(
    `Shipping: ${order.shippingCents === 0 ? "FREE" : formatPrice(order.shippingCents, order.region)}`,
  );
  lines.push(`Total: ${formatPrice(order.totalCents, order.region)}`);
  lines.push("");
  lines.push("Ship to");
  const a = order.shippingAddress;
  lines.push(`  ${a.name}`);
  lines.push(`  ${a.street}`);
  lines.push(`  ${a.city}, ${a.state} ${a.postalCode}`);
  lines.push(`  ${a.country}`);
  return lines;
}

/**
 * Render an order receipt as a single-or-multi-page PDF.
 *
 * Uses pdf-lib's built-in Helvetica (no font files — serverless-safe)
 * and saves with object streams disabled, keeping the document
 * structure as a plain xref table for maximum compatibility with
 * downstream PDF text extractors — including the Gemini-backed reader
 * a mabl visual download assertion uses to validate the receipt total.
 */
export async function buildReceiptPdf(order: Order): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Receipt ${order.id}`);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  const lines = buildReceiptLines(order);
  const left = 56;
  const top = 728; // US Letter is 792pt tall; 64pt top margin
  const bottom = 56;

  let page = doc.addPage([612, 792]);
  let y = top;

  for (const line of lines) {
    if (y < bottom) {
      page = doc.addPage([612, 792]);
      y = top;
    }
    if (line === "") {
      y -= 8;
      continue;
    }
    const heading = isHeading(line, lines);
    const size = line === lines[0] ? 18 : 11;
    page.drawText(line, {
      x: left,
      y,
      size,
      font: heading ? boldFont : font,
      color: rgb(0.1, 0.1, 0.12),
    });
    y -= line === lines[0] ? 30 : 16;
  }

  return doc.save({ useObjectStreams: false });
}
