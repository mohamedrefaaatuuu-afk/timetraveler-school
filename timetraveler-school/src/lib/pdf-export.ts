import jsPDF from "jspdf";
import html2canvas from "html2canvas-pro";

export interface PdfMeta {
  title: string;
  subtitle?: string;
  schoolName?: string;
  logoUrl?: string | null;
}

/**
 * Render an HTML node into an A4 landscape PDF.
 * Arabic text is rasterized via html2canvas (jsPDF text doesn't shape Arabic),
 * so embed all Arabic content inside `node`. PDF chrome uses Latin only.
 */
export async function nodeToPdf(node: HTMLElement, _meta: PdfMeta, filename: string) {
  const canvas = await html2canvas(node, {
    scale: 2,
    backgroundColor: "#ffffff",
    useCORS: true,
    logging: false,
  });
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 8;
  const footerH = 7;
  const contentW = pageW - margin * 2;
  const contentH = pageH - margin * 2 - footerH;

  const imgW = contentW;
  const imgH = (canvas.height * imgW) / canvas.width;
  const dataUrl = canvas.toDataURL("image/jpeg", 0.92);

  if (imgH <= contentH) {
    pdf.addImage(dataUrl, "JPEG", margin, margin, imgW, imgH, undefined, "FAST");
    drawFooter(pdf, pageW, pageH, margin, 1, 1);
  } else {
    // Slice canvas vertically into pages
    const pxPerMm = canvas.width / imgW;
    const sliceHpx = contentH * pxPerMm;
    const totalPages = Math.ceil(canvas.height / sliceHpx);
    const tmp = document.createElement("canvas");
    tmp.width = canvas.width;
    const ctx = tmp.getContext("2d")!;
    for (let i = 0; i < totalPages; i++) {
      const sy = i * sliceHpx;
      const sh = Math.min(sliceHpx, canvas.height - sy);
      tmp.height = sh;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, tmp.width, tmp.height);
      ctx.drawImage(canvas, 0, sy, canvas.width, sh, 0, 0, canvas.width, sh);
      const sliceUrl = tmp.toDataURL("image/jpeg", 0.92);
      const sliceMm = (sh / canvas.width) * imgW;
      if (i > 0) pdf.addPage();
      pdf.addImage(sliceUrl, "JPEG", margin, margin, imgW, sliceMm, undefined, "FAST");
      drawFooter(pdf, pageW, pageH, margin, i + 1, totalPages);
    }
  }

  pdf.save(filename);
}

function drawFooter(pdf: jsPDF, pageW: number, pageH: number, margin: number, page: number, total: number) {
  pdf.setFontSize(8);
  pdf.setTextColor(120, 120, 120);
  const date = new Date().toISOString().slice(0, 10);
  pdf.text(`${page} / ${total}`, pageW - margin, pageH - margin / 2, { align: "right" });
  pdf.text(date, margin, pageH - margin / 2, { align: "left" });
  pdf.setTextColor(0, 0, 0);
}
