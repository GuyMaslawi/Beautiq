import Link from "next/link";
import { Button } from "@/components/ui/button";

// עמוד 404 כללי — שומר על השפה הוויזואלית של Allura גם כשמשהו לא נמצא.
export default function NotFound() {
  return (
    <div className="app-ambient flex min-h-screen items-center justify-center px-4" dir="rtl">
      <div className="aura-card relative max-w-md rounded-[1.75rem] px-8 py-10 text-center">
        <p className="eyebrow text-primary">404</p>
        <h1 className="font-display mt-3 text-2xl font-semibold text-foreground">
          העמוד לא נמצא
        </h1>
        <p className="mt-2.5 text-sm leading-7 text-muted">
          העמוד שחיפשת לא קיים או שהקישור השתנה.
        </p>
        <Link href="/" className="mt-6 inline-block">
          <Button>חזרה לעמוד הבית</Button>
        </Link>
      </div>
    </div>
  );
}
