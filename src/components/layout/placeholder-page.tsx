import { Card } from "@/components/ui/card";

export function PlaceholderPage({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <Card className="py-16 text-center">
        {/* Visual indicator */}
        <div
          className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl text-xl"
          style={{
            background:
              "linear-gradient(135deg, rgba(199,111,147,0.12) 0%, rgba(172,92,127,0.18) 100%)",
            border: "1px solid rgba(172,92,127,0.15)",
          }}
        >
          ✦
        </div>

        <h1 className="text-foreground text-xl font-bold tracking-tight">{title}</h1>
        <p className="text-muted mx-auto mt-3 max-w-sm text-sm leading-7">{message}</p>

        <span
          className="mt-6 inline-block rounded-full px-3 py-1 text-xs font-medium"
          style={{
            background: "rgba(43,37,48,0.05)",
            color: "#8a8190",
          }}
        >
          בקרוב
        </span>
      </Card>
    </div>
  );
}
