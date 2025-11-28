import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowRight, MessageCircle, Globe, Mic, Youtube, Clock, TrendingUp, Heart, Zap, CheckCircle, Sparkles } from 'lucide-react'
import { SparklesCore } from '@/components/ui/sparkles'
import StickyNavigation from '@/components/sticky-navigation'

export default function HomePage() {
  return (
    <div className="bg-tandym-midnight font-inter">
      {/* Sticky Navigation */}
      <StickyNavigation />

      {/* Hero Section */}
      <section className="relative min-h-screen bg-gradient-to-br from-tandym-midnight via-[#1A1A2E] to-tandym-midnight overflow-hidden flex items-center justify-center pt-20">
        {/* Sparkles background */}
        <div className="absolute inset-0 w-full h-full opacity-40">
          <SparklesCore
            id="tandym-hero-sparkles"
            background="transparent"
            minSize={0.4}
            maxSize={1}
            particleDensity={50}
            className="w-full h-full"
            particleColor="#C8B7FF"
          />
        </div>

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-tandym-cobalt/5 to-tandym-lilac/10"></div>

        <div className="container mx-auto px-6 max-w-7xl relative z-10 py-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: Copy & CTAs */}
            <div className="text-left space-y-8">
              <div className="inline-flex items-center space-x-2 bg-tandym-cobalt/10 border border-tandym-cobalt/20 backdrop-blur-sm text-tandym-lilac px-4 py-2 rounded-full text-sm font-medium">
                <Sparkles className="w-4 h-4 text-tandym-coral" />
                <span>For YouTubers, streamers, and creators who want to scale themselves</span>
              </div>

              <h1 className="text-5xl md:text-7xl font-bold font-poppins text-white leading-tight">
                You and your twin —{' '}
                <span className="bg-gradient-to-r from-tandym-cobalt via-tandym-lilac to-tandym-coral bg-clip-text text-transparent">
                  in Tandym
                </span>
              </h1>

              <p className="text-xl text-gray-300 leading-relaxed max-w-2xl">
                Create an AI twin that chats with your fans, references your YouTube videos, and drives engagement 24/7.
                Host it on a dedicated page, embed it on your site, and soon — let fans talk to it by voice.
              </p>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/auth/signin?userType=creator">
                  <Button
                    size="lg"
                    className="px-8 py-6 text-lg bg-tandym-cobalt hover:bg-tandym-cobalt/90 text-white rounded-full shadow-lg shadow-tandym-cobalt/50 transition-all duration-300 hover:scale-105 hover:shadow-tandym-cobalt/70"
                  >
                    Create My Twin
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
              </div>

              <p className="text-sm text-gray-500">
                For YouTubers, streamers, and creators who want to scale themselves.
              </p>
            </div>

            {/* Right: Hero Visual */}
            <div className="relative">
              <div className="relative bg-gradient-to-br from-tandym-cobalt/20 to-tandym-lilac/20 backdrop-blur-xl rounded-3xl border border-tandym-cobalt/30 p-8 shadow-2xl">
                {/* Mock chat interface */}
                <div className="space-y-4">
                  {/* Chat header */}
                  <div className="flex items-center justify-between pb-4 border-b border-white/10">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-tandym-cobalt to-tandym-lilac"></div>
                      <div>
                        <div className="text-white font-semibold">Your AI Twin</div>
                        <div className="text-xs text-gray-400 flex items-center gap-1">
                          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                          Always online
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Fan message */}
                  <div className="flex justify-end">
                    <div className="bg-white/10 backdrop-blur-sm rounded-2xl rounded-tr-sm px-4 py-3 max-w-xs">
                      <p className="text-sm text-white">Hey, which video should I watch to learn about coffee grinders?</p>
                    </div>
                  </div>

                  {/* AI response with video card */}
                  <div className="flex justify-start">
                    <div className="space-y-3 max-w-sm">
                      <div className="bg-gradient-to-br from-tandym-cobalt/30 to-tandym-lilac/30 backdrop-blur-sm rounded-2xl rounded-tl-sm px-4 py-3 border border-tandym-cobalt/20">
                        <p className="text-sm text-white">
                          Great question! I'd recommend starting with my beginner's guide to grind sizes.
                          It covers everything you need to know 👇
                        </p>
                      </div>

                      {/* Video thumbnail card */}
                      <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-tandym-cobalt/20 overflow-hidden hover:border-tandym-cobalt/40 transition-all">
                        <div className="aspect-video bg-gradient-to-br from-tandym-cobalt/40 to-tandym-coral/40 flex items-center justify-center">
                          <Youtube className="w-12 h-12 text-white/60" />
                        </div>
                        <div className="p-3">
                          <div className="text-xs text-white font-medium mb-2">Coffee Grinder Guide for Beginners</div>
                          <Button size="sm" className="w-full bg-tandym-coral hover:bg-tandym-coral/90 text-white rounded-full text-xs">
                            Watch now
                          </Button>
                        </div>
                      </div>

                      {/* Badges */}
                      <div className="flex flex-wrap gap-2">
                        <div className="text-xs px-3 py-1 bg-tandym-cobalt/20 text-tandym-lilac rounded-full border border-tandym-cobalt/30">
                          Dedicated page
                        </div>
                        <div className="text-xs px-3 py-1 bg-tandym-lilac/20 text-tandym-lilac rounded-full border border-tandym-lilac/30">
                          Embeddable widget
                        </div>
                        <div className="text-xs px-3 py-1 bg-tandym-coral/20 text-tandym-coral rounded-full border border-tandym-coral/30">
                          Voice chat soon
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What Tandym Does Section */}
      <section id="features" className="bg-tandym-light py-20">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold font-poppins text-tandym-text-dark mb-4">
              Your AI twin, working in Tandym with you
            </h2>
            <p className="text-lg text-tandym-text-muted max-w-3xl mx-auto leading-relaxed">
              Tandym.ai creates a digital twin of you — trained on your YouTube library. It chats with fans,
              answers their questions in your tone, and sends them to the right videos. More engagement.
              More views. More loyal fans. All in Tandym.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Card 1 */}
            <div className="bg-white rounded-2xl p-8 shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100 group">
              <div className="w-12 h-12 bg-gradient-to-br from-tandym-cobalt to-tandym-lilac rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Clock className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold font-poppins text-tandym-text-dark mb-3">
                Runs 24/7
              </h3>
              <p className="text-tandym-text-muted leading-relaxed">
                Your twin keeps conversations going even while you're filming, traveling, or sleeping.
              </p>
            </div>

            {/* Card 2 */}
            <div className="bg-white rounded-2xl p-8 shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100 group">
              <div className="w-12 h-12 bg-gradient-to-br from-tandym-lilac to-tandym-coral rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Youtube className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold font-poppins text-tandym-text-dark mb-3">
                Powered by your videos
              </h3>
              <p className="text-tandym-text-muted leading-relaxed">
                It references your YouTube content and links fans back to your channel.
              </p>
            </div>

            {/* Card 3 */}
            <div className="bg-white rounded-2xl p-8 shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100 group">
              <div className="w-12 h-12 bg-gradient-to-br from-tandym-coral to-tandym-cobalt rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Globe className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold font-poppins text-tandym-text-dark mb-3">
                Lives where you need it
              </h3>
              <p className="text-tandym-text-muted leading-relaxed">
                Use a dedicated Tandym page, embed the chat on your website, and soon let fans talk to your twin by voice.
              </p>
            </div>

            {/* Card 4 */}
            <div className="bg-white rounded-2xl p-8 shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100 group">
              <div className="w-12 h-12 bg-gradient-to-br from-tandym-cobalt to-tandym-coral rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold font-poppins text-tandym-text-dark mb-3">
                Built for creators
              </h3>
              <p className="text-tandym-text-muted leading-relaxed">
                You control the tone, topics, and boundaries — it stays on-brand and feels like you.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Where Your Twin Lives Section */}
      <section className="bg-white py-20">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold font-poppins text-tandym-text-dark mb-4">
              Your twin, everywhere your fans are
            </h2>
            <p className="text-lg text-tandym-text-muted max-w-3xl mx-auto">
              Host your twin on a Tandym page, embed it on your site, and soon — let fans talk to it in voice.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Tile 1 - Dedicated Page */}
            <div className="relative bg-gradient-to-br from-tandym-cobalt/5 to-tandym-lilac/5 rounded-2xl p-8 border-2 border-tandym-cobalt/20 hover:border-tandym-cobalt/40 transition-all duration-300 group">
              <div className="absolute top-4 right-4">
                <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
              </div>
              <Globe className="w-12 h-12 text-tandym-cobalt mb-6 group-hover:scale-110 transition-transform" />
              <div className="text-sm font-semibold text-tandym-cobalt mb-2 uppercase tracking-wide">Dedicated Tandym Page</div>
              <h3 className="text-2xl font-bold font-poppins text-tandym-text-dark mb-3">
                yourname.tandym.ai
              </h3>
              <p className="text-tandym-text-muted leading-relaxed">
                Give fans a direct link to your AI twin at yourname.tandym.ai.
              </p>
            </div>

            {/* Tile 2 - Embedded Widget */}
            <div className="relative bg-gradient-to-br from-tandym-lilac/5 to-tandym-coral/5 rounded-2xl p-8 border-2 border-tandym-lilac/20 hover:border-tandym-lilac/40 transition-all duration-300 group">
              <div className="absolute top-4 right-4">
                <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
              </div>
              <MessageCircle className="w-12 h-12 text-tandym-lilac mb-6 group-hover:scale-110 transition-transform" />
              <div className="text-sm font-semibold text-tandym-lilac mb-2 uppercase tracking-wide">Embed on Your Website</div>
              <h3 className="text-2xl font-bold font-poppins text-tandym-text-dark mb-3">
                Webchat Widget
              </h3>
              <p className="text-tandym-text-muted leading-relaxed">
                Drop Tandym into your homepage, blog, or store with a simple embed.
              </p>
            </div>

            {/* Tile 3 - Voice (Coming Soon) */}
            <div className="relative bg-gradient-to-br from-tandym-coral/5 to-tandym-cobalt/5 rounded-2xl p-8 border-2 border-tandym-coral/20 hover:border-tandym-coral/40 transition-all duration-300 group opacity-90">
              <div className="absolute top-4 right-4">
                <div className="text-xs px-3 py-1 bg-tandym-coral text-white rounded-full font-semibold">
                  Coming Soon
                </div>
              </div>
              <Mic className="w-12 h-12 text-tandym-coral mb-6 group-hover:scale-110 transition-transform" />
              <div className="text-sm font-semibold text-tandym-coral mb-2 uppercase tracking-wide">Voice Chat — Coming Soon</div>
              <h3 className="text-2xl font-bold font-poppins text-tandym-text-dark mb-3">
                Talk to Your Twin
              </h3>
              <p className="text-tandym-text-muted leading-relaxed">
                Fans will be able to talk to your twin and get answers by voice — hands-free.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="bg-tandym-light py-20">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold font-poppins text-tandym-text-dark mb-4">
              How it works
            </h2>
          </div>

          <div className="grid md:grid-cols-4 gap-8 md:gap-6">
            {/* Step 1 */}
            <div className="relative">
              <div className="text-center group">
                <div className="w-16 h-16 bg-gradient-to-br from-tandym-cobalt to-tandym-lilac rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                  <span className="text-2xl font-bold text-white">1</span>
                </div>
                <h3 className="text-xl font-semibold font-poppins text-tandym-text-dark mb-3">
                  Connect your YouTube channel
                </h3>
                <p className="text-tandym-text-muted leading-relaxed">
                  Tandym ingests your videos, titles, descriptions, and captions.
                </p>
              </div>
              {/* Arrow connector - hidden on mobile */}
              <div className="hidden md:block absolute top-8 left-full w-full h-1">
                <div className="w-1/2 h-0.5 bg-gradient-to-r from-tandym-cobalt/30 to-transparent"></div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="relative">
              <div className="text-center group">
                <div className="w-16 h-16 bg-gradient-to-br from-tandym-lilac to-tandym-coral rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                  <span className="text-2xl font-bold text-white">2</span>
                </div>
                <h3 className="text-xl font-semibold font-poppins text-tandym-text-dark mb-3">
                  Train your AI twin
                </h3>
                <p className="text-tandym-text-muted leading-relaxed">
                  Set your tone, personality, and what you want your twin to talk about.
                </p>
              </div>
              {/* Arrow connector */}
              <div className="hidden md:block absolute top-8 left-full w-full h-1">
                <div className="w-1/2 h-0.5 bg-gradient-to-r from-tandym-lilac/30 to-transparent"></div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="relative">
              <div className="text-center group">
                <div className="w-16 h-16 bg-gradient-to-br from-tandym-coral to-tandym-cobalt rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                  <span className="text-2xl font-bold text-white">3</span>
                </div>
                <h3 className="text-xl font-semibold font-poppins text-tandym-text-dark mb-3">
                  Launch your twin page or embed it
                </h3>
                <p className="text-tandym-text-muted leading-relaxed">
                  Share your Tandym link or drop it into your website in minutes.
                </p>
              </div>
              {/* Arrow connector */}
              <div className="hidden md:block absolute top-8 left-full w-full h-1">
                <div className="w-1/2 h-0.5 bg-gradient-to-r from-tandym-coral/30 to-transparent"></div>
              </div>
            </div>

            {/* Step 4 */}
            <div className="text-center group">
              <div className="w-16 h-16 bg-gradient-to-br from-tandym-cobalt to-tandym-coral rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                <span className="text-2xl font-bold text-white">4</span>
              </div>
              <h3 className="text-xl font-semibold font-poppins text-tandym-text-dark mb-3">
                Grow your channel — in Tandym
              </h3>
              <p className="text-tandym-text-muted leading-relaxed">
                Your twin chats with fans, sends them to your videos, and boosts engagement automatically.
              </p>
            </div>
          </div>

          {/* Secondary CTA */}
          <div className="text-center mt-16">
            <Link href="/auth/signin?userType=creator">
              <Button
                size="lg"
                className="px-8 py-6 text-lg bg-tandym-cobalt hover:bg-tandym-cobalt/90 text-white rounded-full shadow-lg shadow-tandym-cobalt/50 transition-all duration-300 hover:scale-105"
              >
                Get Early Access
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Why Creators Use Tandym Section */}
      <section id="benefits" className="bg-white py-20">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold font-poppins text-tandym-text-dark mb-4">
              Built for creators who want to scale themselves
            </h2>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: Benefits list */}
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-tandym-cobalt to-tandym-lilac rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold font-poppins text-tandym-text-dark mb-2">
                    More engagement
                  </h3>
                  <p className="text-tandym-text-muted leading-relaxed">
                    Your twin replies to fans instead of leaving them on read.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-tandym-lilac to-tandym-coral rounded-xl flex items-center justify-center">
                  <Youtube className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold font-poppins text-tandym-text-dark mb-2">
                    More views
                  </h3>
                  <p className="text-tandym-text-muted leading-relaxed">
                    Every answer can include a link to the perfect video.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-tandym-coral to-tandym-cobalt rounded-xl flex items-center justify-center">
                  <Heart className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold font-poppins text-tandym-text-dark mb-2">
                    More loyalty
                  </h3>
                  <p className="text-tandym-text-muted leading-relaxed">
                    Fans feel like they're really talking to you, any time of day.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-tandym-cobalt to-tandym-coral rounded-xl flex items-center justify-center">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold font-poppins text-tandym-text-dark mb-2">
                    Less burnout
                  </h3>
                  <p className="text-tandym-text-muted leading-relaxed">
                    You focus on creating — Tandym handles the conversations.
                  </p>
                </div>
              </div>
            </div>

            {/* Right: Highlight cards */}
            <div className="grid gap-6">
              <div className="bg-gradient-to-br from-tandym-cobalt/10 to-tandym-lilac/10 rounded-2xl p-8 border border-tandym-cobalt/20">
                <Sparkles className="w-8 h-8 text-tandym-cobalt mb-4" />
                <p className="text-xl font-semibold text-tandym-text-dark">
                  Turn more casual viewers into real fans.
                </p>
              </div>

              <div className="bg-gradient-to-br from-tandym-lilac/10 to-tandym-coral/10 rounded-2xl p-8 border border-tandym-lilac/20">
                <Clock className="w-8 h-8 text-tandym-lilac mb-4" />
                <p className="text-xl font-semibold text-tandym-text-dark">
                  Keep your channel active between uploads.
                </p>
              </div>

              <div className="bg-gradient-to-br from-tandym-coral/10 to-tandym-cobalt/10 rounded-2xl p-8 border border-tandym-coral/20">
                <TrendingUp className="w-8 h-8 text-tandym-coral mb-4" />
                <p className="text-xl font-semibold text-tandym-text-dark">
                  Make your content work harder for you.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Placeholder Section */}
      <section className="bg-tandym-light py-20">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold font-poppins text-tandym-text-dark mb-4">
              What creators are saying
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Testimonial 1 */}
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-tandym-cobalt to-tandym-lilac"></div>
                <div>
                  <div className="font-semibold text-tandym-text-dark">YouTuber</div>
                  <div className="text-sm text-tandym-text-muted">Cooking Videos</div>
                </div>
              </div>
              <p className="text-tandym-text-muted italic leading-relaxed">
                "My twin keeps fans engaged on days I don't upload."
              </p>
            </div>

            {/* Testimonial 2 */}
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-tandym-lilac to-tandym-coral"></div>
                <div>
                  <div className="font-semibold text-tandym-text-dark">YouTuber</div>
                  <div className="text-sm text-tandym-text-muted">Sports Content</div>
                </div>
              </div>
              <p className="text-tandym-text-muted italic leading-relaxed">
                "I love that it sends people straight to my older videos."
              </p>
            </div>

            {/* Testimonial 3 */}
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-tandym-coral to-tandym-cobalt"></div>
                <div>
                  <div className="font-semibold text-tandym-text-dark">YouTuber</div>
                  <div className="text-sm text-tandym-text-muted">Gaming Content</div>
                </div>
              </div>
              <p className="text-tandym-text-muted italic leading-relaxed">
                "It feels like I finally have a clone that handles the comments."
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="relative bg-gradient-to-br from-tandym-midnight via-[#1A1A2E] to-tandym-midnight py-32 overflow-hidden">
        {/* Sparkles background */}
        <div className="absolute inset-0 w-full h-full opacity-30">
          <SparklesCore
            id="tandym-cta-sparkles"
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
            Ready to stay in Tandym with your fans?
          </h2>

          <p className="text-xl text-gray-300 mb-12 leading-relaxed">
            Create your AI twin, give it a home on the web, and let it keep your audience engaged 24/7.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth/signin?userType=creator">
              <Button
                size="lg"
                className="px-10 py-7 text-lg bg-tandym-cobalt hover:bg-tandym-cobalt/90 text-white rounded-full shadow-lg shadow-tandym-cobalt/50 transition-all duration-300 hover:scale-105"
              >
                Create My Twin
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>

            <Link href="/auth/signin?userType=creator">
              <Button
                size="lg"
                variant="outline"
                className="px-10 py-7 text-lg border-2 border-white text-white hover:bg-white/10 rounded-full transition-all duration-300"
              >
                Join the Waitlist
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-tandym-midnight border-t border-white/10 py-12">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            {/* Left: Logo & tagline */}
            <div className="text-center md:text-left">
              <div className="text-2xl font-bold font-poppins bg-gradient-to-r from-tandym-cobalt via-tandym-lilac to-tandym-coral bg-clip-text text-transparent mb-2">
                Tandym.ai
              </div>
              <div className="text-sm text-gray-500">
                You and your twin — in Tandym.
              </div>
            </div>

            {/* Right: Links */}
            <div className="flex items-center gap-8">
              <Link href="/about" className="text-gray-400 hover:text-white transition-colors text-sm">
                About
              </Link>
              <Link href="/contact" className="text-gray-400 hover:text-white transition-colors text-sm">
                Contact
              </Link>
              <a
                href="https://twitter.com/tandymai"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition-colors text-sm"
              >
                Twitter
              </a>
              <a
                href="https://youtube.com/@tandymai"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition-colors text-sm"
              >
                YouTube
              </a>
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
