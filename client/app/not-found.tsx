import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Recycle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-linear-to-br from-emerald-400 via-emerald-300 to-green-200">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-white">
            <Recycle className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold text-white">Trash2Cash</span>
        </div>
        <Button asChild className="bg-emerald-600 text-white hover:bg-emerald-700">
          <Link href="/">Go Home</Link>
        </Button>
      </header>

      {/* Content */}
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <Card className="w-full max-w-md space-y-6 text-center">
          <div className="text-6xl">😕</div>
          <div>
            <h1 className="text-5xl font-bold text-foreground">404</h1>
            <p className="mt-2 text-xl font-semibold text-foreground">Page Not Found</p>
            <p className="mt-2 text-sm text-(--muted)">
              The page you&apos;re looking for doesn&apos;t exist or has been moved.
              <br />
              Let&apos;s get you back on track.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button asChild className="bg-emerald-500 text-white hover:bg-emerald-600">
              <Link href="/">← Back to Home</Link>
            </Button>
            <Button variant="outline" asChild className="border-emerald-500 text-emerald-600 hover:bg-emerald-50">
              <Link href="/under-construction">Contact Support</Link>
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
