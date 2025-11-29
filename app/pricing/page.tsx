'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Check, Sparkles, Zap, Crown, Building2, ArrowRight, X } from 'lucide-react'
import { SparklesCore } from '@/components/ui/sparkles'
import StickyNavigation from '@/components/sticky-navigation'
import { cn } from '@/lib/utils'

export default function PricingPage() {
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly')

  const plans = [
    {
      name: 'Free',
      price: { monthly: 0, yearly: 0 },
      description: 'Get started with your first AI twin',
      icon: Sparkles,
      color: 'from-gray-400 to-gray-500',
      borderColor: 'border-gray-200 dark:border-gray-700',
      hoverBorder: 'hover:border-gray-300 dark:hover:border-gray-600',
      features: [
        '1 AI twin',
        'Dedicated Tandym page',
        'Responds using your YouTube videos',
        'Basic personality controls',
        '"Powered by Tandym" branding',
        'Manual video management',
      ],
      limits: {
        videos: 'Up to 5 videos ingested',
        videoManagement: 'Manual add only',
        sync: 'No auto-sync',
        messages: 'Up to 50 fan messages per month',
      },
      cta: 'Get Started Free',
      ctaVariant: 'outline' as const,
      popular: false,
      trial: false,
    },
    {
      name: 'Creator Lite',
      price: { monthly: 29, yearly: 24 }, // 2 months free = ~17% discount
      description: 'Your AI twin, ready to engage',
      icon: Zap,
      color: 'from-tandym-cobalt to-blue-500',
      borderColor: 'border-tandym-cobalt/30',
      hoverBorder: 'hover:border-tandym-cobalt',
      features: [
        'Everything in Free, plus:',
        'Optional embed widget',
        'Better tone consistency',
        'No daily throttling',
        'More video intelligence',
        'Basic analytics',
      ],
      comingSoon: ['Smart CTAs (link to merch, courses, etc.)'],
      limits: {
        videos: 'Up to 10 videos ingested',
        videoManagement: 'Manual sync only',
        messages: 'Up to 500 fan messages per month',
      },
      cta: 'Start Lite',
      ctaVariant: 'default' as const,
      popular: false,
      trial: true,
    },
    {
      name: 'Creator Pro',
      price: { monthly: 69, yearly: 58 },
      description: 'More control. More intelligence. More engagement.',
      icon: Crown,
      color: 'from-tandym-lilac to-tandym-coral',
      borderColor: 'border-tandym-lilac/30',
      hoverBorder: 'hover:border-tandym-lilac',
      features: [
        'Everything in Lite, plus:',
        'No Tandym watermark',
        'Advanced tone + personality controls',
        'Full analytics dashboard',
        'Priority response processing',
        'Automatic weekly sync',
      ],
      comingSoon: ['Smart CTAs', 'Voice Chat Add-On'],
      limits: {
        videos: 'Up to 100 videos ingested',
        videoManagement: 'Automatic weekly sync',
        sync: 'New uploads included automatically',
        messages: 'Up to 2,500 fan messages per month',
      },
      cta: 'Upgrade to Pro',
      ctaVariant: 'default' as const,
      popular: true,
      trial: true,
    },
    {
      name: 'Creator Ultimate',
      price: { monthly: 149, yearly: 124 },
      description: 'Maximum presence. Complete video intelligence.',
      icon: Sparkles,
      color: 'from-tandym-coral to-orange-500',
      borderColor: 'border-tandym-coral/30',
      hoverBorder: 'hover:border-tandym-coral',
      features: [
        'Everything in Pro, plus:',
        'Custom domain support',
        'Advanced embed customization',
        'Extended memory window',
        'Highest concurrency',
        'Priority creator support',
      ],
      comingSoon: ['Smart CTAs', 'Voice Chat Add-On'],
      limits: {
        videos: 'Unlimited videos ingested',
        videoManagement: 'Real-time auto-sync',
        sync: 'Deep understanding of long-form content',
        messages: 'Up to 10,000 fan messages per month',
      },
      cta: 'Go Ultimate',
      ctaVariant: 'default' as const,
      popular: false,
      trial: true,
    },
  ]

  const enterpriseFeatures = [
    'Full YouTube library ingestion',
    'Real-time sync',
    'High-volume message limits',
    'API access (optional)',
    'Team seats',
    'White labeling',
    'Custom integrations',
    'SLAs',
    'Dedicated success manager',
  ]

  return (
    <div className="bg-tandym-midnight font-inter">
      {/* Sticky Navigation */}
      <StickyNavigation />

      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-tandym-midnight via-[#1A1A2E] to-tandym-midnight overflow-hidden pt-32 pb-20">
        {/* Sparkles background */}
        <div className="absolute inset-0 w-full h-full opacity-30">
          <SparklesCore
            id="pricing-hero-sparkles"
            background="transparent"
            minSize={0.4}
            maxSize={1}
            particleDensity={40}
            className="w-full h-full"
            particleColor="#C8B7FF"
          />
        </div>

        <div className="container mx-auto px-6 max-w-7xl relative z-10">
          <div className="text-center mb-12">
            <div className="inline-flex items-center space-x-2 bg-tandym-cobalt/10 border border-tandym-cobalt/20 backdrop-blur-sm text-tandym-lilac px-4 py-2 rounded-full text-sm font-medium mb-6">
              <Sparkles className="w-4 h-4 text-tandym-coral" />
              <span>Built for creators who want to scale themselves — in Tandym</span>
            </div>

            <h1 className="text-5xl md:text-6xl font-bold font-poppins text-white mb-6 leading-tight">
              Pricing made simple —{' '}
              <span className="bg-gradient-to-r from-tandym-cobalt via-tandym-lilac to-tandym-coral bg-clip-text text-transparent">
                start free, grow in Tandym
              </span>
            </h1>

            <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-4">
              Your AI twin engages your audience 24/7.
            </p>
            <p className="text-lg text-tandym-lilac font-medium mb-8">
              Try any paid plan free for 14 days — no credit card required.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/auth/signin?userType=creator&mode=signup">
                <Button
                  size="lg"
                  className="px-8 py-6 text-lg bg-tandym-cobalt hover:bg-tandym-cobalt/90 text-white rounded-full shadow-lg shadow-tandym-cobalt/50 transition-all duration-300 hover:scale-105"
                >
                  Get Started
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <Link href="/contact">
                <Button
                  size="lg"
                  variant="outline"
                  className="px-8 py-6 text-lg border-2 border-white text-white hover:bg-white/10 rounded-full transition-all duration-300"
                >
                  Contact Sales
                </Button>
              </Link>
            </div>
          </div>

          {/* Billing Toggle */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <div className="flex items-center gap-4">
              <span className={cn(
                "text-sm font-medium transition-colors",
                billingPeriod === 'monthly' ? "text-white" : "text-gray-400"
              )}>
                Monthly
              </span>
              <button
                onClick={() => setBillingPeriod(billingPeriod === 'monthly' ? 'yearly' : 'monthly')}
                className="relative inline-flex h-8 w-14 items-center rounded-full bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-tandym-cobalt focus:ring-offset-2 focus:ring-offset-tandym-midnight"
              >
                <span
                  className={cn(
                    "inline-block h-6 w-6 transform rounded-full bg-white transition-transform",
                    billingPeriod === 'yearly' ? "translate-x-7" : "translate-x-1"
                  )}
                />
              </button>
              <span className={cn(
                "text-sm font-medium transition-colors",
                billingPeriod === 'yearly' ? "text-white" : "text-gray-400"
              )}>
                Yearly
              </span>
            </div>
            {billingPeriod === 'yearly' && (
              <span className="px-3 py-1 bg-tandym-coral text-white text-xs font-bold rounded-full">
                2 MONTHS FREE
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="bg-tandym-light py-20">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold font-poppins text-tandym-text-dark mb-4">
              Choose the plan that fits your channel
            </h2>
            <p className="text-lg text-tandym-text-muted max-w-3xl mx-auto">
              One AI twin. Clear video intelligence. Clear monthly message limits.<br />
              Start for free — upgrade anytime.
            </p>
          </div>

          <div className="grid lg:grid-cols-4 gap-8 mb-16">
            {plans.map((plan, index) => (
              <div
                key={index}
                className={cn(
                  "relative bg-white rounded-2xl border-2 transition-all duration-300 overflow-hidden flex flex-col",
                  plan.borderColor,
                  plan.hoverBorder,
                  plan.popular && "ring-4 ring-tandym-lilac/20 shadow-2xl scale-105"
                )}
              >
                {plan.popular && (
                  <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-tandym-lilac to-tandym-coral py-2 text-center">
                    <span className="text-white text-sm font-bold">MOST POPULAR</span>
                  </div>
                )}

                <div className={cn("p-8 flex flex-col flex-1", plan.popular && "pt-16")}>
                  {/* Icon - Fixed height */}
                  <div className={cn(
                    "inline-flex p-3 rounded-xl bg-gradient-to-br mb-4 h-[60px] w-[60px]",
                    plan.color
                  )}>
                    <plan.icon className="w-6 h-6 text-white" />
                  </div>

                  {/* Plan Name - Fixed height */}
                  <h3 className="text-2xl font-bold font-poppins text-tandym-text-dark mb-2 h-8">
                    {plan.name}
                  </h3>

                  {/* Price - Fixed minimum height */}
                  <div className="mb-4 min-h-[100px]">
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-bold text-tandym-text-dark">
                        ${billingPeriod === 'monthly' ? plan.price.monthly : plan.price.yearly}
                      </span>
                      <span className="text-tandym-text-muted">/mo</span>
                    </div>
                    {billingPeriod === 'yearly' && plan.price.monthly !== plan.price.yearly && (
                      <p className="text-sm text-tandym-text-muted mt-1">
                        Billed ${plan.price.yearly * 12}/year
                      </p>
                    )}
                  </div>

                  {/* Description - Fixed minimum height */}
                  <p className="text-tandym-text-muted mb-6 min-h-[48px]">
                    {plan.description}
                  </p>

                  {/* CTA */}
                  <Link href="/auth/signin?userType=creator&mode=signup" className="mb-6">
                    <Button
                      variant={plan.ctaVariant}
                      className={cn(
                        "w-full rounded-full font-semibold",
                        plan.ctaVariant === 'default' && cn(
                          "bg-gradient-to-r text-white shadow-lg",
                          plan.color,
                          "hover:opacity-90"
                        )
                      )}
                    >
                      {plan.cta}
                      {plan.trial && <span className="ml-1 text-xs">(14-Day Free Trial)</span>}
                    </Button>
                  </Link>

                  {/* Features - Grows to fill space */}
                  <div className="space-y-3 mb-6 flex-1 min-h-[180px]">
                    {plan.features.map((feature, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <Check className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                        <span className="text-sm text-tandym-text-dark">{feature}</span>
                      </div>
                    ))}
                  </div>

                  {/* Coming Soon Features - Fixed minimum height */}
                  <div className="mb-6 min-h-[80px]">
                    {plan.comingSoon && (
                      <div className="p-3 bg-tandym-coral/10 rounded-lg border border-tandym-coral/20">
                        <p className="text-xs font-semibold text-tandym-coral mb-2">COMING SOON:</p>
                        {plan.comingSoon.map((feature, idx) => (
                          <div key={idx} className="flex items-start gap-2">
                            <Sparkles className="w-4 h-4 text-tandym-coral shrink-0 mt-0.5" />
                            <span className="text-xs text-tandym-text-dark">{feature}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Limits - Pushed to bottom */}
                  <div className="pt-6 border-t border-gray-200 mt-auto">
                    <p className="text-xs font-semibold text-tandym-text-muted mb-3 uppercase">Knowledge Base:</p>
                    <div className="space-y-2 mb-4">
                      <p className="text-sm text-tandym-text-dark">📹 {plan.limits.videos}</p>
                      <p className="text-sm text-tandym-text-dark">🔄 {plan.limits.videoManagement}</p>
                      {plan.limits.sync && (
                        <p className="text-sm text-tandym-text-dark">⚡ {plan.limits.sync}</p>
                      )}
                    </div>
                    <p className="text-xs font-semibold text-tandym-text-muted mb-2 uppercase">Chat Capacity:</p>
                    <p className="text-sm text-tandym-text-dark">💬 {plan.limits.messages}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Enterprise Card */}
          <div className="bg-gradient-to-br from-tandym-midnight to-[#1A1A2E] rounded-2xl border-2 border-tandym-cobalt/30 p-12 text-white">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <div className="inline-flex p-3 rounded-xl bg-gradient-to-br from-tandym-cobalt to-tandym-lilac mb-4">
                  <Building2 className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-3xl font-bold font-poppins mb-4">Enterprise</h3>
                <p className="text-xl text-gray-300 mb-6">
                  For agencies, talent managers, and top creators.
                </p>
                <p className="text-2xl font-bold mb-8">Custom Pricing</p>
                <Link href="/contact">
                  <Button
                    size="lg"
                    className="bg-white text-tandym-midnight hover:bg-gray-100 rounded-full font-semibold px-8"
                  >
                    Contact Sales
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
              </div>

              <div>
                <div className="grid grid-cols-2 gap-4">
                  {enterpriseFeatures.map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-tandym-lilac shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-300">{feature}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-6 p-4 bg-tandym-coral/20 rounded-lg border border-tandym-coral/30">
                  <p className="text-xs font-semibold text-tandym-coral mb-2">COMING SOON:</p>
                  <div className="flex items-start gap-2">
                    <Sparkles className="w-4 h-4 text-tandym-coral shrink-0 mt-0.5" />
                    <span className="text-sm">Smart CTAs, Voice Chat Add-On</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Tandym Pricing Works */}
      <section className="bg-white py-20">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold font-poppins text-tandym-text-dark mb-4">
              Why Tandym Pricing Works
            </h2>
            <p className="text-xl text-tandym-text-muted">
              Start free. Upgrade as your channel grows.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-16">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-tandym-cobalt to-tandym-lilac rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold font-poppins text-tandym-text-dark mb-2">
                Simple Tiers
              </h3>
              <p className="text-tandym-text-muted">
                One free plan + simple paid tiers = no confusion.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-tandym-lilac to-tandym-coral rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Zap className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold font-poppins text-tandym-text-dark mb-2">
                Creator-Focused
              </h3>
              <p className="text-tandym-text-muted">
                Video library size → AI intelligence.<br />
                Chat volume → community size.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-tandym-coral to-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold font-poppins text-tandym-text-dark mb-2">
                No Surprises
              </h3>
              <p className="text-tandym-text-muted">
                No hidden charges. No overages. Clear limits → predictable costs.
              </p>
            </div>
          </div>

          <div className="bg-gradient-to-br from-tandym-cobalt/10 to-tandym-lilac/10 rounded-2xl p-8 border border-tandym-cobalt/20">
            <h3 className="text-2xl font-bold font-poppins text-tandym-text-dark mb-4 text-center">
              What each plan pays for
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              {[
                'An AI twin trained on your content',
                'Accurate replies based on your actual YouTube library',
                'Continuous fan engagement',
                'Direct links to your videos',
                'Hosting on Tandym or embed on your website',
                'Ongoing product improvements',
                'Secure, reliable infrastructure',
                'Your twin becomes an extension of you — always in Tandym',
              ].map((item, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-tandym-cobalt shrink-0 mt-0.5" />
                  <span className="text-tandym-text-dark">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQs */}
      <section className="bg-tandym-light py-20">
        <div className="container mx-auto px-6 max-w-4xl">
          <h2 className="text-3xl md:text-4xl font-bold font-poppins text-tandym-text-dark mb-12 text-center">
            Frequently Asked Questions
          </h2>

          <div className="space-y-6">
            {[
              {
                q: 'Is the Free Plan really free?',
                a: 'Yes — 5 videos, 50 messages/month, no credit card required.',
              },
              {
                q: 'Do paid plans have a trial?',
                a: 'Every paid plan includes a 14-day free trial.',
              },
              {
                q: 'What happens if I hit my chat limit?',
                a: 'Your twin pauses. You can upgrade anytime to continue engaging fans.',
              },
              {
                q: 'How do video limits work?',
                a: 'Each plan allows a specific number of videos to be analyzed and used by your AI twin.',
              },
              {
                q: 'How does auto-sync work?',
                a: 'Free + Lite: manual only. Pro: weekly automatic sync. Ultimate: real-time sync.',
              },
              {
                q: 'What about voice chat?',
                a: 'Voice chat is Coming Soon. It will be a paid add-on available for all tiers.',
              },
              {
                q: 'What about Smart CTAs?',
                a: 'Smart CTAs are Coming Soon and will roll out across all paid plans.',
              },
            ].map((faq, idx) => (
              <div key={idx} className="bg-white rounded-xl p-6 border border-gray-200">
                <h3 className="text-lg font-bold font-poppins text-tandym-text-dark mb-2">
                  {faq.q}
                </h3>
                <p className="text-tandym-text-muted">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative bg-gradient-to-br from-tandym-midnight via-[#1A1A2E] to-tandym-midnight py-32 overflow-hidden">
        <div className="absolute inset-0 w-full h-full opacity-30">
          <SparklesCore
            id="pricing-cta-sparkles"
            background="transparent"
            minSize={0.4}
            maxSize={1}
            particleDensity={30}
            className="w-full h-full"
            particleColor="#C8B7FF"
          />
        </div>

        <div className="container mx-auto px-6 max-w-4xl relative z-10 text-center">
          <h2 className="text-4xl md:text-6xl font-bold font-poppins text-white mb-6 leading-tight">
            Ready to create your AI twin?
          </h2>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth/signin?userType=creator&mode=signup">
              <Button
                size="lg"
                className="px-10 py-7 text-lg bg-tandym-cobalt hover:bg-tandym-cobalt/90 text-white rounded-full shadow-lg shadow-tandym-cobalt/50 transition-all duration-300 hover:scale-105"
              >
                Get Started Free
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>

            <Link href="/auth/signin?userType=creator&mode=signup">
              <Button
                size="lg"
                className="px-10 py-7 text-lg bg-gradient-to-r from-tandym-lilac to-tandym-coral hover:opacity-90 text-white rounded-full shadow-lg transition-all duration-300"
              >
                Start 14-Day Trial
                <Sparkles className="w-5 h-5 ml-2" />
              </Button>
            </Link>

            <Link href="/contact">
              <Button
                size="lg"
                variant="outline"
                className="px-10 py-7 text-lg border-2 border-white text-white hover:bg-white/10 rounded-full transition-all duration-300"
              >
                Contact Sales
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-tandym-midnight border-t border-white/10 py-12">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="text-center md:text-left">
              <div className="text-2xl font-bold font-poppins bg-gradient-to-r from-tandym-cobalt via-tandym-lilac to-tandym-coral bg-clip-text text-transparent mb-2">
                Tandym.ai
              </div>
              <div className="text-sm text-gray-500">
                You and your twin — in Tandym.
              </div>
            </div>

            <div className="flex items-center gap-8">
              <Link href="/about" className="text-gray-400 hover:text-white transition-colors text-sm">
                About
              </Link>
              <Link href="/pricing" className="text-gray-400 hover:text-white transition-colors text-sm">
                Pricing
              </Link>
              <Link href="/contact" className="text-gray-400 hover:text-white transition-colors text-sm">
                Contact
              </Link>
            </div>
          </div>

          <div className="text-center text-xs text-gray-600 mt-8 pt-8 border-t border-white/5">
            © {new Date().getFullYear()} Tandym.ai. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}
