import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, ArrowLeft, CalendarDays, X, ChevronDown } from "lucide-react";

export const Route = createFileRoute("/login")({
  component: LandingPage,
});

const schools = [
  {
    id: 1,
    name: "مدارس قناديل الشرق الأهلية",
    logo: "/schools/qanadeel.png",
    gender: "للبنين والبنات",
    genderColor: "bg-violet-100 text-violet-700",
    description: "قناديل تضيء الطريق — توحد شعلة المعرفة في قلب كل طالب",
    stages: "رياض أطفال • ابتدائي • متوسط",
    borderColor: "border-violet-400",
    btnColor: "bg-violet-700 hover:bg-violet-800",
    bgColor: "bg-violet-50",
  },
  {
    id: 2,
    name: "مدارس أجيال المعالي الأهلية",
    logo: "/schools/agial.png",
    gender: "للبنين والبنات",
    genderColor: "bg-amber-100 text-amber-700",
    description: "سنا جيل يحمل قيم الريادة والتميز والإبداع",
    stages: "رياض أطفال • ابتدائي • متوسط",
    borderColor: "border-amber-400",
    btnColor: "bg-amber-700 hover:bg-amber-800",
    bgColor: "bg-amber-50",
    featured: true,
  },
  {
    id: 3,
    name: "مدارس الضاحية الأهلية للبنات",
    logo: "/schools/aldahia-girls.png",
    gender: "للبنات",
    genderColor: "bg-blue-100 text-blue-700",
    description: "بيئة تعليمية أمينة ومتكاملة لتنمي أفضل مهارات الطالبات",
    stages: "رياض أطفال • ابتدائي • متوسط",
    borderColor: "border-blue-400",
    btnColor: "bg-blue-700 hover:bg-blue-800",
    bgColor: "bg-blue-50",
  },
  {
    id: 4,
    name: "مدارس الضاحية الأهلية للبنين",
    logo: "/schools/aldahia-boys.png",
    gender: "للبنين",
    genderColor: "bg-red-100 text-red-700",
    description: "بيئة تعليمية متطورة لطلاب بمناهج أصيلة وتقنيات حديثة",
    stages: "ابتدائي • متوسط • ثانوي",
    borderColor: "border-red-400",
    btnColor: "bg-red-700 hover:bg-red-800",
    bgColor: "bg-red-50",
  },
];

function LandingPage() {
  const navigate = useNavigate();
  const [showLogin, setShowLogin] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error("فشل تسجيل الدخول", { description: error.message });
      return;
    }
    toast.success("مرحبًا بك");
    navigate({ to: "/dashboard" });
  };

  const handleForgot = async () => {
    if (!email) { toast.error("أدخل البريد الإلكتروني أولاً"); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) toast.error(error.message);
    else toast.success("تم إرسال رابط إعادة التعيين إلى بريدك");
  };

  return (
    <div className="min-h-screen font-sans" dir="rtl">
      {/* Navbar */}
      <nav className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-6 py-3 bg-white/10 backdrop-blur-md border-b border-white/10">
        <button
          onClick={() => setShowLogin(true)}
          className="flex items-center gap-2 text-sm text-white/90 border border-white/30 rounded-full px-4 py-1.5 hover:bg-white/10 transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          تسجيل الدخول
        </button>
        <div className="flex items-center gap-2">
          <span className="text-white font-bold text-sm leading-tight text-right">
            مجموعة المالكي<br />
            <span className="text-xs font-normal opacity-80">التعليمية</span>
          </span>
          <div className="h-9 w-9 rounded-xl bg-white/20 flex items-center justify-center">
            <CalendarDays className="h-5 w-5 text-white" />
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section
        className="relative min-h-screen flex flex-col items-center justify-center text-center px-4 pt-16 pb-40"
        style={{ background: "linear-gradient(135deg, #0d3d30 0%, #0f5040 30%, #166651 60%, #1a7a62 100%)" }}
      >
        <div
          className="absolute inset-0 opacity-5"
          style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }}
        />

        <div className="relative mb-4">
          <img src="/logo.png" alt="مجموعة المالكي التعليمية" className="h-24 w-auto object-contain mx-auto drop-shadow-2xl" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        </div>

        <div className="relative mb-6 inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 text-white/90 text-sm backdrop-blur-sm">
          <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
          نظام الجداول الذكي للمجموعة
        </div>

        <h1 className="relative text-5xl md:text-7xl font-extrabold text-white leading-tight mb-2">
          مجموعة المالكي
        </h1>
        <h2 className="relative text-4xl md:text-6xl font-extrabold text-amber-400 leading-tight mb-6">
          التعليمية
        </h2>

        <p className="relative text-white/70 text-base md:text-lg max-w-md mb-8">
          بوابة موحدة لإدارة الجداول الدراسية في مدارس المجموعة —<br />
          اختر مدرستك وادخل لنظام الجدولة الذكي
        </p>

        <button
          onClick={() => setShowLogin(true)}
          className="relative flex items-center gap-2 bg-white/15 border border-white/30 text-white rounded-full px-6 py-2.5 hover:bg-white/25 transition text-sm font-medium"
        >
          <ArrowLeft className="h-4 w-4" />
          تسجيل الدخول للنظام
        </button>

        <div className="absolute bottom-24 flex flex-col items-center gap-1 text-white/50 text-xs">
          تصفح المدارس
          <ChevronDown className="h-4 w-4 animate-bounce" />
        </div>

        <div className="absolute bottom-8 inset-x-0 flex justify-center gap-12 md:gap-24 text-white">
          {[
            { value: "4", label: "مدارس أهلية" },
            { value: "3", label: "مراحل دراسية" },
            { value: "جداول", label: "ذكية تلقائية" },
            { value: "فوري", label: "كشف التعارضات" },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-2xl md:text-3xl font-bold">{s.value}</p>
              <p className="text-xs text-white/60 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Schools Section */}
      <section className="bg-gray-50 py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <span className="inline-block bg-teal-100 text-teal-700 text-xs font-semibold px-4 py-1 rounded-full mb-4">
              مدارس المجموعة
            </span>
            <h2 className="text-4xl font-extrabold text-gray-900 mb-3">اختر مدرستك</h2>
            <p className="text-gray-500 text-base">
              كل مدرسة لها نظامها المستقل — بياناتها وجداولها وحساباتها منفصلة تماماً
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {schools.map((school) => (
              <div
                key={school.id}
                className={`relative bg-white rounded-2xl border-2 ${school.borderColor} ${school.featured ? "shadow-2xl scale-105" : "shadow-md"} p-5 flex flex-col gap-3 transition hover:shadow-xl cursor-pointer`}
                onClick={() => setShowLogin(true)}
              >
                {school.featured && (
                  <div className="absolute -top-3 right-4 bg-amber-500 text-white text-[10px] font-bold px-3 py-0.5 rounded-full">
                    ⭐ مميزة
                  </div>
                )}
                <div className="flex items-start justify-between">
                  <div className={`h-16 w-16 rounded-xl ${school.bgColor} flex items-center justify-center p-1 border border-gray-100`}>
                    <img
                      src={school.logo}
                      alt={school.name}
                      className="h-full w-full object-contain"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${school.genderColor}`}>
                    {school.gender}
                  </span>
                </div>
                <h3 className="font-bold text-gray-900 text-sm leading-snug">{school.name}</h3>
                <p className="text-xs text-gray-500 leading-relaxed flex-1">{school.description}</p>
                <div>
                  <p className="text-[10px] text-gray-400 mb-1">المراحل الدراسية</p>
                  <p className="text-xs font-medium text-gray-700">{school.stages}</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowLogin(true); }}
                  className={`w-full mt-1 flex items-center justify-center gap-2 text-white text-sm font-semibold py-2.5 rounded-xl transition ${school.btnColor}`}
                >
                  الدخول للنظام
                  <ArrowLeft className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>

          <div className="mt-8 flex items-center gap-3 bg-teal-50 border border-teal-200 rounded-xl px-5 py-4">
            <span className="text-teal-500 text-lg">🔒</span>
            <div>
              <p className="font-semibold text-teal-800 text-sm">بيانات منفصلة لكل مدرسة</p>
              <p className="text-teal-600 text-xs mt-0.5">كل مدرسة تعمل بقاعدة بيانات مستقلة — جداولها ومعلموها وتقاريرها معزولة تماماً</p>
            </div>
          </div>

          <div className="mt-6 text-center">
            <button
              onClick={() => setShowLogin(true)}
              className="inline-flex items-center gap-2 bg-gray-900 text-white text-sm font-medium px-6 py-3 rounded-full hover:bg-gray-800 transition"
            >
              <ArrowLeft className="h-4 w-4" />
              تسجيل الدخول للنظام
            </button>
          </div>
        </div>
      </section>

      {/* Login Modal */}
      {showLogin && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
          onClick={(e) => e.target === e.currentTarget && setShowLogin(false)}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 relative" dir="rtl">
            <button
              onClick={() => setShowLogin(false)}
              className="absolute top-4 left-4 text-gray-400 hover:text-gray-600 transition"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="text-center mb-6">
              <div className="mx-auto h-12 w-12 rounded-xl bg-teal-600 flex items-center justify-center mb-3">
                <CalendarDays className="h-6 w-6 text-white" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">تسجيل الدخول</h2>
              <p className="text-xs text-gray-500 mt-1">ادخل بياناتك للوصول لنظام الجداول</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">البريد الإلكتروني</Label>
                <Input
                  id="email" type="email" required
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  dir="ltr" placeholder="example@school.com"
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">كلمة المرور</Label>
                  <button type="button" onClick={handleForgot} className="text-xs text-teal-600 hover:underline">
                    نسيت كلمة المرور؟
                  </button>
                </div>
                <Input
                  id="password" type="password" required
                  value={password} onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-teal-700 hover:bg-teal-800 text-white"
                disabled={loading}
              >
                {loading && <Loader2 className="ms-2 h-4 w-4 animate-spin" />}
                دخول
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
