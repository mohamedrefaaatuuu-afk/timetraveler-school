import * as XLSX from "xlsx";

export function downloadExcel(
  rows: Record<string, unknown>[],
  filename: string,
  sheetName = "البيانات"
) {
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = Object.keys(rows[0] ?? {}).map(() => ({ wch: 20 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function downloadTemplate(headers: string[], filename: string, sample?: Record<string, unknown>) {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...(sample ? [headers.map((h) => sample[h] ?? "")] : [])]);
  ws["!cols"] = headers.map(() => ({ wch: 20 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "القالب");
  XLSX.writeFile(wb, `قالب_${filename}.xlsx`);
}

export function downloadScheduleExcel(
  entries: { day: string; period_no: number; subject_name: string; teacher_name: string; class_name: string; classroom_name?: string }[],
  workingDays: string[],
  periodsPerDay: number,
  dayLabels: Record<string, string>,
  title: string,
  schoolName: string
) {
  const header = ["اليوم", ...Array.from({ length: periodsPerDay }, (_, i) => `حصة ${i + 1}`)];
  const aoa: unknown[][] = [
    [`المدرسة: ${schoolName}`],
    [`الجدول: ${title}`],
    [],
    header,
  ];

  const grid: Record<string, { subject: string; teacher: string; class: string; room?: string }> = {};
  entries.forEach((e) => {
    grid[`${e.day}:${e.period_no}`] = {
      subject: e.subject_name,
      teacher: e.teacher_name,
      class: e.class_name,
      room: e.classroom_name,
    };
  });

  workingDays.forEach((d) => {
    const row: unknown[] = [dayLabels[d] ?? d];
    for (let p = 1; p <= periodsPerDay; p++) {
      const cell = grid[`${d}:${p}`];
      row.push(cell ? `${cell.subject}\n${cell.teacher}${cell.room ? "\n" + cell.room : ""}` : "");
    }
    aoa.push(row);
  });

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [{ wch: 14 }, ...Array.from({ length: periodsPerDay }, () => ({ wch: 22 }))];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "الجدول");
  XLSX.writeFile(wb, `${title}.xlsx`);
}

export async function readExcelFile(file: File): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        resolve(XLSX.utils.sheet_to_json(ws));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}
