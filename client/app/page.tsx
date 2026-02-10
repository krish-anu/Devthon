"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SectionHeading } from "@/components/shared/section-heading";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { PricingItem } from "@/lib/types";
import Loading from "@/components/shared/Loading";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useAuth } from "@/components/auth/auth-provider";
import {
  Leaf,
  MapPin,
  Recycle,
  Users,
  CheckCircle,
  Calendar,
  Truck,
  Wallet,
  Mail,
  Phone,
  MessageCircle,
} from "lucide-react";
import { ScrollAnimatedSection } from "@/components/shared/scroll-animated-section";

const fallbackPricing = [
  { name: "Plastic (PET)", min: 45, max: 70 },
  { name: "Metal (Aluminum)", min: 160, max: 240 },
  { name: "Cardboard", min: 30, max: 55 },
  { name: "E-Waste", min: 220, max: 450 },
];

export default function HomePage() {
  const { data, isLoading: pricingLoading } = useQuery({
    queryKey: ["public-pricing"],
    queryFn: () => apiFetch<PricingItem[]>("/public/pricing", {}, false),
  });

  const pricingCards = data?.length
    ? data.map((item) => ({
        name: item.wasteCategory.name,
        min: item.minPriceLkrPerKg,
        max: item.maxPriceLkrPerKg,
      }))
    : fallbackPricing;

  // Redirect booking link depending on authentication state
  const { user } = useAuth();
  const bookingHref = user ? "/users/bookings/new" : "/login?redirect=/users/bookings/new";

  return (
    <div className="min-h-screen bg-background text-foreground section-grid">
      <header className="w-full bg-(--card)">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
          <div className="flex items-center gap-3 text-lg font-semibold">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl bg-(--brand)/20">
              <img
                src="/recycle%20logo.png"
                alt="Trash2Cash logo"
                className="h-8 w-8 object-contain"
              />
            </div>
            Trash2Cash
          </div>
          <nav className="hidden items-center gap-6 text-sm text-(--muted) md:flex">
            <a href="#how" className="hover:text-foreground">
              How it works
            </a>
            <a href="#impact" className="hover:text-foreground">
              Impact
            </a>
            <a href="#pricing" className="hover:text-foreground">
              Pricing
            </a>
            <a href="#contact" className="hover:text-foreground">
              Contact
            </a>
          </nav>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Button variant="ghost" asChild>
              <Link href="/login">Login</Link>
            </Button>
            <Button asChild>
              <Link href="/signup">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="">
        <section className="mx-auto flex w-full max-w-6xl flex-col items-start gap-10 px-6 pb-20 pt-10 md:flex-row md:items-center">
          <div className="flex-1 space-y-6">
            <ScrollAnimatedSection>
              <div className="inline-flex items-center gap-2 rounded-full border border-(--brand)/30 bg-(--brand)/10 px-4 py-2 text-xs uppercase tracking-[0.3em] text-brand">
                Sri Lanka&apos;s #1 Waste Marketplace
              </div>
            </ScrollAnimatedSection>
            <ScrollAnimatedSection delay={100}>
              <h1 className="text-4xl font-semibold leading-tight md:text-6xl">
                Turn Your Waste into Cash
              </h1>
            </ScrollAnimatedSection>
            {/* Built for households */}
            <ScrollAnimatedSection delay={200}>
              <p className="text-base text-muted md:text-lg">
                and businesses across Sri Lanka. Schedule pickups, track impact,
                and get paid instantly through mobile wallets or bank transfers.
              </p>
            </ScrollAnimatedSection>
            <ScrollAnimatedSection delay={300}>
              <div className="flex flex-wrap gap-4">
                <Button size="lg" asChild>
                  <Link href={bookingHref}>Book a Pickup</Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <a href="#pricing">Check Prices</a>
                </Button>
              </div>
            </ScrollAnimatedSection>
          </div>
          <div className="flex-1">
            <ScrollAnimatedSection delay={400}>
              <div className="overflow-hidden rounded-2xl border border-(--brand) shadow-lg aspect-[16/9]">
                <img
                  src="/recycling-bins.png"
                  alt="Colorful recycling bins for waste segregation"
                  className="h-full w-full object-cover"
                />
              </div>
            </ScrollAnimatedSection>
          </div>
        </section>
      </div>

      <section
        id="impact"
        className="mx-auto w-full max-w-6xl space-y-10 px-6 py-16"
      >
        <ScrollAnimatedSection>
          <SectionHeading
            eyebrow="Our Impact"
            title="Making a Real Difference"
            description="Together with our community, we are transforming waste management in Sri Lanka."
          />
        </ScrollAnimatedSection>
        <div className="mx-auto rounded-2xl border border-(--brand)/20 bg-transparent p-4">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[
              {
                icon: <Recycle className="h-5 w-5" />,
                value: "500+",
                label: "Tonnes Collected",
              },
              {
                icon: <Users className="h-5 w-5" />,
                value: "12,000+",
                label: "Active Users",
              },
              {
                icon: <Leaf className="h-5 w-5" />,
                value: "850",
                label: "Tonnes CO₂ Saved",
              },
              {
                icon: <MapPin className="h-5 w-5" />,
                value: "25",
                label: "Districts Served",
              },
            ].map((stat, index) => (
              <ScrollAnimatedSection key={stat.label} delay={index * 100}>
                <Card className="bg-(--brand)/10 text-center shadow-md">
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-(--brand)/20 text-(--brand)">
                      {stat.icon}
                    </div>
                    <div className="text-lg font-bold text-(--brand)">
                      {stat.value}
                    </div>
                    <div className="text-xs text-(--muted)">{stat.label}</div>
                  </div>
                </Card>
              </ScrollAnimatedSection>
            ))}
          </div>
        </div>
      </section>

      <section
        id="how"
        className="mx-auto w-full max-w-6xl space-y-10 px-6 py-16"
      >
        <ScrollAnimatedSection>
          <SectionHeading
            eyebrow="How it works"
            title="Pickups in 3 simple steps"
            description="Book once, relax, and earn. We handle the pickup, sorting, and instant payout."
          />
        </ScrollAnimatedSection>
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              step: "1",
              title: "Book a Pickup",
              desc: "Select waste type, estimate weight, and schedule your pickup window.",
              icon: <Calendar className="h-6 w-6" />,
            },
            {
              step: "2",
              title: "We Collect & Sort",
              desc: "Our verified recyclers collect, weigh, and sort responsibly.",
              icon: <Truck className="h-6 w-6" />,
            },
            {
              step: "3",
              title: "Get Paid Instantly",
              desc: "Receive money instantly to your mobile wallet or bank account.",
              icon: <Wallet className="h-6 w-6" />,
            },
          ].map((item, index) => (
            <ScrollAnimatedSection key={item.step} delay={index * 150}>
              <Card className="bg-(--brand)/10 shadow-md">
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-(--brand)/20 text-(--brand)">
                    {item.icon}
                  </div>
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-(--brand)">
                    Step {item.step}
                  </div>
                  <h3 className="text-xl font-semibold text-foreground">
                    {item.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-(--muted)">
                    {item.desc}
                  </p>
                </div>
              </Card>
            </ScrollAnimatedSection>
          ))}
        </div>
      </section>

      <section className="w-full bg-transparent py-16">
        <div className="mx-auto w-full max-w-6xl space-y-8 px-6">
          <ScrollAnimatedSection>
            <div className="space-y-4">
              <span className="text-xs font-semibold uppercase tracking-[0.35em] text-(--brand)">
                Features
              </span>
              <h2 className="text-4xl font-bold text-foreground md:text-5xl">
                A marketplace built for every
                <br />
                Sri Lankan household
              </h2>
              <p className="text-lg text-(--muted)">
                From transparent pricing to carbon tracking, Trash2Cash keeps
                the cycle circular.
              </p>
            </div>
          </ScrollAnimatedSection>

          <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                title: "Verified Recyclers",
                desc: "We partner only with certified recycling facilities that meet environmental standards.",
              },
              {
                title: "Transparent Pricing",
                desc: "Real-time pricing updates based on market rates. Final price confirmed after inspection.",
              },
              {
                title: "Carbon Tracking",
                desc: "Track your personal contribution to reducing CO₂ emissions with every collection.",
              },
              {
                title: "Community Driven",
                desc: "Building a sustainable future together with local communities across Sri Lanka.",
              },
            ].map((item, index) => (
              <ScrollAnimatedSection key={item.title} delay={index * 100}>
                <Card className="bg-(--brand)/10 text-center shadow-md">
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-(--brand)/20 text-(--brand)">
                      <CheckCircle className="h-5 w-5" />
                    </div>
                    <h4 className="text-base font-semibold text-(--brand)">
                      {item.title}
                    </h4>
                    <p className="text-xs text-(--muted)">{item.desc}</p>
                  </div>
                </Card>
              </ScrollAnimatedSection>
            ))}
          </div>
        </div>
      </section>

      <section
        id="pricing"
        className="mx-auto w-full max-w-6xl space-y-10 px-6 py-16"
      >
        <ScrollAnimatedSection>
          <SectionHeading
            eyebrow="Current Waste Prices"
            title="Transparent pricing for every category"
            description="Final prices determined after quality inspection."
          />
        </ScrollAnimatedSection>
        {pricingLoading ? (
          <div className="grid gap-6 md:grid-cols-4">
            <Card className="bg-(--brand)/10 text-center shadow-md p-6">
              <Loading message="Loading prices..." />
            </Card>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-4">
            {pricingCards.map((item, index) => (
              <ScrollAnimatedSection key={item.name} delay={index * 100}>
                <Card className="bg-(--brand)/10 text-center shadow-md">
                  <div className="flex flex-col items-center gap-2">
                    <h4 className="text-base font-semibold text-(--brand)">
                      {item.name}
                    </h4>
                    <div className="text-sm text-(--muted)">
                      Min: LKR {item.min} / kg
                    </div>
                    <div className="text-sm text-(--muted)">
                      Max: LKR {item.max} / kg
                    </div>
                    <p className="text-xs text-(--muted)">
                      Final prices determined after quality inspection.
                    </p>
                  </div>
                </Card>
              </ScrollAnimatedSection>
            ))}
          </div>
        )}
      </section>

      <section
        id="contact"
        className="mx-auto w-full max-w-6xl space-y-10 px-6 py-16"
      >
        <ScrollAnimatedSection>
          <SectionHeading
            eyebrow="Contact Us"
            title="Get in touch"
            description="Have questions? We're here to help you get started with sustainable waste management."
          />
        </ScrollAnimatedSection>
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              title: "General Inquiries",
              desc: "info@trash2cash.lk",
              icon: <Mail className="h-6 w-6" />,
              action: "Email Us",
            },
            {
              title: "Support",
              desc: "+94 11 234 5678",
              icon: <Phone className="h-6 w-6" />,
              action: "Call Now",
            },
            {
              title: "Live Chat",
              desc: "Available 9am - 5pm",
              icon: <MessageCircle className="h-6 w-6" />,
              action: "Start Chat",
            },
          ].map((item, index) => (
            <ScrollAnimatedSection key={item.title} delay={index * 100}>
              <Card className="bg-(--brand)/10 shadow-md">
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-(--brand)/20 text-(--brand)">
                    {item.icon}
                  </div>
                  <h3 className="text-xl font-semibold text-foreground">
                    {item.title}
                  </h3>
                  <p className="text-sm text-(--muted)">{item.desc}</p>
                  <Button variant="outline" size="sm" className="mt-2">
                    {item.action}
                  </Button>
                </div>
              </Card>
            </ScrollAnimatedSection>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 py-16">
        <ScrollAnimatedSection>
          <Card className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <div>
              <h3 className="text-2xl font-semibold">
                Ready to Start Earning from Your Waste?
              </h3>
              <p className="text-sm text-(--muted)">
                Create a free account and schedule your first pickup today.
              </p>
            </div>
            <Button size="lg" asChild>
              <Link href="/signup">Create Free Account</Link>
            </Button>
          </Card>
        </ScrollAnimatedSection>
      </section>

      <footer className="bg-(--card) text-foreground border-t border-(--border)">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-6 py-12 md:grid-cols-4">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl bg-(--brand)/20">
                <img
                  src="/recycle%20logo.png"
                  alt="Trash2Cash logo"
                  className="h-8 w-8 object-contain"
                />
              </div>
              <h4 className="text-xl font-bold text-foreground">Trash2Cash</h4>
            </div>
            <p className="text-sm leading-relaxed text-(--muted)">
              Sri Lanka&apos;s leading digital waste aggregation and recycling
              marketplace.
            </p>
          </div>

          <div className="text-sm">
            <p className="mb-3 font-semibold text-foreground">Company</p>
            <ul className="space-y-2 text-(--muted)">
              <li>
                <Link
                  href="/about"
                  className="hover:text-foreground transition-colors"
                >
                  About Us
                </Link>
              </li>
              <li>
                <Link
                  href="/careers"
                  className="hover:text-foreground transition-colors"
                >
                  Careers
                </Link>
              </li>
              <li>
                <Link
                  href="/partners"
                  className="hover:text-foreground transition-colors"
                >
                  Partners
                </Link>
              </li>
              <li>
                <Link
                  href="/blog"
                  className="hover:text-foreground transition-colors"
                >
                  Blog
                </Link>
              </li>
            </ul>
          </div>

          <div className="text-sm">
            <p className="mb-3 font-semibold text-foreground">Support</p>
            <ul className="space-y-2 text-(--muted)">
              <li>
                <Link
                  href="/help-center"
                  className="hover:text-foreground transition-colors"
                >
                  Help Center
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="hover:text-foreground transition-colors"
                >
                  Contact Us
                </Link>
              </li>
              <li>
                <Link
                  href="/faqs"
                  className="hover:text-foreground transition-colors"
                >
                  FAQs
                </Link>
              </li>
              <li>
                <Link
                  href="/terms"
                  className="hover:text-foreground transition-colors"
                >
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>

          <div className="text-sm">
            <p className="mb-3 font-semibold text-foreground">Connect</p>
            <ul className="space-y-2 text-(--muted)">
              <li>
                <a
                  href="https://facebook.com/trash2cash"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground transition-colors"
                >
                  Facebook
                </a>
              </li>
              <li>
                <a
                  href="https://twitter.com/trash2cash"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground transition-colors"
                >
                  Twitter
                </a>
              </li>
              <li>
                <a
                  href="https://instagram.com/trash2cash"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground transition-colors"
                >
                  Instagram
                </a>
              </li>
              <li>
                <a
                  href="https://linkedin.com/company/trash2cash"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground transition-colors"
                >
                  LinkedIn
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-(--border) py-6 text-center text-sm text-(--muted)">
          © 2026 Trash2Cash. All rights reserved. Making Sri Lanka greener, one
          pickup at a time.
        </div>
      </footer>
    </div>
  );
}
