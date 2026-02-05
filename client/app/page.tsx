"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SectionHeading } from "@/components/shared/section-heading";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { PricingItem } from "@/lib/types";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Leaf, MapPin, Recycle, Users, CheckCircle, Calendar, Truck, Wallet } from "lucide-react";

const fallbackPricing = [
  { name: "Plastic (PET)", min: 45, max: 70 },
  { name: "Metal (Aluminum)", min: 160, max: 240 },
  { name: "Cardboard", min: 30, max: 55 },
  { name: "E-Waste", min: 220, max: 450 },
];

export default function HomePage() {
  const { data } = useQuery({
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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="w-full bg-(--card)">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
          <div className="flex items-center gap-3 text-lg font-semibold">
            <div className="h-10 w-10 overflow-hidden rounded-2xl bg-(--brand)/20">
              <img
                src="/recycle%20logo.png"
                alt="Trash2Cash logo"
                className="h-full w-full object-cover"
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

      <div className="section-grid">
        <section className="mx-auto flex w-full max-w-6xl flex-col items-start gap-10 px-6 pb-20 pt-10 md:flex-row md:items-center">
          <div className="flex-1 space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-(--brand)/30 bg-(--brand)/10 px-4 py-2 text-xs uppercase tracking-[0.3em] text-brand">
              Sri Lanka's #1 Waste Marketplace
            </div>
            <h1 className="text-4xl font-semibold leading-tight md:text-6xl">
              Turn Your Waste into Cash
            </h1>
            <p className="text-base text-muted md:text-lg">
              Built for households and businesses across Sri Lanka. Schedule
              pickups, track impact, and get paid instantly through mobile
              wallets or bank transfers.
            </p>
            <div className="flex flex-wrap gap-4">
              <Button size="lg" asChild>
                <Link href="/signup">Book a Pickup ?</Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-[#4BDC00] text-[#4BDC00]"
                asChild
              >
                <a href="#pricing">Check Prices</a>
              </Button>
            </div>
          </div>
          <div className="flex-1">
            <div className="overflow-hidden rounded-2xl border border-(--brand) shadow-lg">
              <img
                src="/recycling-bins.png"
                alt="Colorful recycling bins for waste segregation"
                className="h-auto w-full object-cover"
              />
            </div>
          </div>
        </section>
      </div>

      <section className="mx-auto w-full max-w-6xl px-6 pb-16">
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
            ].map((stat) => (
              <Card key={stat.label} className="bg-(--brand)/10 text-center shadow-md">
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
            ))}
          </div>
        </div>
      </section>

      <section
        id="how"
        className="mx-auto w-full max-w-6xl space-y-10 px-6 py-16"
      >
        <SectionHeading
          eyebrow="How it works"
          title="Pickups in 3 simple steps"
          description="Book once, relax, and earn. We handle the pickup, sorting, and instant payout."
        />
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
          ].map((item) => (
            <Card 
              key={item.step} 
              className="bg-(--brand)/10 shadow-md"
            >
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-(--brand)/20 text-(--brand)">
                  {item.icon}
                </div>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-(--brand)">
                  Step {item.step}
                </div>
                <h3 className="text-xl font-semibold text-foreground">{item.title}</h3>
                <p className="text-sm leading-relaxed text-(--muted)">{item.desc}</p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section className="w-full bg-background py-16">
        <div className="mx-auto w-full max-w-6xl space-y-8 px-6">
          <div className="space-y-4">
            <span className="text-xs font-semibold uppercase tracking-[0.35em] text-(--brand)">
              Features
            </span>
            <h2 className="text-4xl font-bold text-foreground md:text-5xl">
              A marketplace built for every<br />Sri Lankan household
            </h2>
            <p className="text-lg text-(--muted)">
              From transparent pricing to carbon tracking, Trash2Cash keeps the cycle circular.
            </p>
          </div>

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
            ].map((item) => (
                <Card key={item.title} className="bg-(--brand)/10 text-center shadow-md">
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-(--brand)/20 text-(--brand)">
                      <CheckCircle className="h-5 w-5" />
                    </div>
                    <h4 className="text-base font-semibold text-(--brand)">{item.title}</h4>
                    <p className="text-xs text-(--muted)">{item.desc}</p>
                  </div>
                </Card>
            ))}
          </div>
        </div>
      </section>

      {/* <section
        id="impact"
        className="mx-auto w-full max-w-6xl space-y-10 px-6 py-16"
      >
        <SectionHeading
          eyebrow="Environmental Impact"
          title="Making a real difference, one pickup at a time"
          description="Track your carbon savings, diversion rates, and community rankings as you earn."
        />
        <Card className="grid gap-6 md:grid-cols-2">
          <div className="space-y-3">
            <h3 className="text-2xl font-semibold">Live community impact</h3>
            <p className="text-sm text-(--muted)">
              Every pickup contributes to cleaner waterways, reduced landfill
              pressure, and a greener Sri Lanka.
            </p>
            <Button variant="secondary" asChild>
              <Link href="/signup">Join the Green Revolution</Link>
            </Button>
          </div>
          <div className="grid gap-3">
            {[
              ["CO? saved this month", "72.4 tonnes"],
              ["Waste diverted from landfills", "128 tonnes"],
              ["Active recycler partners", "240"],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl border border-(--border) bg-(--surface) px-4 py-3"
              >
                <p className="text-xs text-(--muted)">{label}</p>
                <p className="text-lg font-semibold">{value}</p>
              </div>
            ))}
          </div>
        </Card>
      </section> */}

      <section
        id="pricing"
        className="mx-auto w-full max-w-6xl space-y-10 px-6 py-16"
      >
        <SectionHeading
          eyebrow="Current Waste Prices"
          title="Transparent pricing for every category"
          description="Final prices determined after quality inspection."
        />
        <div className="grid gap-6 md:grid-cols-4">
          {pricingCards.map((item) => (
            <Card key={item.name} className="bg-(--brand)/10 text-center shadow-md">
              <div className="flex flex-col items-center gap-2">
                <h4 className="text-base font-semibold text-(--brand)">{item.name}</h4>
                <div className="text-sm text-(--muted)">Min: LKR {item.min} / kg</div>
                <div className="text-sm text-(--muted)">Max: LKR {item.max} / kg</div>
                <p className="text-xs text-(--muted)">
                  Final prices determined after quality inspection.
                </p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 py-16">
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
      </section>

      <footer id="contact" className="bg-(--card) text-foreground border-t border-(--border)">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-6 py-12 md:grid-cols-4">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 overflow-hidden rounded-lg bg-transparent">
                <img
                  src="/recycle%20logo.png"
                  alt="Trash2Cash logo"
                  className="h-full w-full object-cover"
                />
              </div>
              <h4 className="text-xl font-bold text-foreground">Trash2Cash</h4>
            </div>
            <p className="text-sm leading-relaxed text-(--muted)">
              Sri Lanka's leading digital waste aggregation and recycling marketplace.
            </p>
          </div>

          <div className="text-sm">
            <p className="mb-3 font-semibold text-foreground">Company</p>
            <ul className="space-y-2 text-(--muted)">
              <li><a href="#" className="hover:text-foreground transition-colors">About Us</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Careers</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Partners</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Blog</a></li>
            </ul>
          </div>

          <div className="text-sm">
            <p className="mb-3 font-semibold text-foreground">Support</p>
            <ul className="space-y-2 text-(--muted)">
              <li><a href="#" className="hover:text-foreground transition-colors">Help Center</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Contact Us</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">FAQs</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Terms of Service</a></li>
            </ul>
          </div>

          <div className="text-sm">
            <p className="mb-3 font-semibold text-foreground">Connect</p>
            <ul className="space-y-2 text-(--muted)">
              <li><a href="#" className="hover:text-foreground transition-colors">Facebook</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Twitter</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Instagram</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">LinkedIn</a></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-(--border) py-6 text-center text-sm text-(--muted)">
          © 2026 Trash2Cash. All rights reserved. Making Sri Lanka greener, one pickup at a time.
        </div>
      </footer>
    </div>
  );
}
