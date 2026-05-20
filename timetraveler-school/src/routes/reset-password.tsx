import { useState, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [valid, setValid] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    setValid(hash.includes("type=recovery") || hash.includes("access_token"));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("تم تحديث كلمة المرور");
    navigate({ to: "/dashboard" });
  };

  if (!valid) {
    return (
      <div className="min-h-screen flex items-center justify-center" dir="rtl">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <p>رابط غير صالح. اطلب رابطًا جديدًا من صفحة تسجيل الدخول.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-soft px-4" dir="rtl">
      <Card className="w-full max-w-md">
        <CardHeader><CardTitle>إعادة تعيين كلمة المرور</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="pw">كلمة المرور الجديدة</Label>
              <Input id="pw" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>تحديث</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
