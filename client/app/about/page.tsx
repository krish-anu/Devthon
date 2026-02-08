import { SectionHeading } from "@/components/shared/section-heading";
import { ScrollAnimatedSection } from "@/components/shared/scroll-animated-section";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function AboutPage() {
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
            eyebrow="Company"
            title="About Trash2Cash"
            description="Revolutionizing waste management in Sri Lanka through technology and community participation."
          />
        </ScrollAnimatedSection>

        <ScrollAnimatedSection delay={100}>
          <div className="prose dark:prose-invert max-w-none text-muted-foreground">
            <p className="text-lg leading-relaxed">
              Trash2Cash is Sri Lanka's leading digital waste aggregation
              marketplace, connecting households and businesses with verified
              recyclers. Our mission is to make recycling accessible,
              transparent, and rewarding for everyone.
            </p>
            <p className="mt-4">
              Founded in 2026, we recognized that the biggest barrier to
              effective recycling was the disconnect between waste generators
              and collectors. The informal sector was fragmented, pricing was
              opaque, and logistics were inefficient.
            </p>
            <p className="mt-4">
              We built a platform that solves these problems by:
            </p>
            <ul className="list-disc pl-6 mt-4 space-y-2">
              <li>Standardizing waste pricing based on market rates.</li>
              <li>Providing on-demand pickup scheduling.</li>
              <li>Ensuring responsible recycling through verified partners.</li>
              <li>Digitizing payments for instant, secure transactions.</li>
            </ul>
          </div>
        </ScrollAnimatedSection>

        <ScrollAnimatedSection delay={200}>
          <div className="bg-(--brand)/5 rounded-2xl p-8 mt-8 border border-(--brand)/10">
            <h3 className="text-xl font-semibold mb-4 text-foreground">
              Our Vision
            </h3>
            <p className="text-muted-foreground italic">
              "To create a zero-waste Sri Lanka where every piece of scrap is
              valued as a resource, fostering a circular economy that benefits
              both the people and the planet."
            </p>
          </div>
        </ScrollAnimatedSection>
      </div>
    </div>
  );
}
