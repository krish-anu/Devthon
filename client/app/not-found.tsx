import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <Link href="/" className="absolute right-6 top-6 text-sm text-(--brand)">
        Go Home
      </Link>
      <Card className="w-full max-w-md space-y-6 text-center">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-(--brand)">
            Page Not Found
          </p>
          <h1 className="text-3xl font-semibold">We can't find that page.</h1>
          <p className="mt-2 text-sm text-(--muted)">
            The page you are looking for might have moved or never existed.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <Button asChild>
            <Link href="/">Back to Home</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/under-construction">Contact Support</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
