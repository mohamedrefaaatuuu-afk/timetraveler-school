import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { CalendarDays, Loader2 } from "lucide-react";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { toast.error("كلمة المرور يجب أن تكون 6 أحرف على الأقل"); return; }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: { full_name: fullName, school_name: schoolName },
      },
    });
    setLoading(false);
    if (error) { toast.error("فشل إنشاء الحساب", { description: error.message }); return; }
    toast.success("تم إنشاء الحساب بنجاح", { description: "تحقق من بريدك لتأكيد الحساب أو تابع الآن" });
    navigate({ to: "/dashboard" });
  };

  const handleGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) toast.error(error.message);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-soft px-4 py-8" dir="rtl">
      <Card className="w-full max-w-md shadow-elegant">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-primary flex items-center justify-center text-primary-foreground shadow-glow">
            <CalendarDays className="h-7 w-7" />
          </div>
          <CardTitle className="text-2xl">إنشاء حساب جديد</CardTitle>
          <CardDescription>أنشئ حساب المدرسة وابدأ خلال دقيقة</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button type="button" variant="outline" className="w-full" onClick={handleGoogle}>
            <svg className="ms-2 h-4 w-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38z"/></svg>
            التسجيل بحساب Google
          </Button>

          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">أو</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleSignup} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="name">الاسم الكامل</Label>
              <Input id="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="school">اسم المدرسة</Label>
              <Input id="school" required value={schoolName} onChange={(e) => setSchoolName(e.target.value)} placeholder="مثال: مدرسة النور الابتدائية" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">البريد الإلكتروني</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">كلمة المرور (6 أحرف على الأقل)</Label>
              <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="ms-2 h-4 w-4 animate-spin" />}
              إنشاء الحساب
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            لديك حساب بالفعل؟{" "}
            <Link to="/login" className="text-primary font-medium hover:underline">سجّل دخولك</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
