import { SectionHeading } from "@/components/shared/section-heading";
import { ScrollAnimatedSection } from "@/components/shared/scroll-animated-section";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Handshake, Building2, Factory } from "lucide-react";
import { Card } from "@/components/ui/card";

export default function PartnersPage() {
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
          <SectionHeading
            eyebrow="Partnerships"
            title="Partner with Trash2Treasure"
            description="Join our network of recyclers, businesses, and municipalities."
          />
        </ScrollAnimatedSection>

        <div className="grid gap-6 md:grid-cols-2 mt-8">
          <ScrollAnimatedSection delay={100}>
            <Card className="p-8 h-full flex flex-col items-center text-center space-y-4 hover:border-(--brand) transition-colors">
              <div className="h-16 w-16 rounded-full bg-(--brand)/10 flex items-center justify-center text-(--brand)">
                <Factory className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold">For Recyclers</h3>
              <p className="text-(--muted)">
                Secure a consistent supply of segregated, high-quality
                recyclable materials. We streamline logistics and provide
                digital payments.
              </p>
              <Button className="w-full mt-auto" asChild>
                <Link href="/partners/recyclers">
                  Become a Recycling Partner
                </Link>
              </Button>
            </Card>
          </ScrollAnimatedSection>

          <ScrollAnimatedSection delay={200}>
            <Card className="p-8 h-full flex flex-col items-center text-center space-y-4 hover:border-(--brand) transition-colors">
              <div className="h-16 w-16 rounded-full bg-(--brand)/10 flex items-center justify-center text-(--brand)">
                <Building2 className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold">For Corporate</h3>
              <p className="text-(--muted)">
                Achieve your sustainability goals with measurable impact
                reports. We handle corporate waste management and ERP/EPR
                compliance.
              </p>
              <Button className="w-full mt-auto" asChild>
                <Link href="/partners/corporate">Corporate Solutions</Link>
              </Button>
            </Card>
          </ScrollAnimatedSection>
        </div>

        <ScrollAnimatedSection delay={300}>
          <div className="bg-(--card) border border-(--border) rounded-xl p-8 mt-8 text-center">
            <h3 className="text-lg font-semibold mb-2">Already a partner?</h3>
            <p className="text-(--muted) mb-4">
              Log in to your dashboard to manage collections and payments.
            </p>
            <div className="flex justify-center gap-4">
              <Button variant="outline" asChild>
                <Link href="/login">Login to Dashboard</Link>
              </Button>
              <Button variant="ghost" asChild>
                <Link href="/contact">Contact Support</Link>
              </Button>
            </div>
          </div>
        </ScrollAnimatedSection>
      </div>
    </div>
  );
}
