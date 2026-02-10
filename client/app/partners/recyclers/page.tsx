"use client";

import { SectionHeading } from "@/components/shared/section-heading";
import { ScrollAnimatedSection } from "@/components/shared/scroll-animated-section";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  CheckCircle2,
  Truck,
  BarChart3,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import PhoneInput from "@/components/ui/phone-input";
import { Label } from "@/components/ui/label";
import { isValidSriLankaPhone, normalizeSriLankaPhone } from "@/lib/phone";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { useState } from "react";

const recyclerSchema = z.object({
  companyName: z.string().min(2, "Company name is required"),
  contactPerson: z.string().min(2, "Contact person is required"),
  phone: z.string().refine((v) => isValidSriLankaPhone(v), { message: "Enter a valid Sri Lanka phone number" }),
  email: z.string().email("Invalid email address"),
  materialTypes: z.string().min(3, "Please specify material types"),
});

type RecyclerFormValues = z.infer<typeof recyclerSchema>;

export default function RecyclersPage() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<RecyclerFormValues>({
    resolver: zodResolver(recyclerSchema),
  });

  const onSubmit = async (data: RecyclerFormValues) => {
    setIsSubmitting(true);
    try {
      const payload = { ...data, phone: normalizeSriLankaPhone(data.phone) ?? data.phone };
      await apiFetch(
        "/partners/recycler",
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
        false,
      ); // Public-auth false

      toast({
        title: "Application Submitted",
        description:
          "We have received your application. Our team will contact you shortly.",
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
              For Recycling Facilities
            </div>
            <h1 className="text-4xl md:text-5xl font-bold">
              Source High-Quality Materials
            </h1>
            <p className="text-lg text-(--muted)">
              Connect with thousands of households and businesses to get a
              steady stream of segregated recyclables.
            </p>
          </div>
        </ScrollAnimatedSection>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              title: "Quality Assurance",
              desc: "Pre-screened and segregated waste to ensure high recovery rates.",
              icon: <ShieldCheck className="w-6 h-6" />,
            },
            {
              title: "Optimized Logistics",
              desc: "Smart routing and scheduled large-volume pickups.",
              icon: <Truck className="w-6 h-6" />,
            },
            {
              title: "Digital Tracking",
              desc: "Real-time data on collection volumes and material types.",
              icon: <BarChart3 className="w-6 h-6" />,
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

        <ScrollAnimatedSection delay={400}>
          <div className="grid md:grid-cols-2 gap-12 items-center bg-(--card) border border-(--border) rounded-3xl p-8 md:p-12">
            <div className="space-y-6">
              <h2 className="text-3xl font-bold">Partner Application</h2>
              <p className="text-(--muted)">
                Join our network of verified recycling partners. Fill out the
                form below and our team will get back to you within 2 business
                days.
              </p>
              <ul className="space-y-3">
                {[
                  "Valid Business Registration",
                  "Environmental Protection License (EPL)",
                  "Facility Inspection Required",
                ].map((req, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-2 text-sm text-(--foreground)"
                  >
                    <CheckCircle2 className="w-4 h-4 text-(--brand)" />
                    {req}
                  </li>
                ))}
              </ul>
            </div>

            <Card className="p-6">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Company Name</Label>
                  <Input
                    id="companyName"
                    {...register("companyName")}
                    placeholder="Green Recycling Pvt Ltd"
                  />
                  {errors.companyName && (
                    <p className="text-xs text-red-500">
                      {errors.companyName.message}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="contactPerson">Contact Person</Label>
                    <Input
                      id="contactPerson"
                      {...register("contactPerson")}
                      placeholder="John Doe"
                    />
                    {errors.contactPerson && (
                      <p className="text-xs text-red-500">
                        {errors.contactPerson.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <PhoneInput
                      id="phone"
                      {...register("phone")}
                      placeholder="+94 77 123 4567"
                    />
                    {errors.phone && (
                      <p className="text-xs text-red-500">
                        {errors.phone.message}
                      </p>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    {...register("email")}
                    placeholder="john@example.com"
                  />
                  {errors.email && (
                    <p className="text-xs text-red-500">
                      {errors.email.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="materialTypes">
                    Material Types Interested In
                  </Label>
                  <Input
                    id="materialTypes"
                    {...register("materialTypes")}
                    placeholder="e.g. PET, Aluminum, E-Waste"
                  />
                  {errors.materialTypes && (
                    <p className="text-xs text-red-500">
                      {errors.materialTypes.message}
                    </p>
                  )}
                </div>
                <Button className="w-full" size="lg" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />{" "}
                      Submitting...
                    </>
                  ) : (
                    "Submit Application"
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
