const GEMINI_API_KEY = "AIzaSyBv-ZCsJOMDICDNFYnqHVvA7yN-QOke8_M";
const MODEL = "gemini-2.0-flash";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

export function isGeminiConfigured(): boolean {
  return GEMINI_API_KEY.length > 10;
}

async function callGemini(
  systemPrompt: string,
  userMessage: string,
  options: { temperature?: number; jsonMode?: boolean } = {}
): Promise<string> {
  const body = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: "user", parts: [{ text: userMessage }] }],
    generationConfig: {
      temperature: options.temperature ?? 0.7,
      maxOutputTokens: 8192,
      ...(options.jsonMode ? { responseMimeType: "application/json" } : {}),
    },
  };

  const res = await fetch(`${API_URL}?key=${GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? `HTTP ${res.status}`);
  if (data.promptFeedback?.blockReason)
    throw new Error(`تم حظر الطلب: ${data.promptFeedback.blockReason}`);
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("لم يتم استلام رد من Gemini");
  return text;
}

export type ChatMessage = { role: "user" | "assistant"; text: string };

export async function chatWithGemini(
  history: ChatMessage[],
  message: string
): Promise<string> {
  const systemPrompt = `أنت مساعد ذكي متخصص في إدارة الجداول المدرسية لمجموعة المالكي التعليمية.
تساعد المعلمين والمديرين في:
- فهم وتحليل الجداول الدراسية
- اقتراح حلول لمشاكل الجدولة (تعارضات، فراغات، توزيع غير متوازن)
- شرح كيفية استخدام النظام
- الإجابة عن أسئلة عامة عن المنهج والتخطيط الدراسي

قواعد:
- اكتب بالعربية الفصحى الواضحة
- كن مختصراً ومفيداً (٢-٤ فقرات قصيرة)
- استخدم نقاط ومسافات لتسهيل القراءة
- إذا لم تكن متأكداً، قل ذلك بصراحة
`;

  const historyText = history
    .slice(-6)
    .map((m) => (m.role === "user" ? `المستخدم: ${m.text}` : `المساعد: ${m.text}`))
    .join("\n");

  const fullMessage = historyText ? `${historyText}\n\nالمستخدم: ${message}` : message;
  return callGemini(systemPrompt, fullMessage, { temperature: 0.7 });
}

export type ScheduleInput = {
  schoolId: string;
  workingDays: string[];
  periodsPerDay: number;
  classes: { id: string; name: string; daily_lessons: number }[];
  teachers: { id: string; name: string; max_weekly_lessons: number; max_daily_lessons: number; working_days: string[] }[];
  subjects: { id: string; name: string; priority: number }[];
  requirements: { class_id: string; subject_id: string; teacher_id: string | null; weekly_count: number; double_period: boolean }[];
  unavailability: { teacher_id: string; day: string; period_no: number }[];
  preferences?: string;
};

export type ScheduleOutput = {
  entries: { class_id: string; subject_id: string; teacher_id: string; day: string; period_no: number; double_period: boolean }[];
  notes: string;
  unplaced: { class_id: string; subject_id: string; missing: number }[];
};

export async function generateScheduleWithGemini(input: ScheduleInput): Promise<ScheduleOutput> {
  const systemPrompt = `أنت محرّك جدولة مدرسي ذكي متقدم. مهمتك توليد جدول دراسي مثالي يحقق:
- لا يوجد تعارض (معلم في فصلين بنفس الوقت، أو فصل لمعلمين)
- احترام أيام عمل المعلم وأيام عدم توفّره
- احترام الحدّ الأسبوعي واليومي لكل معلم
- توزيع المواد الصعبة (priority عالي) في أول اليوم
- توزيع متوازن للمواد عبر الأسبوع (لا تجميع كله في يوم واحد)
- الحفاظ على double_period (حصتين متتاليتين) عند الإمكان
- ملء جميع الفترات للفصول

أعد JSON فقط بالشكل التالي:
{
  "entries": [{"class_id":"...","subject_id":"...","teacher_id":"...","day":"sunday","period_no":1,"double_period":false}],
  "notes": "ملاحظات قصيرة بالعربية عن جودة الجدول",
  "unplaced": [{"class_id":"...","subject_id":"...","missing":2}]
}`;

  const userMessage = `بيانات المدرسة:

أيام العمل: ${input.workingDays.join(", ")}
عدد الحصص يومياً: ${input.periodsPerDay}

الفصول (${input.classes.length}):
${input.classes.map((c) => `- ${c.id} (${c.name}): ${c.daily_lessons} حصة يومياً`).join("\n")}

المعلمون (${input.teachers.length}):
${input.teachers.map((t) => `- ${t.id} (${t.name}): max أسبوعي ${t.max_weekly_lessons}, يومي ${t.max_daily_lessons}, أيام: ${t.working_days.join(",")}`).join("\n")}

المواد (${input.subjects.length}):
${input.subjects.map((s) => `- ${s.id} (${s.name}): أولوية ${s.priority}`).join("\n")}

المتطلبات (${input.requirements.length}):
${input.requirements.map((r) => `- فصل ${r.class_id} يحتاج مادة ${r.subject_id} (معلم ${r.teacher_id ?? "غير محدد"}) × ${r.weekly_count} حصة${r.double_period ? " [حصة مزدوجة]" : ""}`).join("\n")}

أوقات عدم توفّر المعلمين:
${input.unavailability.length === 0 ? "لا يوجد" : input.unavailability.map((u) => `- ${u.teacher_id}: ${u.day} ح${u.period_no}`).join("\n")}

${input.preferences ? `تفضيلات إضافية:\n${input.preferences}` : ""}

ولّد الجدول المثالي.`;

  const raw = await callGemini(systemPrompt, userMessage, { jsonMode: true, temperature: 0.4 });
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.entries)) throw new Error("invalid entries");
    return parsed as ScheduleOutput;
  } catch {
    throw new Error("فشل في فهم رد Gemini — حاول مرة أخرى");
  }
}

export type AnalysisInput = {
  workingDays: string[];
  periodsPerDay: number;
  entries: { class_id: string; class_name: string; subject_name: string; teacher_name: string; day: string; period_no: number }[];
  totalRequired: number;
};

export type AnalysisOutput = {
  overall_score: number;
  strengths: string[];
  issues: { severity: "high" | "medium" | "low"; title: string; description: string; suggestion: string }[];
  summary: string;
  optimization_tips: string[];
};

export async function analyzeScheduleWithGemini(input: AnalysisInput): Promise<AnalysisOutput> {
  const systemPrompt = `أنت خبير تحليل جداول مدرسية. حلّل الجدول المقدّم وأعطِ:
- تقييم شامل (٠-١٠٠)
- نقاط القوة
- المشاكل مع شدّتها (high/medium/low) واقتراح حلّ لكل واحدة
- ملخص نهائي
- نصائح تحسين

ركّز على:
- توازن توزيع المواد عبر الأيام
- الفراغات في جدول المعلمين والفصول
- تجميع الحصص الصعبة في وقت غير مناسب (آخر اليوم)
- استغلال الطاقة الاستيعابية
- التنوّع داخل اليوم الواحد

أعد JSON فقط:
{
  "overall_score": 85,
  "strengths": ["...", "..."],
  "issues": [{"severity":"high","title":"...","description":"...","suggestion":"..."}],
  "summary": "...",
  "optimization_tips": ["...", "..."]
}`;

  const byDay: Record<string, typeof input.entries> = {};
  for (const e of input.entries) (byDay[e.day] ||= []).push(e);

  const scheduleText = input.workingDays
    .map((day) => {
      const slots = (byDay[day] ?? []).sort((a, b) => a.period_no - b.period_no);
      return `\n📅 ${day}:\n${slots.length === 0 ? "  (فارغ)" : slots.map((s) => `  ح${s.period_no}: ${s.class_name} | ${s.subject_name} | ${s.teacher_name}`).join("\n")}`;
    })
    .join("\n");

  const userMessage = `الجدول الحالي (${input.entries.length} حصة من أصل ${input.totalRequired} مطلوبة):

أيام العمل: ${input.workingDays.join(", ")}
عدد الحصص اليومية: ${input.periodsPerDay}
${scheduleText}

حلّل هذا الجدول وأعطِ تقريراً شاملاً.`;

  const raw = await callGemini(systemPrompt, userMessage, { jsonMode: true, temperature: 0.5 });
  try {
    return JSON.parse(raw) as AnalysisOutput;
  } catch {
    throw new Error("فشل في فهم رد التحليل");
  }
}
