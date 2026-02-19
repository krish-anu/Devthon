"use client";

import { SectionHeading } from "@/components/shared/section-heading";
import { ScrollAnimatedSection } from "@/components/shared/scroll-animated-section";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Building,
  FileSpreadsheet,
  Globe2,
  Quote,
  Loader2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import PhoneInput from "@/components/ui/phone-input";
import { isValidSriLankaPhone } from "@/lib/phone";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { useState } from "react";

const corporateSchema = z.object({
  organizationName: z.string().min(2, "Organization name is required"),
  contactName: z.string().min(2, "Contact name is required"),
  phone: z
    .string()
    .refine((v) => isValidSriLankaPhone(v), {
      message: "Enter a valid Sri Lanka phone number",
    }),
  email: z.string().email("Invalid email address"),
  requirements: z.string().optional(),
});

type CorporateFormValues = z.infer<typeof corporateSchema>;

export default function CorporatePage() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<CorporateFormValues>({
    resolver: zodResolver(corporateSchema),
  });

  const onSubmit = async (data: CorporateFormValues) => {
    setIsSubmitting(true);
    try {
      await apiFetch(
        "/partners/corporate",
        {
          method: "POST",
          body: JSON.stringify(data),
        },
        false,
      );

      toast({
        title: "Request Submitted",
        description:
          "We have received your request. Our team will contact you shortly.",
        variant: "default",
      });
      reset();
    } catch (error: any) {
      toast({
        title: "Submission Failed",
        description: error.message || "Something went wrong. Please try again.",
        variant: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background section-grid p-6 md:p-12">
      <div className="max-w-5xl mx-auto space-y-12">
        <div className="mb-4">
          <Button
            variant="ghost"
            asChild
            className="pl-0 hover:pl-2 transition-all"
          >
            <Link href="/partners" className="flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Partners
            </Link>
          </Button>
        </div>

        <ScrollAnimatedSection>
          <div className="text-center max-w-2xl mx-auto space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-(--brand)/10 text-(--brand) text-sm font-medium">
              For Businesses & Organizations
            </div>
            <h1 className="text-4xl md:text-5xl font-bold">
              Achieve Your Sustainability Goals
            </h1>
            <p className="text-lg text-(--muted)">
              Comprehensive waste management solutions for offices, factories,
              and events with certified impact reporting.
            </p>
          </div>
        </ScrollAnimatedSection>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              title: "Audit & Compliance",
              desc: "Full waste audit and EPR compliance documentation.",
              icon: <FileSpreadsheet className="w-6 h-6" />,
            },
            {
              title: "Corporate pickup",
              desc: "Scheduled collection for office and industrial waste.",
              icon: <Building className="w-6 h-6" />,
            },
            {
              title: "Impact Dashboard",
              desc: "Track CO2off set and diverted waste metrics.",
              icon: <Globe2 className="w-6 h-6" />,
            },
          ].map((feature, i) => (
            <ScrollAnimatedSection key={i} delay={100 + i * 100}>
              <Card className="p-6 h-full bg-(--muted)/5 border-none shadow-none">
                <div className="w-12 h-12 rounded-lg bg-(--brand)/10 text-(--brand) flex items-center justify-center mb-4">
                  {feature.icon}
                </div>
                <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                <p className="text-sm text-(--muted)">{feature.desc}</p>
              </Card>
            </ScrollAnimatedSection>
          ))}
        </div>

        <ScrollAnimatedSection delay={300}>
          <Card className="bg-(--brand)/5 border-none p-8 flex flex-col md:flex-row gap-6 items-center">
            <div className="md:w-1/3 flex justify-center">
              <div className="bg-(--background) p-4 rounded-full shadow-sm">
                <Quote className="w-8 h-8 text-(--brand)" />
              </div>
            </div>
            <div className="md:w-2/3 space-y-4">
              <p className="text-lg italic font-medium">
                "Partnering with Trash2Treasure helped us divert 80% of our
                office waste from landfills and engaged our employees in
                meaningful sustainability action."
              </p>
              <div>
                <div className="font-bold">Sarah Dias</div>
                <div className="text-sm text-(--muted)">
                  Operations Director, TechCorp Sri Lanka
                </div>
              </div>
            </div>
          </Card>
        </ScrollAnimatedSection>

        <ScrollAnimatedSection delay={400}>
          <div className="grid md:grid-cols-2 gap-12 items-center bg-(--card) border border-(--border) rounded-3xl p-8 md:p-12 mt-8">
            <div className="space-y-6">
              <h2 className="text-3xl font-bold">Get a Custom Proposal</h2>
              <p className="text-(--muted)">
                Ready to transform your waste management strategy? Let's discuss
                your specific needs.
              </p>
              <div className="space-y-4 text-sm">
                <p>
                  <strong>Ideal for:</strong>
                </p>
                <ul className="list-disc pl-5 space-y-1 text-(--muted)">
                  <li>Hotels & Restaurants</li>
                  <li>Corporate Offices</li>
                  <li>Manufacturing Plants</li>
                  <li>Educational Institutions</li>
                </ul>
              </div>
            </div>

            <Card className="p-6">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="organizationName">Organization Name</Label>
                  <Input
                    id="organizationName"
                    placeholder="Organization Name"
                    {...register("organizationName")}
                  />
                  {errors.organizationName && (
                    <p className="text-red-500 text-xs">
                      {errors.organizationName.message}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="contactName">Contact Name</Label>
                    <Input
                      id="contactName"
                      placeholder="Name"
                      {...register("contactName")}
                    />
                    {errors.contactName && (
                      <p className="text-red-500 text-xs">
                        {errors.contactName.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <PhoneInput
                      id="phone"
                      placeholder="+94 77 123 4567"
                      {...register("phone")}
                    />
                    {errors.phone && (
                      <p className="text-red-500 text-xs">
                        {errors.phone.message}
                      </p>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Work Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="email@company.com"
                    {...register("email")}
                  />
                  {errors.email && (
                    <p className="text-red-500 text-xs">
                      {errors.email.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="requirements">Requirements</Label>
                  <Textarea
                    id="requirements"
                    placeholder="Tell us about your waste volume and types..."
                    {...register("requirements")}
                  />
                  {errors.requirements && (
                    <p className="text-red-500 text-xs">
                      {errors.requirements.message}
                    </p>
                  )}
                </div>
                <Button className="w-full" size="lg" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Request Consultation"
                  )}
                </Button>
              </form>
            </Card>
          </div>
        </ScrollAnimatedSection>
      </div>
    </div>
  );
}
