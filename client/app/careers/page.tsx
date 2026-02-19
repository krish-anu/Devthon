import { SectionHeading } from "@/components/shared/section-heading";
import { ScrollAnimatedSection } from "@/components/shared/scroll-animated-section";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Briefcase } from "lucide-react";
import { Card } from "@/components/ui/card";

export default function CareersPage() {
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
            eyebrow="Join Us"
            title="Careers at Trash2Treasure"
            description="Help us build a cleaner, greener future for Sri Lanka."
          />
        </ScrollAnimatedSection>

        <ScrollAnimatedSection delay={100}>
          <div className="text-muted-foreground mb-8">
            <p className="text-lg">
              We are always looking for passionate individuals who care about
              the environment and technology. If you want to make a tangible
              impact, explore our open positions below.
            </p>
          </div>
        </ScrollAnimatedSection>

        <div className="space-y-4">
          {[
            {
              title: "Senior Full Stack Engineer",
              dept: "Engineering",
              type: "Full-time",
              loc: "Remote / Colombo",
            },
            {
              title: "Operations Manager",
              dept: "Operations",
              type: "Full-time",
              loc: "Colombo",
            },
            {
              title: "Growth Marketing Specialist",
              dept: "Marketing",
              type: "Full-time",
              loc: "Remote",
            },
            {
              title: "Sustainability Consultant",
              dept: "Impact",
              type: "Part-time",
              loc: "Hybrid",
            },
          ].map((job, i) => (
            <ScrollAnimatedSection key={i} delay={150 + i * 50}>
              <Card className="p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:shadow-md transition-shadow">
                <div>
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    {job.title}
                  </h3>
                  <div className="flex gap-3 text-sm text-(--muted) mt-1">
                    <span>{job.dept}</span>
                    <span>•</span>
                    <span>{job.type}</span>
                    <span>•</span>
                    <span>{job.loc}</span>
                  </div>
                </div>
                <Button variant="outline">Apply Now</Button>
              </Card>
            </ScrollAnimatedSection>
          ))}
        </div>

        <ScrollAnimatedSection delay={400}>
          <div className="text-center mt-8 text-(--muted)">
            <p>
              Don't see a role that fits? Send your CV to{" "}
              <a
                href="mailto:careers@trash2treasure.lk"
                className="text-brand hover:underline"
              >
                careers@trash2treasure.lk
              </a>
            </p>
          </div>
        </ScrollAnimatedSection>
      </div>
    </div>
  );
}

