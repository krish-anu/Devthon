import { SectionHeading } from "@/components/shared/section-heading";
import { ScrollAnimatedSection } from "@/components/shared/scroll-animated-section";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Search, HelpCircle, FileText, Truck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function HelpCenterPage() {
  return (
    <div className="min-h-screen bg-background section-grid p-6 md:p-12">
      <div className="max-w-4xl mx-auto space-y-10">
        <div className="mb-8">
          <Button
            variant="ghost"
            asChild
            className="pl-0 hover:pl-2 transition-all"
          >
            <Link href="/" className="flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </Link>
          </Button>
        </div>

        <ScrollAnimatedSection>
          <div className="text-center space-y-4 mb-12">
            <h1 className="text-4xl font-bold">How can we help?</h1>
            <div className="max-w-md mx-auto relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search articles..." className="pl-10" />
            </div>
          </div>
        </ScrollAnimatedSection>

        <div className="grid gap-6 md:grid-cols-3">
          <ScrollAnimatedSection delay={100}>
            <Card className="p-6 text-center hover:bg-(--muted)/5 transition-colors cursor-pointer">
              <HelpCircle className="w-8 h-8 mx-auto mb-4 text-(--brand)" />
              <h3 className="font-semibold mb-2">Getting Started</h3>
              <p className="text-sm text-(--muted)">
                Account setup, verification, and first steps.
              </p>
            </Card>
          </ScrollAnimatedSection>
          <ScrollAnimatedSection delay={200}>
            <Card className="p-6 text-center hover:bg-(--muted)/5 transition-colors cursor-pointer">
              <Truck className="w-8 h-8 mx-auto mb-4 text-(--brand)" />
              <h3 className="font-semibold mb-2">Pickups & Logistics</h3>
              <p className="text-sm text-(--muted)">
                Scheduling, rescheduling, and cancellation.
              </p>
            </Card>
          </ScrollAnimatedSection>
          <ScrollAnimatedSection delay={300}>
            <Card className="p-6 text-center hover:bg-(--muted)/5 transition-colors cursor-pointer">
              <FileText className="w-8 h-8 mx-auto mb-4 text-(--brand)" />
              <h3 className="font-semibold mb-2">Payments & Pricing</h3>
              <p className="text-sm text-(--muted)">
                Rates, payout methods, and billing.
              </p>
            </Card>
          </ScrollAnimatedSection>
        </div>

        <ScrollAnimatedSection delay={400}>
          <div className="mt-12 space-y-6">
            <h2 className="text-2xl font-semibold">Popular Articles</h2>
            <ul className="space-y-4">
              {[
                "How to classify my waste correctly?",
                "What happens if my estimated weight is different?",
                "How do I add a bank account for payouts?",
                "Why was my pickup rejected?",
                "Is there a minimum weight for pickup?",
              ].map((article, i) => (
                <li key={i}>
                  <Link
                    href="#"
                    className="flex items-center justify-between p-4 rounded-lg border border-(--border) hover:bg-(--muted)/5 transition-colors group"
                  >
                    <span className="group-hover:text-(--brand) transition-colors">
                      {article}
                    </span>
                    <ArrowLeft className="w-4 h-4 rotate-180 text-(--muted) group-hover:text-(--brand) transition-colors" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </ScrollAnimatedSection>
      </div>
    </div>
  );
}
