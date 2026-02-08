import { SectionHeading } from "@/components/shared/section-heading";
import { ScrollAnimatedSection } from "@/components/shared/scroll-animated-section";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function TermsPage() {
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
            eyebrow="Legal"
            title="Terms of Service"
            description="Last Updated: February 2026"
          />
        </ScrollAnimatedSection>

        <ScrollAnimatedSection delay={100}>
          <div className="prose dark:prose-invert max-w-none text-muted-foreground space-y-6">
            <section>
              <h3 className="text-xl font-semibold text-foreground mb-2">
                1. Introduction
              </h3>
              <p>
                Welcome to Trash2Cash. By accessing or using our website and
                services, you agree to be bound by these Terms of Service.
              </p>
            </section>

            <section>
              <h3 className="text-xl font-semibold text-foreground mb-2">
                2. Services
              </h3>
              <p>
                Trash2Cash facilitates the collection and sale of recyclable
                waste. We connect users with independent recycling partners.
              </p>
            </section>

            <section>
              <h3 className="text-xl font-semibold text-foreground mb-2">
                3. User Responsibilities
              </h3>
              <ul className="list-disc pl-6 space-y-1">
                <li>
                  You must provide accurate information about the waste items.
                </li>
                <li>
                  You agree to segregate waste according to our guidelines.
                </li>
                <li>
                  You must ensure the waste is free from hazardous materials.
                </li>
              </ul>
            </section>

            <section>
              <h3 className="text-xl font-semibold text-foreground mb-2">
                4. Pricing and Payments
              </h3>
              <p>
                Prices displayed are estimates. Final value is determined upon
                inspection. Payments are processed through third-party providers
                and subject to their terms.
              </p>
            </section>

            <section>
              <h3 className="text-xl font-semibold text-foreground mb-2">
                5. Limitation of Liability
              </h3>
              <p>
                Trash2Cash is not liable for any direct, indirect, incidental,
                or consequential damages resulting from the use of our services.
              </p>
            </section>

            <section>
              <h3 className="text-xl font-semibold text-foreground mb-2">
                6. Contact
              </h3>
              <p>
                For any questions regarding these terms, please contact us at
                legal@trash2cash.lk.
              </p>
            </section>
          </div>
        </ScrollAnimatedSection>
      </div>
    </div>
  );
}
