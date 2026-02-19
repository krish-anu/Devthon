import { SectionHeading } from "@/components/shared/section-heading";
import { ScrollAnimatedSection } from "@/components/shared/scroll-animated-section";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Mail, Phone, MapPin, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function ContactPage() {
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

        <div className="grid md:grid-cols-2 gap-12">
          <div className="space-y-8">
            <ScrollAnimatedSection>
              <SectionHeading
                eyebrow="Contact Us"
                title="Get in touch"
                description="We'd love to hear from you. Fill out the form or reach out through our channels."
              />
            </ScrollAnimatedSection>

            <ScrollAnimatedSection delay={100}>
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <MapPin className="w-6 h-6 text-(--brand) mt-1" />
                  <div>
                    <h4 className="font-semibold">Head Office</h4>
                    <p className="text-(--muted)">
                      123, Galle Road, Colombo 03,
                      <br />
                      Sri Lanka
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <Mail className="w-6 h-6 text-(--brand) mt-1" />
                  <div>
                    <h4 className="font-semibold">Email</h4>
                    <p className="text-(--muted)">info@trash2treasure.lk</p>
                    <p className="text-(--muted)">support@trash2treasure.lk</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <Phone className="w-6 h-6 text-(--brand) mt-1" />
                  <div>
                    <h4 className="font-semibold">Phone</h4>
                    <p className="text-(--muted)">+94 11 234 5678</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <Clock className="w-6 h-6 text-(--brand) mt-1" />
                  <div>
                    <h4 className="font-semibold">Business Hours</h4>
                    <p className="text-(--muted)">
                      Mon - Fri: 9:00 AM - 5:00 PM
                    </p>
                  </div>
                </div>
              </div>
            </ScrollAnimatedSection>
          </div>

          <ScrollAnimatedSection delay={200}>
            <Card className="p-6">
              <form className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstname">First Name</Label>
                    <Input id="firstname" placeholder="John" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastname">Last Name</Label>
                    <Input id="lastname" placeholder="Doe" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="john@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Input id="subject" placeholder="Select a topic" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message">Message</Label>
                  <Textarea
                    id="message"
                    placeholder="How can we help you?"
                    className="min-h-[120px]"
                  />
                </div>
                <Button className="w-full">Send Message</Button>
              </form>
            </Card>
          </ScrollAnimatedSection>
        </div>
      </div>
    </div>
  );
}

