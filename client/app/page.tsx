"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SectionHeading } from "@/components/shared/section-heading";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { PricingItem, WasteCategory } from "@/lib/types";
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

export default function HomePage() {
  const { data: pricingData, isLoading: pricingLoading } = useQuery({
    queryKey: ["public-pricing"],
    queryFn: () => apiFetch<PricingItem[]>("/public/pricing", {}, false),
    staleTime: 5 * 60 * 1000,
  });

  const { data: categoriesData, isLoading: categoriesLoading } = useQuery({
    queryKey: ["public-waste-categories"],
    queryFn: () =>
      apiFetch<WasteCategory[]>("/public/waste-categories", {}, false),
    staleTime: 5 * 60 * 1000,
  });

  const pricingCards = useMemo(() => {
    const pricing = pricingData ?? [];
    const categories = categoriesData ?? [];

    if (categories.length === 0) {
      return pricing.map((item) => ({
        id: item.wasteCategory.id,
        name: item.wasteCategory.name,
        min: item.minPriceLkrPerKg,
        max: item.maxPriceLkrPerKg,
        hasPricing: true,
      }));
    }

    const pricingByCategory = new Map(
      pricing.map((item) => [item.wasteCategory.id, item]),
    );

    return categories.map((category) => {
      const matchedPrice = pricingByCategory.get(category.id);
      return {
        id: category.id,
        name: category.name,
        min: matchedPrice?.minPriceLkrPerKg ?? 0,
        max: matchedPrice?.maxPriceLkrPerKg ?? 0,
        hasPricing: Boolean(matchedPrice),
      };
    });
  }, [pricingData, categoriesData]);

  const isPricingLoading = pricingLoading || categoriesLoading;

  const stats = [
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
  ];

  // Redirect booking link depending on authentication state
  const { user } = useAuth();
  const bookingHref = user
    ? "/users/bookings/new"
    : "/login?redirect=/users/bookings/new";

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground section-grid">
      <header className="w-full bg-(--card) sticky top-0 z-50 border-b border-(--border)">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex items-center gap-2 sm:gap-3 text-base sm:text-lg font-semibold">
            <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center overflow-hidden rounded-2xl bg-(--brand)/20">
              <img
                src="/recycle%20logo.png"
                alt="Trash2Treasure logo"
                className="h-6 w-6 sm:h-8 sm:w-8 object-contain"
              />
            </div>
            <span className="hidden sm:inline">Trash2Treasure</span>
          </div>
          <nav className="hidden lg:flex items-center gap-6 text-sm text-(--muted)">
            <a href="#how" className="hover:text-foreground transition-colors">
              How it works
            </a>
            <a
              href="#impact"
              className="hover:text-foreground transition-colors"
            >
              Impact
            </a>
            <a
              href="#pricing"
              className="hover:text-foreground transition-colors"
            >
              Pricing
            </a>
            <a
              href="#contact"
              className="hover:text-foreground transition-colors"
            >
              Contact
            </a>
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            {/* Mobile hamburger */}
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-(--border) lg:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {mobileMenuOpen ? (
                  <path d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
            <Button
              variant="ghost"
              size="sm"
              className="hidden sm:inline-flex"
              asChild
            >
              <Link href="/login">Login</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/signup" className="text-xs sm:text-sm">
                Get Started
              </Link>
            </Button>
          </div>
        </div>
        {/* Mobile nav dropdown */}
        {mobileMenuOpen && (
          <nav className="flex flex-col gap-2 border-t border-(--border) px-4 py-3 text-sm text-(--muted) lg:hidden">
            <a
              href="#how"
              className="py-2 hover:text-foreground transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              How it works
            </a>
            <a
              href="#impact"
              className="py-2 hover:text-foreground transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              Impact
            </a>
            <a
              href="#pricing"
              className="py-2 hover:text-foreground transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              Pricing
            </a>
            <a
              href="#contact"
              className="py-2 hover:text-foreground transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              Contact
            </a>
            <Link
              href="/login"
              className="py-2 hover:text-foreground transition-colors sm:hidden"
              onClick={() => setMobileMenuOpen(false)}
            >
              Login
            </Link>
          </nav>
        )}
      </header>

      <div className="">
        <section className="mx-auto flex w-full max-w-6xl flex-col items-start gap-6 sm:gap-10 px-4 sm:px-6 pb-12 sm:pb-20 pt-6 sm:pt-10 md:flex-row md:items-center">
          <div className="flex-1 space-y-4 sm:space-y-6">
            <ScrollAnimatedSection>
              <div className="inline-flex items-center gap-2 rounded-full border border-(--brand)/30 bg-(--brand)/10 px-3 sm:px-4 py-1.5 sm:py-2 text-[0.65rem] sm:text-xs uppercase tracking-[0.2em] sm:tracking-[0.3em] text-brand">
                Sri Lanka&apos;s #1 Waste Marketplace
              </div>
            </ScrollAnimatedSection>
            <ScrollAnimatedSection delay={100}>
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-semibold leading-tight">
                Turn Your Waste into Cash
              </h1>
            </ScrollAnimatedSection>
            {/* Built for households */}
            <ScrollAnimatedSection delay={200}>
              <p className="text-sm sm:text-base md:text-lg text-muted">
                and businesses across Sri Lanka. Schedule pickups, track impact,
                and get paid instantly through mobile wallets or bank transfers.
              </p>
            </ScrollAnimatedSection>
            <ScrollAnimatedSection delay={300}>
              <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4">
                <Button size="lg" className="w-full sm:w-auto" asChild>
                  <Link href={bookingHref}>Book a Pickup</Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto"
                  asChild
                >
                  <a href="#pricing">Check Prices</a>
                </Button>
              </div>
            </ScrollAnimatedSection>
          </div>
          <div className="flex-1 w-full">
            <ScrollAnimatedSection delay={400}>
              <div className="overflow-hidden rounded-2xl border border-(--brand) shadow-lg aspect-[16/9] w-full">
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
        className="mx-auto w-full max-w-6xl space-y-6 sm:space-y-10 px-4 sm:px-6 py-12 sm:py-16"
      >
        <ScrollAnimatedSection>
          <SectionHeading
            eyebrow="Our Impact"
            title="Making a Real Difference"
            description="Together with our community, we are transforming waste management in Sri Lanka."
          />
        </ScrollAnimatedSection>
        <div className="mx-auto rounded-2xl border border-(--brand)/20 bg-transparent p-3 sm:p-4">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {stats.map((stat, index) => (
              <ScrollAnimatedSection key={stat.label} delay={index * 100}>
                <Card className="bg-(--card) text-center shadow-md">
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
        className="mx-auto w-full max-w-6xl space-y-6 sm:space-y-10 px-4 sm:px-6 py-12 sm:py-16"
      >
        <ScrollAnimatedSection>
          <SectionHeading
            eyebrow="How it works"
            title="Pickups in 3 simple steps"
            description="Book once, relax, and earn. We handle the pickup, sorting, and instant payout."
          />
        </ScrollAnimatedSection>
        <div className="grid gap-4 sm:gap-6 md:grid-cols-3">
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
              <Card className="bg-(--card) shadow-md">
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

      <section className="w-full bg-transparent py-12 sm:py-16">
        <div className="mx-auto w-full max-w-6xl space-y-6 sm:space-y-8 px-4 sm:px-6">
          <ScrollAnimatedSection>
            <div className="space-y-3 sm:space-y-4">
              <span className="text-[0.65rem] sm:text-xs font-semibold uppercase tracking-[0.25em] sm:tracking-[0.35em] text-(--brand)">
                Features
              </span>
              <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-foreground">
                A marketplace built for every
                <br className="hidden sm:block" />
                <span className="sm:hidden"> </span>Sri Lankan household
              </h2>
              <p className="text-sm sm:text-base md:text-lg text-(--muted)">
                From transparent pricing to carbon tracking, Trash2Treasure
                keeps the cycle circular.
              </p>
            </div>
          </ScrollAnimatedSection>

          <div className="mt-6 sm:mt-8 grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
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
                <Card className="bg-(--card) text-center shadow-md">
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
        className="mx-auto w-full max-w-6xl space-y-6 sm:space-y-10 px-4 sm:px-6 py-12 sm:py-16"
      >
        <ScrollAnimatedSection>
          <SectionHeading
            eyebrow="Current Waste Prices"
            title="Transparent pricing for every category"
            description="Final prices determined after quality inspection."
          />
        </ScrollAnimatedSection>
        {isPricingLoading ? (
          <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="bg-(--brand)/10 text-center shadow-md p-6">
              <Loading message="Loading prices..." />
            </Card>
          </div>
        ) : pricingCards.length === 0 ? (
          <Card className="bg-(--card) text-center shadow-md p-6">
            <p className="text-sm text-(--muted)">
              No pricing data is available right now.
            </p>
          </Card>
        ) : (
          <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {pricingCards.map((item, index) => (
              <ScrollAnimatedSection
                key={item.id}
                delay={index * 100}
                className="h-full"
              >
                <Card className="h-full min-h-[10.5rem] bg-(--card) text-center shadow-md">
                  <div className="flex h-full flex-col items-center gap-2">
                    <h4 className="text-base font-semibold text-(--brand)">
                      {item.name}
                    </h4>
                    {item.hasPricing ? (
                      <>
                        <div className="text-sm text-(--muted)">
                          Min: LKR {item.min} / kg
                        </div>
                        <div className="text-sm text-(--muted)">
                          Max: LKR {item.max} / kg
                        </div>
                        <p className="text-xs text-(--muted)">
                          Final prices determined after quality inspection.
                        </p>
                      </>
                    ) : (
                      <p className="text-xs text-(--muted)">
                          Final prices determined after physical visit.
                      </p>
                    )}
                  </div>
                </Card>
              </ScrollAnimatedSection>
            ))}
          </div>
        )}
      </section>

      <section
        id="contact"
        className="mx-auto w-full max-w-6xl space-y-6 sm:space-y-10 px-4 sm:px-6 py-12 sm:py-16"
      >
        <ScrollAnimatedSection>
          <SectionHeading
            eyebrow="Contact Us"
            title="Get in touch"
            description="Have questions? We're here to help you get started with sustainable waste management."
          />
        </ScrollAnimatedSection>
        <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
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
              <Card className="bg-(--card) shadow-md">
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

      <section className="mx-auto w-full max-w-6xl px-4 sm:px-6 py-12 sm:py-16">
        <ScrollAnimatedSection>
          <Card className="flex flex-col items-start justify-between gap-4 sm:gap-6 md:flex-row md:items-center">
            <div className="space-y-2">
              <h3 className="text-xl sm:text-2xl font-semibold">
                Ready to Start Earning from Your Waste?
              </h3>
              <p className="text-xs sm:text-sm text-(--muted)">
                Create a free account and schedule your first pickup today.
              </p>
            </div>
            <Button size="lg" className="w-full sm:w-auto shrink-0" asChild>
              <Link href="/signup">Create Free Account</Link>
            </Button>
          </Card>
        </ScrollAnimatedSection>
      </section>

      <footer className="bg-(--card) text-foreground border-t border-(--border)">
        <div className="mx-auto grid w-full max-w-6xl gap-6 sm:gap-8 px-4 sm:px-6 py-8 sm:py-12 grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl bg-(--brand)/20">
                <img
                  src="/recycle%20logo.png"
                  alt="Trash2Treasure logo"
                  className="h-8 w-8 object-contain"
                />
              </div>
              <h4 className="text-xl font-bold text-foreground">
                Trash2Treasure
              </h4>
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
          © 2026 Trash2Treasure. All rights reserved. Making Sri Lanka greener,
          one pickup at a time.
        </div>
      </footer>
    </div>
  );
}
