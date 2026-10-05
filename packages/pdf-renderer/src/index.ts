import PDFDocument from "pdfkit";
import { join } from "node:path";
import type { FiscalDocumentSnapshot } from "@factuez/contracts";
import QRCode from 'qrcode';
export { renderLocalGrePdf, type PrintableGre } from './gre';

export const IMPLEMENTATION_CREDIT =
  "Desarrollado e implementado por www.mavrictec.com";
export type PrintFormat = "ticket" | "a4";
type PrintableNote = Omit<FiscalDocumentSnapshot, 'documentTypeCode'> & {
  documentTypeCode: '07' | '08'; reasonCode: string; reasonDescription: string;
  reference: { fullNumber: string; documentTypeCode: string; issueDate: string };
};
const MM = 72 / 25.4;
const mavricLogo = join(__dirname, "../assets/mavric-logo.png");
const factuezLogo = join(__dirname, "../assets/factuez-logo.png");
const sanJoseLogo = join(__dirname, "../assets/san-jose-logo.png");
const inter =
  require.resolve("@fontsource/inter/files/inter-latin-400-normal.woff");
type Cell = {
  text: string;
  width: number;
  align?: "left" | "right" | "center";
};
type Block = {
  cells: Cell[];
  size: number;
  gap: number;
  rule?: boolean;
  shade?: boolean;
  image?: "BRANDS" | "SAN_JOSE" | "QR";
};

function clean(value: string) {
  return value.replace(
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u202A-\u202E\u2066-\u2069]/g,
    "",
  );
}
function money(value: string, precision = 2) {
  // Formateo decimal sin conversiones a Number ni recálculo de importes fiscales.
  if (!/^\d{1,20}(\.\d{1,6})?$/.test(value))
    throw new Error("Importe del snapshot inválido");
  const [integer, fraction = ""] = value.split(".");
  let decimals = fraction.padEnd(precision, "0");
  while (decimals.length > precision && decimals.endsWith("0"))
    decimals = decimals.slice(0, -1);
  return `${integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${decimals}`;
}
function quantity(value: string) {
  if (!/^\d{1,12}(\.\d{1,6})?$/.test(value))
    throw new Error("Cantidad del snapshot inválida");
  return value.includes(".")
    ? value.replace(/0+$/, "").replace(/\.$/, "")
    : value;
}

/** Sólo prueba local: nunca inventa QR, hash, CDR ni aceptación fiscal. */
export async function renderLocalDocumentPdf(
  snapshot: FiscalDocumentSnapshot | PrintableNote,
  format: PrintFormat,
    verifiedQa?: { digestValue: string; status: string },
): Promise<Buffer> {
  let qrImage: Buffer | undefined;
  if (verifiedQa) {
    if (snapshot.environment !== 'BETA' || !/^00\d{9}$/.test(snapshot.issuer.identityNumber) || !/^[A-Za-z0-9+/]{43}=$/.test(verifiedQa.digestValue) || !['ACCEPTED', 'ACCEPTED_WITH_OBSERVATIONS', 'REJECTED', 'UNKNOWN', 'SIGNED_LOCAL'].includes(verifiedQa.status)) throw new Error('Evidencia QA inválida');
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(snapshot.issueDate));
    // Formato técnico de QR con digest REAL. Certificado y RUC ficticios: NO fiscal.
    const payload = [snapshot.issuer.identityNumber, snapshot.documentTypeCode, snapshot.series, snapshot.number, snapshot.totals.igvAmount, snapshot.totals.payableAmount, day, snapshot.customer.identityType, snapshot.customer.identityNumber, verifiedQa.digestValue].join('|') + '|';
    qrImage = await QRCode.toBuffer(payload, { type: 'png', errorCorrectionLevel: 'M', margin: 4, width: 400 });
  }
  if (
    !["01", "03", "07", "08"].includes(snapshot.documentTypeCode) ||
    !snapshot.lines.length ||
    snapshot.lines.length > 100
  )
    throw new Error(
      "Representación local sólo admite facturas, boletas y notas de 1 a 100 ítems",
    );
  if (!["ticket", "a4"].includes(format)) throw new Error("Formato inválido");
  if (
    !/^\d{11}$/.test(snapshot.issuer.identityNumber) ||
    !/^[FB][A-Z0-9]{3}-[1-9]\d{0,17}$/.test(snapshot.fullNumber)
  )
    throw new Error("Identidad fiscal del snapshot inválida");
  const ticket = format === "ticket";
  const noteDocument = ['07','08'].includes(snapshot.documentTypeCode);
  const width = ticket ? 80 * MM : 595.28;
  const margin = ticket ? 4 * MM : 42;
  const content = width - margin * 2;
  const size = ticket ? 8 : noteDocument ? 9 : 10;
  const blocks: Block[] = [];
  blocks.push({ cells: [], size: 0, gap: 14, image: "SAN_JOSE" });
  const text = (
    value: string,
    fontSize = size,
    gap = ticket ? 5 : noteDocument ? 7 : 9,
    align: Cell["align"] = "left",
  ) =>
    blocks.push({
      cells: [{ text: clean(value), width: content, align }],
      size: fontSize,
      gap,
    });
  const row = (
    cells: Cell[],
    fontSize = size,
    gap = 8,
    rule = false,
    shade = false,
  ) =>
    blocks.push({
      cells: cells.map((cell) => ({ ...cell, text: clean(cell.text) })),
      size: fontSize,
      gap,
      rule,
      shade,
    });
  text(
    "DOCUMENTO LOCAL DE PRUEBA",
    ticket ? 9 : 12,
    5,
    ticket ? "center" : "left",
  );
  text(
    "SIN VALIDEZ TRIBUTARIA · NO ACEPTADO POR SUNAT",
    ticket ? 7 : 9,
    12,
    ticket ? "center" : "left",
  );
  text(
    snapshot.issuer.tradeName || snapshot.issuer.legalName,
    ticket ? 12 : noteDocument ? 17 : 19,
    5,
    ticket ? "center" : "left",
  );
  if (snapshot.issuer.tradeName)
    text(snapshot.issuer.legalName, size, 5, ticket ? "center" : "left");
  text(
    `RUC ${snapshot.issuer.identityNumber}`,
    size,
    5,
    ticket ? "center" : "left",
  );
  if (snapshot.issuer.address)
    text(snapshot.issuer.address, size, 8, ticket ? "center" : "left");
  text(
    `${({ '01': 'FACTURA', '03': 'BOLETA DE VENTA', '07': 'NOTA DE CRÉDITO', '08': 'NOTA DE DÉBITO' } as Record<string,string>)[snapshot.documentTypeCode]} · ${snapshot.fullNumber}`,
    ticket ? 10 : 14,
    10,
    ticket ? "center" : "left",
  );
  const date = new Intl.DateTimeFormat("es-PE", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Lima",
  }).format(new Date(snapshot.issueDate));
  text(`Emisión: ${date} · Lima`, size, 5);
  if ('reference' in snapshot) {
    if (!['07','08'].includes(snapshot.documentTypeCode) || !/^[FB][A-Z0-9]{3}-[1-9]\d{0,7}$/.test(snapshot.reference.fullNumber) || !snapshot.reasonDescription.trim()) throw new Error('Referencia de nota inválida');
    text(`Comprobante afectado: ${snapshot.reference.documentTypeCode} · ${snapshot.reference.fullNumber}`, size, 5);
    text(`Motivo ${snapshot.reasonCode}: ${snapshot.reasonDescription}`, size, 10);
  } else if (['07','08'].includes(snapshot.documentTypeCode)) throw new Error('La nota requiere comprobante afectado y motivo');
  text(`Cliente: ${snapshot.customer.legalName}`, size, 5);
  text(
    `${snapshot.customer.identityType === "6" ? "RUC" : snapshot.customer.identityType === "1" ? "DNI" : "Documento"}: ${snapshot.customer.identityNumber}`,
    size,
    12,
  );
  if (snapshot.customer.address) text(snapshot.customer.address);
  text(
    `Moneda: ${snapshot.currencyCode} · Entorno: ${snapshot.environment ?? "Sin contexto"}`,
    size,
    12,
  );
  const tableHeader = blocks.length;
  if (!ticket)
    row(
      [
        { text: "Descripción", width: content - 245 },
        { text: "Cant.", width: 45, align: "right" },
        { text: "Und.", width: 35, align: "center" },
        { text: "P. unit. *", width: 80, align: "right" },
        { text: "Importe", width: 85, align: "right" },
      ],
      9,
      12,
      true,
      true,
    );
  for (const line of snapshot.lines) {
    if (ticket) {
      text(`${line.lineNumber}. ${line.description}`, size, 4);
      row(
        [
          {
            text: `${quantity(line.quantity)} ${line.unitCode} × ${money(line.unitPriceWithTax)}`,
            width: content * 0.68,
          },
          {
            text: money(line.totalAmount),
            width: content * 0.32,
            align: "right",
          },
        ],
        size,
        10,
        true,
      );
    } else
      row(
        [
          {
            text: `${line.lineNumber}. ${line.description}`,
            width: content - 245,
          },
          { text: quantity(line.quantity), width: 45, align: "right" },
          { text: line.unitCode, width: 35, align: "center" },
          { text: money(line.unitPriceWithTax), width: 80, align: "right" },
          { text: money(line.totalAmount), width: 85, align: "right" },
        ],
        9,
        12,
        true,
      );
  }
  const summaryStart = blocks.length;
  text("* Precios unitarios con impuestos incluidos.", ticket ? 7 : 8, 10);
  for (const [label, value] of [
    ["Base de ítems sin IGV", snapshot.totals.taxableAmount],
    ["IGV", snapshot.totals.igvAmount],
    [`TOTAL ${snapshot.currencyCode}`, snapshot.totals.payableAmount],
  ])
    row(
      [
        { text: label, width: content * 0.65 },
        { text: money(value), width: content * 0.35, align: "right" },
      ],
      label.startsWith("TOTAL") ? size + 3 : size,
      8,
    );
  if (snapshot.paymentTerms) {
    const payment = snapshot.paymentTerms;
    if (payment.type === 'CONTADO') text('Forma de pago: Contado', size, 8);
    else if (payment.type === 'CREDITO' && snapshot.documentTypeCode === '01' &&
      payment.currencyCode === snapshot.currencyCode && payment.installments.length >= 1 && payment.installments.length <= 999) {
      text('Forma de pago: Crédito', size, 6);
      text(`Saldo pendiente: ${payment.currencyCode} ${money(payment.pendingAmount)}`, size, 8);
      for (const [index, installment] of payment.installments.entries()) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(installment.dueDate) ||
          installment.currencyCode && installment.currencyCode !== payment.currencyCode) throw new Error('Cuota del snapshot inválida');
        row([
          { text: `Cuota ${index + 1} · ${installment.dueDate}`, width: content * 0.65 },
          { text: `${payment.currencyCode} ${money(installment.amount)}`, width: content * 0.35, align: 'right' },
        ], ticket ? 7 : 9, 6);
      }
    } else throw new Error('Forma de pago del snapshot fuera del perfil');
  }
  if (verifiedQa) {
    text(verifiedQa.status === 'SIGNED_LOCAL' ? 'FIRMA LOCAL · SIN CDR NI ENVÍO' : 'CIRCUITO SIMULADO · CDR NO OFICIAL', ticket ? 8 : 10, 6);
    text(`Estado de prueba: ${verifiedQa.status}`, ticket ? 7 : 9, 6);
    blocks.push({ cells: [], size: 0, gap: 8, image: 'QR' });
    text(`Hash XML firmado: ${verifiedQa.digestValue}`, ticket ? 6.5 : 8, 6);
    text('QR de prueba con hash verificado. No acredita aceptación SUNAT.', ticket ? 7 : 9, 6);
  } else text("Firma digital, hash y QR fiscal: pendientes.", ticket ? 7 : 9, 5);
  text(
    "Esta prueba no acredita envío ni aceptación de SUNAT.",
    ticket ? 7 : 9,
    12,
  );
  blocks.push({ cells: [], size: 0, gap: 8, image: "BRANDS" });
  text(IMPLEMENTATION_CREDIT, ticket ? 7 : 9, 5, ticket ? "center" : "left");

  // La representación A4 conserva sus bloques y datos, pero no el espaciado
  // térmico. Evita una segunda página casi vacía en documentos de una línea
  // cuando el resumen, QR y créditos se mantienen juntos. PDFs ya archivados
  // nunca se reescriben; el ticket conserva su geometría original.
  const lineGap = ticket ? 2 : 1;
  if (!ticket) for (const block of blocks) block.gap = Math.round(block.gap * 0.45);

  const doc = new PDFDocument({
    autoFirstPage: false,
    bufferPages: true,
    compress: true,
    info: {
      Title: `${snapshot.fullNumber} - Prueba local`,
      Author: "Mavric Tecnologies · FactuEz",
      CreationDate: new Date(snapshot.issueDate),
    },
  });
  doc.registerFont("Inter", inter).font("Inter");
  const measure = new PDFDocument({ size: [width, 14400], margin: 0 });
  measure.registerFont("Inter", inter).font("Inter");
  const heights = blocks.map((block) => {
    if (block.image === 'QR') return (ticket ? 100 : noteDocument ? 96 : 112) + block.gap;
    if (block.image === "BRANDS") return (ticket ? 10 * MM : 34) + block.gap;
    if (block.image === "SAN_JOSE")
      return ((ticket ? 120 : 160) * 222) / 961 + block.gap;
    measure.fontSize(block.size);
    return (
      Math.max(
        ...block.cells.map((cell) =>
          measure.heightOfString(cell.text, {
            width: cell.width - 7,
            lineGap,
          }),
        ),
      ) + block.gap
    );
  });
  measure.end();
  measure.resume();
  const pageHeight = ticket
    ? Math.max(
        150,
        heights.reduce((sum, height) => sum + height, margin * 2),
      )
    : 841.89;
  if (pageHeight > 14400) throw new Error("Ticket demasiado largo; utilice A4");
  const result = new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  doc.addPage({ size: [width, pageHeight], margin: 0 });
  let y = margin;
  const drawBlock = (block: Block, height: number) => {
    if (block.image) {
      if (block.image === 'QR') {
        const side = ticket ? 100 : noteDocument ? 96 : 112;
        doc.image(qrImage!, ticket ? (width - side) / 2 : margin, y, { width: side, height: side }); y += height; return;
      }
      if (block.image === "SAN_JOSE") {
        const logoWidth = ticket ? 120 : 160;
        const logoHeight = (logoWidth * 222) / 961;
        const x = ticket ? (width - logoWidth) / 2 : margin;
        // Mismo recorte de presentación que SanJoseLogo en la PWA; el asset
        // original se conserva y nunca reemplaza datos fiscales del emisor.
        doc.save().rect(x, y, logoWidth, logoHeight).clip();
        doc.image(
          sanJoseLogo,
          x - (130 * logoWidth) / 961,
          y - (286 * logoWidth) / 961,
          { width: (1200 * logoWidth) / 961, height: (800 * logoWidth) / 961 },
        );
        doc.restore();
        y += height;
        return;
      }
      const logoSize = ticket ? 10 * MM : 34;
      const factuezWidth = ticket ? 90 : 128;
      const factuezHeight = (factuezWidth * 250) / 799;
      const gap = ticket ? 14 : 22;
      const pairWidth = factuezWidth + gap + logoSize;
      const x = ticket ? (width - pairWidth) / 2 : margin;
      const logoY = y + (logoSize - factuezHeight) / 2;
      // Recorte CSS equivalente a FactuezLogo; PNG lossless del WebP original.
      doc.save().rect(x, logoY, factuezWidth, factuezHeight).clip();
      doc.image(factuezLogo, x - factuezWidth * 0.1064, logoY - factuezHeight * 0.26, {
        width: factuezWidth * 1.5019,
      });
      doc.restore();
      doc.image(mavricLogo, x + factuezWidth + gap, y, {
        width: logoSize,
        height: logoSize,
      });
      y += height;
      return;
    }
    if (block.shade)
      doc.rect(margin - 4, y - 4, content + 8, height).fill("#f0f0f0");
    let x = margin;
    doc.fontSize(block.size).fillColor("#191919");
    for (const cell of block.cells) {
      doc.text(cell.text, x, y, {
        width: cell.width - 7,
        lineGap,
        align: cell.align ?? "left",
      });
      x += cell.width;
    }
    y += height;
    if (block.rule)
      doc
        .moveTo(margin, y - 6)
        .lineTo(width - margin, y - 6)
        .lineWidth(0.4)
        .stroke("#dddddd");
  };
  for (const [index, block] of blocks.entries()) {
    const height = heights[index];
    const required =
      index === summaryStart
        ? heights.slice(summaryStart).reduce((sum, item) => sum + item, 0)
        : height;
    if (!ticket && y + required > pageHeight - 62) {
      doc.addPage({ size: [width, pageHeight], margin: 0 });
      doc
        .fontSize(9)
        .fillColor("#555555")
        .text(
          `${snapshot.fullNumber} · RUC ${snapshot.issuer.identityNumber} · PRUEBA LOCAL`,
          margin,
          margin,
          { width: content },
        );
      y = margin + 30;
      if (index > tableHeader && index < summaryStart)
        drawBlock(blocks[tableHeader], heights[tableHeader]);
    }
    drawBlock(block, height);
  }
  if (!ticket) {
    const pages = doc.bufferedPageRange();
    for (let page = 0; page < pages.count; page++) {
      doc.switchToPage(page);
      doc
        .fontSize(8)
        .fillColor("#666666")
        .text(
          `Prueba local · ${snapshot.fullNumber} · Página ${page + 1} de ${pages.count}`,
          margin,
          pageHeight - 35,
          { width: content, align: "right" },
        );
    }
  }
  doc.end();
  return result;
}
