import { Card } from "@/components/ui/card";

/**
 * A clean, friendly empty state for modules that arrive in later phases
 * (CLAUDE.md §19). Keeps navigation working without broken links.
 */
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
        <h1 className="text-foreground text-2xl font-bold tracking-tight">
          {title}
        </h1>
        <p className="text-muted mt-3 leading-7">{message}</p>
      </Card>
    </div>
  );
}
