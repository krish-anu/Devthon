import { SectionHeading } from "@/components/shared/section-heading";
import { ScrollAnimatedSection } from "@/components/shared/scroll-animated-section";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar } from "lucide-react";
import { Card } from "@/components/ui/card";

export default function BlogPage() {
  return (
    <div className="min-h-screen bg-background section-grid p-6 md:p-12">
      <div className="max-w-5xl mx-auto space-y-10">
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
            eyebrow="Blog"
            title="Sustainability Stories"
            description="News, tips, and insights on waste management and circular economy."
          />
        </ScrollAnimatedSection>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mt-8">
          {[
            {
              title: "Everything You Need to Know About E-Waste Recycling",
              date: "Feb 05, 2026",
              category: "Guides",
            },
            {
              title: "Trash2Cash hits 500 Tonnes Collected Milestone",
              date: "Jan 28, 2026",
              category: "Company News",
            },
            {
              title: "How to Segregate Household Waste Effectively",
              date: "Jan 15, 2026",
              category: "Tips",
            },
            {
              title: "The Future of Plastic Recycling in Sri Lanka",
              date: "Jan 10, 2026",
              category: "Industry",
            },
            {
              title: "Composting 101: A Beginner's Guide",
              date: "Dec 05, 2025",
              category: "Guides",
            },
            {
              title: "Interview with our Top Recycling Partner",
              date: "Nov 22, 2025",
              category: "Community",
            },
          ].map((post, i) => (
            <ScrollAnimatedSection key={i} delay={100 + i * 50}>
              <Card className="overflow-hidden hover:shadow-lg transition-shadow h-full flex flex-col">
                <div className="h-48 bg-(--muted)/20 w-full animate-pulse"></div>
                <div className="p-6 flex flex-col flex-1">
                  <span className="text-xs font-semibold text-(--brand) uppercase tracking-wider mb-2">
                    {post.category}
                  </span>
                  <h3 className="text-lg font-bold mb-2 leading-tight hover:text-(--brand) cursor-pointer">
                    {post.title}
                  </h3>
                  <div className="mt-auto pt-4 flex items-center text-xs text-(--muted)">
                    <Calendar className="w-3 h-3 mr-1" />
                    {post.date}
                  </div>
                </div>
              </Card>
            </ScrollAnimatedSection>
          ))}
        </div>
      </div>
    </div>
  );
}
