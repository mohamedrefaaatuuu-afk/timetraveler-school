import type { DayOfWeek } from "./constants";

const fmtT = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export interface PrintEntry {
  day: DayOfWeek;
  period_no: number;
  subject_name: string;
  subject_color: string;
  secondary_label: string;
  classroom_name?: string;
  is_conflict?: boolean;
}

export interface PrintOptions {
  title: string;
  subtitle?: string;
  schoolName: string;
  logoSrc?: string | null;
  days: DayOfWeek[];
  dayLabels: Record<string, string>;
  periodsPerDay: number;
  periodTimes: { start: number; end: number }[];
  breakAfterPeriod: number;
  breakDurationMin: number;
  prayerBreaks?: { label: string; time: string; duration_min: number }[];
  entries: PrintEntry[];
}

function buildCols(opts: PrintOptions) {
  type Col =
    | { type: "period"; num: number }
    | { type: "break"; label: string; duration: number; variant: "amber" | "green" };

  const cols: Col[] = [];
  for (let p = 1; p <= opts.periodsPerDay; p++) {
    cols.push({ type: "period", num: p });
    if (opts.breakAfterPeriod > 0 && p === opts.breakAfterPeriod) {
      cols.push({ type: "break", label: "☕ فسحة", duration: opts.breakDurationMin, variant: "amber" });
    }
    if (opts.periodTimes[p - 1]) {
      const end = opts.periodTimes[p - 1].end;
      const next = opts.periodTimes[p]?.start ?? Infinity;
      for (const pb of opts.prayerBreaks ?? []) {
        const [ph, pm] = pb.time.split(":").map(Number);
        const pbm = ph * 60 + pm;
        if (pbm >= end && (p === opts.periodsPerDay || pbm < next)) {
          cols.push({ type: "break", label: `🕌 ${pb.label}`, duration: pb.duration_min, variant: "green" });
        }
      }
    }
  }
  return cols;
}

function buildTableHTML(opts: PrintOptions): string {
  const cols = buildCols(opts);
  const grid: Record<string, PrintEntry> = {};
  opts.entries.forEach((e) => { grid[`${e.day}:${e.period_no}`] = e; });

  const thBase = `style="padding:8px 6px;text-align:center;font-weight:700;font-size:12px;border-radius:6px;white-space:nowrap;"`;
  const thDay = `style="padding:8px 6px;text-align:center;font-weight:700;font-size:12px;border-radius:6px;min-width:65px;background:#edf2f7;"`;

  let thead = `<tr><th ${thDay}>اليوم</th>`;
  cols.forEach((col) => {
    if (col.type === "period") {
      const t = opts.periodTimes[col.num - 1];
      thead += `<th ${thBase} style="background:#edf2f7;padding:8px 6px;text-align:center;font-weight:700;font-size:12px;border-radius:6px;min-width:105px;">
        حصة ${col.num}<br><span style="font-size:10px;font-weight:400;color:#718096;">${t ? fmtT(t.start) : ""}</span>
      </th>`;
    } else {
      const bg = col.variant === "amber" ? "#fef3c7" : "#d1fae5";
      const fg = col.variant === "amber" ? "#92400e" : "#065f46";
      thead += `<th ${thBase} style="background:${bg};color:${fg};padding:6px 4px;text-align:center;font-weight:700;font-size:11px;border-radius:6px;min-width:52px;">
        ${col.label}<br><span style="font-size:10px;font-weight:400;">${col.duration}د</span>
      </th>`;
    }
  });
  thead += "</tr>";

  let tbody = "";
  opts.days.forEach((day) => {
    const dayLabel = opts.dayLabels[day] ?? day;
    let row = `<tr>
      <td style="padding:8px 6px;text-align:center;background:#edf2f7;border-radius:6px;font-weight:600;font-size:12px;white-space:nowrap;">${dayLabel}</td>`;
    cols.forEach((col) => {
      if (col.type === "break") {
        const bg = col.variant === "amber" ? "#fffbeb" : "#f0fdf4";
        const fg = col.variant === "amber" ? "#b45309" : "#16a34a";
        row += `<td style="padding:4px;text-align:center;background:${bg};border-radius:6px;">
          <span style="font-size:11px;font-weight:600;color:${fg};">${col.label}</span>
        </td>`;
        return;
      }
      const e = grid[`${day}:${col.num}`];
      if (e) {
        const borderColor = e.subject_color || "#94a3b8";
        const confStyle = e.is_conflict ? "background:#fff1f2;" : "background:white;";
        row += `<td style="padding:3px;vertical-align:top;">
          <div style="${confStyle}border:1px solid #e2e8f0;border-radius:6px;padding:5px 7px;min-height:56px;border-inline-start:4px solid ${borderColor};">
            <div style="font-weight:700;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100px;">${e.subject_name}</div>
            <div style="font-size:10px;color:#718096;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${e.secondary_label}</div>
            ${e.classroom_name ? `<div style="font-size:9px;color:#a0aec0;margin-top:1px;">📍 ${e.classroom_name}</div>` : ""}
          </div>
        </td>`;
      } else {
        row += `<td style="padding:3px;"><div style="min-height:56px;border:1px dashed #e2e8f0;border-radius:6px;"></div></td>`;
      }
    });
    row += "</tr>";
    tbody += row;
  });

  return `
    <table style="width:100%;border-collapse:separate;border-spacing:3px;font-size:12px;direction:rtl;">
      <thead>${thead}</thead>
      <tbody>${tbody}</tbody>
    </table>`;
}

function buildDocument(pages: { opts: PrintOptions; tableHTML: string }[]): string {
  const pagesHTML = pages
    .map(
      ({ opts, tableHTML }) => `
    <div class="page">
      <div class="header">
        ${opts.logoSrc ? `<img src="${opts.logoSrc}" alt="" class="logo" onerror="this.style.display='none'" />` : ""}
        <div class="header-text">
          <div class="school-name">${opts.schoolName}</div>
          <div class="school-sub">مجموعة المالكي التعليمية</div>
        </div>
        <div class="header-right-info">
          <div class="title">${opts.title}</div>
          ${opts.subtitle ? `<div class="subtitle">${opts.subtitle}</div>` : ""}
          <div class="date">${new Date().toLocaleDateString("ar-SA")}</div>
        </div>
      </div>
      <div class="table-wrap">${tableHTML}</div>
      <div class="footer">https://tables.almalkieducational.com</div>
    </div>`
    )
    .join('\n<div class="page-break"></div>\n');

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8"/>
<title>طباعة الجدول</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; direction: rtl; background: white; }
  .page { padding: 20px 24px 16px; max-width: 100%; }
  .header { display: flex; align-items: center; gap: 14px; padding-bottom: 12px; border-bottom: 2px solid #0d3d30; margin-bottom: 14px; }
  .logo { height: 60px; width: 60px; object-fit: contain; }
  .header-text { flex: 1; }
  .school-name { font-size: 16px; font-weight: 800; color: #0d3d30; }
  .school-sub { font-size: 11px; color: #718096; margin-top: 2px; }
  .header-right-info { text-align: left; }
  .title { font-size: 15px; font-weight: 700; color: #1a1a2e; }
  .subtitle { font-size: 12px; color: #4a5568; margin-top: 2px; }
  .date { font-size: 10px; color: #a0aec0; margin-top: 3px; }
  .table-wrap { overflow: visible; }
  .footer { text-align: center; font-size: 10px; color: #a0aec0; margin-top: 12px; padding-top: 8px; border-top: 1px solid #e2e8f0; }
  .page-break { page-break-after: always; }
  @media print {
    body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    .page-break { page-break-after: always; }
    .page { padding: 12px 16px; }
  }
</style>
</head>
<body>
${pagesHTML}
<script>
  window.addEventListener('load', () => {
    const imgs = document.querySelectorAll('img');
    const waitAll = Array.from(imgs).map(img =>
      img.complete ? Promise.resolve() : new Promise(r => { img.onload = r; img.onerror = r; })
    );
    Promise.all(waitAll).then(() => setTimeout(() => { window.print(); }, 400));
  });
<\/script>
</body>
</html>`;
}

export function printScheduleWindow(opts: PrintOptions): void {
  const tableHTML = buildTableHTML(opts);
  const html = buildDocument([{ opts, tableHTML }]);
  const w = window.open("", "_blank", "width=1000,height=700");
  if (!w) { alert("يرجى السماح بالنوافذ المنبثقة لتتمكن من الطباعة"); return; }
  w.document.write(html);
  w.document.close();
}

export function printAllSchedulesWindow(
  pages: { opts: PrintOptions }[]
): void {
  const built = pages.map((p) => ({ opts: p.opts, tableHTML: buildTableHTML(p.opts) }));
  const html = buildDocument(built);
  const w = window.open("", "_blank", "width=1000,height=700");
  if (!w) { alert("يرجى السماح بالنوافذ المنبثقة لتتمكن من الطباعة"); return; }
  w.document.write(html);
  w.document.close();
}
