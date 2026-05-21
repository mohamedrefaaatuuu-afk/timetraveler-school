import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Upload, CheckCircle2, XCircle, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { readExcelFile } from "@/lib/excel-export";

export interface ImportColumn {
  header: string;
  field: string;
  required?: boolean;
  transform?: (v: unknown) => unknown;
}

interface Props {
  entityName: string;
  columns: ImportColumn[];
  previewColumns?: string[];
  onImport: (rows: Record<string, unknown>[]) => Promise<void>;
  templateNote?: string;
}

interface ParsedRow {
  data: Record<string, unknown>;
  valid: boolean;
  errors: string[];
}

export function ExcelImportDialog({ entityName, columns, previewColumns, onImport, templateNote }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);

  const reset = () => { setRows([]); setDone(false); };

  const handleFile = async (file: File) => {
    try {
      const raw = await readExcelFile(file);
      const parsed: ParsedRow[] = raw.map((row) => {
        const data: Record<string, unknown> = {};
        const errors: string[] = [];

        for (const col of columns) {
          const rawVal = row[col.header];
          const val = rawVal !== undefined && rawVal !== null && rawVal !== "" ? rawVal : undefined;
          if (col.required && val === undefined) {
            errors.push(`"${col.header}" مطلوب`);
          }
          data[col.field] = val !== undefined ? (col.transform ? col.transform(val) : val) : null;
        }

        return { data, valid: errors.length === 0, errors };
      }).filter((r) => Object.values(r.data).some((v) => v !== null && v !== undefined && v !== ""));

      setRows(parsed);
      setDone(false);
      setOpen(true);
    } catch (e) {
      toast.error("تعذّر قراءة الملف — تأكد أنه ملف Excel صالح");
    }
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleConfirm = async () => {
    const valid = rows.filter((r) => r.valid);
    if (!valid.length) { toast.error("لا توجد صفوف صالحة للاستيراد"); return; }
    setImporting(true);
    try {
      await onImport(valid.map((r) => r.data));
      setDone(true);
      toast.success(`تم استيراد ${valid.length} ${entityName} بنجاح`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setImporting(false);
    }
  };

  const validCount = rows.filter((r) => r.valid).length;
  const invalidCount = rows.filter((r) => !r.valid).length;

  const displayCols = previewColumns ?? columns.slice(0, 4).map((c) => c.header);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />
      <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
        <Upload className="h-4 w-4 ms-1" /> استيراد Excel
      </Button>

      <Dialog open={open} onOpenChange={(v) => { if (!v) { setOpen(false); reset(); } }}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>استيراد {entityName} من Excel</DialogTitle>
          </DialogHeader>

          {done ? (
            <div className="text-center py-12 space-y-3">
              <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
              <p className="text-xl font-bold text-green-700">تم الاستيراد بنجاح</p>
              <p className="text-muted-foreground">تم إضافة {validCount} {entityName}</p>
              <Button onClick={() => { setOpen(false); reset(); }}>إغلاق</Button>
            </div>
          ) : (
            <>
              {/* Summary */}
              <div className="flex flex-wrap gap-3 p-3 bg-muted/40 rounded-lg">
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="gap-1"><CheckCircle2 className="h-3 w-3" /> صالح: {validCount}</Badge>
                </div>
                {invalidCount > 0 && (
                  <div className="flex items-center gap-2">
                    <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> أخطاء: {invalidCount}</Badge>
                    <span className="text-xs text-muted-foreground">الصفوف ذات الأخطاء لن تُستورد</span>
                  </div>
                )}
                {templateNote && (
                  <div className="flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                    <AlertTriangle className="h-3 w-3" /> {templateNote}
                  </div>
                )}
              </div>

              {rows.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">الملف فارغ أو لا يحوي بيانات</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8">#</TableHead>
                        <TableHead className="w-20">الحالة</TableHead>
                        {displayCols.map((h) => <TableHead key={h}>{h}</TableHead>)}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.slice(0, 50).map((row, i) => {
                        const col = columns.find((c) => displayCols.includes(c.header));
                        return (
                          <TableRow key={i} className={row.valid ? "" : "bg-destructive/5"}>
                            <TableCell className="text-muted-foreground text-xs">{i + 1}</TableCell>
                            <TableCell>
                              {row.valid
                                ? <Badge variant="outline" className="text-green-600 border-green-300 gap-1"><CheckCircle2 className="h-3 w-3" /> صالح</Badge>
                                : <Badge variant="outline" className="text-red-600 border-red-300 gap-1" title={row.errors.join(", ")}><XCircle className="h-3 w-3" /> خطأ</Badge>
                              }
                            </TableCell>
                            {displayCols.map((h) => {
                              const c = columns.find((col) => col.header === h);
                              const val = c ? row.data[c.field] : "";
                              return <TableCell key={h} className="text-sm">{String(val ?? "—")}</TableCell>;
                            })}
                          </TableRow>
                        );
                      })}
                      {rows.length > 50 && (
                        <TableRow>
                          <TableCell colSpan={displayCols.length + 2} className="text-center text-muted-foreground text-xs py-2">
                            ... و{rows.length - 50} صف آخر
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => { setOpen(false); reset(); }}>إلغاء</Button>
                <Button onClick={handleConfirm} disabled={importing || validCount === 0}>
                  {importing ? <Loader2 className="h-4 w-4 ms-2 animate-spin" /> : <Upload className="h-4 w-4 ms-2" />}
                  استيراد {validCount} صف
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
