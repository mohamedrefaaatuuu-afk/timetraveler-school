import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet, Link, createRootRouteWithContext, useRouter,
  HeadContent, Scripts,
} from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/hooks/use-auth";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4" dir="rtl">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold">الصفحة غير موجودة</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          الصفحة التي تبحث عنها غير موجودة أو تم نقلها.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          العودة للرئيسية
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4" dir="rtl">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">حدث خطأ غير متوقع</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="mt-6 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          إعادة المحاولة
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#4f46e5" },
      { title: "جدولة برو - نظام إدارة الجداول المدرسية" },
      { name: "description", content: "نظام احترافي متكامل لإدارة الجداول المدرسية، توليد تلقائي، حل التعارضات، إدارة الاحتياطي والتقارير." },
      { property: "og:title", content: "جدولة برو - نظام إدارة الجداول المدرسية" },
      { property: "og:description", content: "نظام احترافي متكامل لإدارة الجداول المدرسية، توليد تلقائي، حل التعارضات، إدارة الاحتياطي والتقارير." },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "جدولة برو - نظام إدارة الجداول المدرسية" },
      { name: "twitter:description", content: "نظام احترافي متكامل لإدارة الجداول المدرسية، توليد تلقائي، حل التعارضات، إدارة الاحتياطي والتقارير." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/172a0a65-b25c-4db0-8309-bb1cbb0d7ba2/id-preview-9b69c92d--d1971dc5-3f82-4cef-aeb5-61b77dd0e261.lovable.app-1779016792801.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/172a0a65-b25c-4db0-8309-bb1cbb0d7ba2/id-preview-9b69c92d--d1971dc5-3f82-4cef-aeb5-61b77dd0e261.lovable.app-1779016792801.png" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&family=Tajawal:wght@400;500;700&display=swap" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", href: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { rel: "apple-touch-icon", href: "/icon-192.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    // Bypass Lovable.dev school picker — redirect to login directly
    const hash = window.location.hash;
    if (hash === "#/schools" || hash === "" || hash === "#/") {
      window.location.replace("/#/login");
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Outlet />
        <Toaster position="top-center" richColors closeButton />
      </AuthProvider>
    </QueryClientProvider>
  );
}
