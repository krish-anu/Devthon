import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <Link
        href="/"
        className="absolute right-6 top-6 text-sm text-(--brand)"
      >
        Go Home
      </Link>

      {/* Content */}
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <Card className="w-full max-w-md space-y-6 text-center">
          <div className="text-6xl">😕</div>
          <div>
            <h1 className="text-5xl font-bold text-foreground">404</h1>
            <p className="mt-2 text-xl font-semibold text-foreground">
              Page Not Found
            </p>
            <p className="mt-2 text-sm text-(--muted)">
              The page you&apos;re looking for doesn&apos;t exist or has been
              moved.
              <br />
              Let&apos;s get you back on track.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button
              asChild
              className="bg-(--brand) text-white hover:bg-(--brand-strong)"
            >
              <Link href="/">← Back to Home</Link>
            </Button>
            <Button
              variant="outline"
              asChild
              className="border-(--brand) text-(--brand-strong) hover:bg-(--brand)/10"
            >
              <Link href="/under-construction">Contact Support</Link>
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
