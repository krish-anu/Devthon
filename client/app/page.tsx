'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SectionHeading } from '@/components/shared/section-heading';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { PricingItem } from '@/lib/types';
import { ThemeToggle } from '@/components/ui/theme-toggle';

const fallbackPricing = [
  { name: 'Plastic (PET)', min: 45, max: 70 },
  { name: 'Metal (Aluminum)', min: 160, max: 240 },
  { name: 'Cardboard', min: 30, max: 55 },
  { name: 'E-Waste', min: 220, max: 450 },
];

export default function HomePage() {
  const { data } = useQuery({
    queryKey: ['public-pricing'],
    queryFn: () => apiFetch<PricingItem[]>('/public/pricing', {}, false),
  });

  const pricingCards = data?.length
    ? data.map((item) => ({
        name: item.wasteCategory.name,
        min: item.minPriceLkrPerKg,
        max: item.maxPriceLkrPerKg,
      }))
    : fallbackPricing;

  return (
    <div className="min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)]">
      <div className="section-grid">
        <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
          <div className="flex items-center gap-3 text-lg font-semibold">
            <div className="h-10 w-10 rounded-2xl bg-emerald-500/20"></div>
            Trash2Cash
          </div>
          <nav className="hidden items-center gap-6 text-sm text-[color:var(--muted)] md:flex">
            <a href="#how" className="hover:text-[color:var(--foreground)]">How it works</a>
            <a href="#impact" className="hover:text-[color:var(--foreground)]">Impact</a>
            <a href="#pricing" className="hover:text-[color:var(--foreground)]">Pricing</a>
            <a href="#contact" className="hover:text-[color:var(--foreground)]">Contact</a>
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
        </header>

        <section className="mx-auto flex w-full max-w-6xl flex-col items-start gap-10 px-6 pb-20 pt-10 md:flex-row md:items-center">
          <div className="flex-1 space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-xs uppercase tracking-[0.3em] text-[color:var(--brand)]">
              Sri Lanka's #1 Waste Marketplace
            </div>
            <h1 className="text-4xl font-semibold leading-tight md:text-6xl">
              Turn Your Waste into Cash
            </h1>
            <p className="text-base text-[color:var(--muted)] md:text-lg">
              Built for households and businesses across Sri Lanka. Schedule pickups, track impact, and get paid instantly through mobile wallets or bank transfers.
            </p>
            <div className="flex flex-wrap gap-4">
              <Button size="lg" asChild>
                <Link href="/signup">Book a Pickup ?</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href="#pricing">Check Prices</a>
              </Button>
            </div>
          </div>
          <div className="flex-1">
            <Card className="space-y-6 border-emerald-400/20 bg-gradient-to-br from-emerald-500/10 via-transparent to-sky-500/10">
              <div className="text-sm uppercase tracking-[0.3em] text-[color:var(--brand)]">Live Impact</div>
              <div className="grid gap-4">
                <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3">
                  <p className="text-xs text-[color:var(--muted)]">Active pickups this week</p>
                  <p className="text-2xl font-semibold">126</p>
                </div>
                <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3">
                  <p className="text-xs text-[color:var(--muted)]">Average payout per booking</p>
                  <p className="text-2xl font-semibold">LKR 1,420</p>
                </div>
                <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3">
                  <p className="text-xs text-[color:var(--muted)]">CO? saved today</p>
                  <p className="text-2xl font-semibold">12.4 tonnes</p>
                </div>
              </div>
            </Card>
          </div>
        </section>
      </div>

      <section className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-4 px-6 pb-16 md:grid-cols-4">
        {[
          ['500+ Tonnes Collected', 'Across Sri Lanka'],
          ['12,000+ Active Users', 'Households & SMEs'],
          ['850 Tonnes CO? Saved', 'Carbon tracked monthly'],
          ['25 Districts Served', 'Island-wide logistics'],
        ].map(([title, subtitle]) => (
          <Card key={title} className="bg-[color:var(--card)]">
            <p className="text-lg font-semibold">{title}</p>
            <p className="text-xs text-[color:var(--muted)]">{subtitle}</p>
          </Card>
        ))}
      </section>

      <section id="how" className="mx-auto w-full max-w-6xl space-y-10 px-6 py-16">
        <SectionHeading
          eyebrow="How it works"
          title="Pickups in 3 simple steps"
          description="Book once, relax, and earn. We handle the pickup, sorting, and instant payout."
        />
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              step: '1',
              title: 'Book a Pickup',
              desc: 'Select waste type, estimate weight, and schedule your pickup window.',
            },
            {
              step: '2',
              title: 'We Collect & Sort',
              desc: 'Our verified recyclers collect, weigh, and sort responsibly.',
            },
            {
              step: '3',
              title: 'Get Paid Instantly',
              desc: 'Receive money instantly to your mobile wallet or bank account.',
            },
          ].map((item) => (
            <Card key={item.step} className="space-y-3">
              <div className="text-sm text-[color:var(--brand)]">Step {item.step}</div>
              <h3 className="text-xl font-semibold">{item.title}</h3>
              <p className="text-sm text-[color:var(--muted)]">{item.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl space-y-10 px-6 py-16">
        <SectionHeading
          eyebrow="Features"
          title="A marketplace built for every Sri Lankan household"
          description="From transparent pricing to carbon tracking, Trash2Cash keeps the cycle circular."
        />
        <div className="grid gap-6 md:grid-cols-4">
          {[
            'Community Driven',
            'Carbon Tracking',
            'Transparent Pricing',
            'Verified Recyclers',
          ].map((feature) => (
            <Card key={feature} className="h-full">
              <h4 className="text-base font-semibold">{feature}</h4>
              <p className="mt-2 text-sm text-[color:var(--muted)]">
                Real-time insights and community incentives that keep waste out of landfills.
              </p>
            </Card>
          ))}
        </div>
      </section>

      <section id="impact" className="mx-auto w-full max-w-6xl space-y-10 px-6 py-16">
        <SectionHeading
          eyebrow="Environmental Impact"
          title="Making a real difference, one pickup at a time"
          description="Track your carbon savings, diversion rates, and community rankings as you earn."
        />
        <Card className="grid gap-6 md:grid-cols-2">
          <div className="space-y-3">
            <h3 className="text-2xl font-semibold">Live community impact</h3>
            <p className="text-sm text-[color:var(--muted)]">
              Every pickup contributes to cleaner waterways, reduced landfill pressure, and a greener Sri Lanka.
            </p>
            <Button variant="secondary" asChild>
              <Link href="/signup">Join the Green Revolution</Link>
            </Button>
          </div>
          <div className="grid gap-3">
            {[
              ['CO? saved this month', '72.4 tonnes'],
              ['Waste diverted from landfills', '128 tonnes'],
              ['Active recycler partners', '240'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3">
                <p className="text-xs text-[color:var(--muted)]">{label}</p>
                <p className="text-lg font-semibold">{value}</p>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section id="pricing" className="mx-auto w-full max-w-6xl space-y-10 px-6 py-16">
        <SectionHeading
          eyebrow="Current Waste Prices"
          title="Transparent pricing for every category"
          description="Final prices determined after quality inspection."
        />
        <div className="grid gap-6 md:grid-cols-4">
          {pricingCards.map((item) => (
            <Card key={item.name} className="space-y-4">
              <h4 className="text-lg font-semibold">{item.name}</h4>
              <div className="text-sm text-[color:var(--muted)]">Min: LKR {item.min} / kg</div>
              <div className="text-sm text-[color:var(--muted)]">Max: LKR {item.max} / kg</div>
              <p className="text-xs text-[color:var(--muted)]">Final prices determined after quality inspection.</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 py-16">
        <Card className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div>
            <h3 className="text-2xl font-semibold">Ready to Start Earning from Your Waste?</h3>
            <p className="text-sm text-[color:var(--muted)]">Create a free account and schedule your first pickup today.</p>
          </div>
          <Button size="lg" asChild>
            <Link href="/signup">Create Free Account</Link>
          </Button>
        </Card>
      </section>

      <footer id="contact" className="border-t border-[color:var(--border)] bg-[color:var(--card)]">
        <div className="mx-auto grid w-full max-w-6xl gap-6 px-6 py-12 md:grid-cols-4">
          <div>
            <h4 className="text-lg font-semibold">Trash2Cash</h4>
            <p className="text-sm text-[color:var(--muted)]">Sri Lanka's circular economy marketplace.</p>
          </div>
          <div className="text-sm text-[color:var(--muted)]">
            <p className="font-semibold text-[color:var(--foreground)]">Company</p>
            <ul className="mt-2 space-y-1">
              <li>About</li>
              <li>Careers</li>
              <li>Press</li>
            </ul>
          </div>
          <div className="text-sm text-[color:var(--muted)]">
            <p className="font-semibold text-[color:var(--foreground)]">Support</p>
            <ul className="mt-2 space-y-1">
              <li>Help Center</li>
              <li>Contact</li>
              <li>Privacy</li>
            </ul>
          </div>
          <div className="text-sm text-[color:var(--muted)]">
            <p className="font-semibold text-[color:var(--foreground)]">Connect</p>
            <ul className="mt-2 space-y-1">
              <li>Facebook</li>
              <li>LinkedIn</li>
              <li>Instagram</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-[color:var(--border)] py-6 text-center text-xs text-[color:var(--muted)]">
          ? 2026 Trash2Cash. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
