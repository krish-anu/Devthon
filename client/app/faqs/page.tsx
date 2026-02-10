import { SectionHeading } from "@/components/shared/section-heading";
import { ScrollAnimatedSection } from "@/components/shared/scroll-animated-section";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ChevronDown } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export default function FAQPage() {
  return (
    <div className="min-h-screen bg-background section-grid p-6 md:p-12">
      <div className="max-w-3xl mx-auto space-y-10">
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
            eyebrow="FAQs"
            title="Frequently Asked Questions"
            description="Find answers to common questions about Trash2Treasure."
          />
        </ScrollAnimatedSection>

        <ScrollAnimatedSection delay={100}>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger>
                What types of waste do you collect?
              </AccordionTrigger>
              <AccordionContent>
                We collect a wide range of recyclables including plastics (PET,
                HDPE), metals (aluminum, iron), paper/cardboard, and e-waste.
                Please check our pricing page for a detailed list.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2">
              <AccordionTrigger>How does the pricing work?</AccordionTrigger>
              <AccordionContent>
                Our prices are based on current market rates. You'll see an
                estimated price range when booking. The final amount is
                determined after our collection partner weighs and inspects the
                items.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-3">
              <AccordionTrigger>How do I get paid?</AccordionTrigger>
              <AccordionContent>
                Payments are transferred directly to your registered bank
                account or mobile wallet immediately after the pickup is
                confirmed and processed.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-4">
              <AccordionTrigger>
                Is there a minimum pickup weight?
              </AccordionTrigger>
              <AccordionContent>
                Yes, typically we require a minimum of 5kg total recyclable
                waste to schedule a pickup, but this may vary by location.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-5">
              <AccordionTrigger>Do I need to sort my waste?</AccordionTrigger>
              <AccordionContent>
                Yes, please segregate your waste into different categories
                (plastic, paper, metal, etc.) before the pickup team arrives.
                This ensures faster processing and better pricing.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </ScrollAnimatedSection>
      </div>
    </div>
  );
}
