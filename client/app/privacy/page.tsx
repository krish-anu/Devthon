import { SectionHeading } from "@/components/shared/section-heading";
import { ScrollAnimatedSection } from "@/components/shared/scroll-animated-section";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPage() {
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
            title="Privacy Policy"
            description="Last updated: January 16, 2026"
          />
        </ScrollAnimatedSection>

        <ScrollAnimatedSection delay={100}>
          <div className="prose dark:prose-invert max-w-none text-muted-foreground space-y-6">
            <section>
              <h3 className="text-xl font-semibold text-foreground mb-2">
                Introduction
              </h3>
              <p>
                At Trash2Treasure, we respect your privacy and are committed to
                protecting your personal data. This privacy policy will inform
                you as to how we look after your personal data when you visit
                our website and tell you about your privacy rights and how the
                law protects you.
              </p>
            </section>

            <section>
              <h3 className="text-xl font-semibold text-foreground mb-2">
                Data We Collect
              </h3>
              <p className="mb-4">
                We may collect, use, store and transfer different kinds of
                personal data about you which we have grouped together follows:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <strong>Identity Data</strong> includes first name, last name,
                  username or similar identifier, title, date of birth and
                  gender.
                </li>
                <li>
                  <strong>Contact Data</strong> includes billing address,
                  delivery address, email address and telephone numbers.
                </li>
                <li>
                  <strong>Financial Data</strong> includes payment card details
                  and bank account information.
                </li>
                <li>
                  <strong>Transaction Data</strong> includes details about
                  payments to you from us and other details of products and
                  services you have purchased from us.
                </li>
                <li>
                  <strong>Technical Data</strong> includes internet protocol
                  (IP) address, browser type and version, time zone setting and
                  location, browser plug-in types and versions, operating system
                  and platform, and other technology on the devices you use to
                  access this website.
                </li>
                <li>
                  <strong>Profile Data</strong> includes your username and
                  password, purchases or orders made by you, your interests,
                  preferences, feedback and survey responses.
                </li>
                <li>
                  <strong>Usage Data</strong> includes information about how you
                  use our website, products and services.
                </li>
                <li>
                  <strong>Marketing and Communications Data</strong> includes
                  your preferences in receiving marketing from us and our third
                  parties and your communication preferences.
                </li>
              </ul>
            </section>

            <section>
              <h3 className="text-xl font-semibold text-foreground mb-2">
                How We Use Your Data
              </h3>
              <p className="mb-4">
                We will only use your personal data when the law allows us to.
                Most commonly, we will use your personal data in the following
                circumstances:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  Where we need to perform the contract we are about to enter
                  into or have entered into with you.
                </li>
                <li>
                  Where it is necessary for our legitimate interests (or those
                  of a third party).
                </li>
                <li>Where we need to comply with a legal obligation.</li>
              </ul>
            </section>

            <section>
              <h3 className="text-xl font-semibold text-foreground mb-2">
                Data Security
              </h3>
              <p>
                We have put in place appropriate security measures to prevent
                your personal data from being accidentally lost, used or
                accessed in an unauthorized way, altered or disclosed. In
                addition, we limit access to your personal data to those
                employees, agents, contractors and other third parties who have
                a business need to know.
              </p>
            </section>

            <section>
              <h3 className="text-xl font-semibold text-foreground mb-2">
                Data Retention
              </h3>
              <p>
                We will only retain your personal data for as long as reasonably
                necessary to fulfill the purposes we collected it for, including
                for the purposes of satisfying any legal, regulatory, tax,
                accounting or reporting requirements.
              </p>
            </section>

            <section>
              <h3 className="text-xl font-semibold text-foreground mb-2">
                Your Legal Rights
              </h3>
              <p className="mb-4">
                Under certain circumstances, you have rights under data
                protection laws in relation to your personal data, including the
                right to:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Request access to your personal data.</li>
                <li>Request correction of your personal data.</li>
                <li>Request erasure of your personal data.</li>
                <li>Object to processing of your personal data.</li>
                <li>Request restriction of processing your personal data.</li>
                <li>Request transfer of your personal data.</li>
                <li>Withdraw consent.</li>
              </ul>
            </section>

            <section>
              <h3 className="text-xl font-semibold text-foreground mb-2">
                Contact Us
              </h3>
              <p>
                If you have any questions about this Privacy Policy or our
                privacy practices, please contact us:
              </p>
              <p className="mt-2">
                By phone:{" "}
                <a href="tel:0778972233" className="text-(--brand)">
                  077 897 2233
                </a>
              </p>
              <p className="mt-2">
                By email:{" "}
                <a
                  href="mailto:privacy@trash2cash.lk"
                  className="text-(--brand)"
                >
                  privacy@trash2cash.lk
                </a>
              </p>
            </section>
          </div>
        </ScrollAnimatedSection>
      </div>
    </div>
  );
}
