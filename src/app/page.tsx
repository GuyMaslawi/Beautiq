import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HOME, AUTH } from "@/lib/constants/he";

export default function Home() {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <Card className="w-full max-w-md text-center">
        <h1 className="text-foreground text-4xl font-bold tracking-tight">
          {HOME.heading}
        </h1>
        <p className="text-primary mt-3 text-lg font-medium">
          {HOME.subheading}
        </p>
        <p className="text-muted mt-4 text-base leading-7">{HOME.body}</p>

        <div className="mt-8 flex flex-col gap-3">
          <Link href="/signup" className="w-full">
            <Button className="w-full">{AUTH.signup.title}</Button>
          </Link>
          <Link href="/login" className="w-full">
            <Button variant="secondary" className="w-full">
              {AUTH.login.title}
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
