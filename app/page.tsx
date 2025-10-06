import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowRight, Sparkles, MessageCircle, Users, Zap, Bot, DollarSign } from 'lucide-react'
import { HeroHighlight, Highlight } from '@/components/ui/hero-highlight'
import { BentoGrid, BentoGridItem } from '@/components/ui/bento-grid'
import { SparklesCore } from '@/components/ui/sparkles'
import StickyNavigation from '@/components/sticky-navigation'

export default function HomePage() {
  return (
    <div className="bg-black">
      {/* Hero Section - Full Screen */}
      <div className="relative h-screen bg-black overflow-hidden flex items-center justify-center">
        {/* Sticky Navigation with scroll behavior */}
        <StickyNavigation />

        {/* Sparkles background - enhanced visibility */}
        <div className="absolute inset-0 w-full h-full opacity-60">
          <SparklesCore
            id="tsparticlesfullpage"
            background="transparent"
            minSize={0.6}
            maxSize={1.2}
            particleDensity={40}
            className="w-full h-full"
            particleColor="#FFFFFF"
          />
        </div>
        
        {/* Interactive dot pattern - very subtle */}
        <div className="absolute inset-0 opacity-20">
          <HeroHighlight containerClassName="absolute inset-0 bg-black" className="absolute inset-0">
            <div></div>
          </HeroHighlight>
        </div>
        
        {/* Content - properly centered with better readability */}
        <div className="relative z-20 text-center max-w-6xl mx-auto px-6">
          {/* Content background for better readability */}
          <div className="bg-black/40 backdrop-blur-sm rounded-3xl p-8 md:p-12 border border-neutral-800/50">
            <div className="inline-flex items-center space-x-2 bg-neutral-900/90 backdrop-blur-sm border border-neutral-700 text-white px-4 py-2 rounded-full text-sm font-medium mb-8">
              <Zap className="w-4 h-4 text-yellow-400" />
              <span>Turn Your Expertise Into Always-On Income</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight drop-shadow-lg">
              Turn Your Expertise
              <br />
              Into <Highlight className="text-black">Always-On Income</Highlight>
            </h1>
            
            <p className="text-xl text-neutral-200 mb-12 max-w-3xl mx-auto leading-relaxed drop-shadow-md">
              Create an AI replica of yourself that engages fans 24/7 while you focus on creating amazing content. Scale your expertise without burnout and earn while you sleep.
            </p>
            
            <div className="flex justify-center">
              <Link href="/auth/signin?userType=creator">
                <Button className="px-8 py-4 text-lg bg-white text-black hover:bg-neutral-200 shadow-lg">
                  Create Your AI Twin
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Trusted By Section */}
      <div className="bg-black py-20 border-t border-neutral-800">
        <div className="container mx-auto px-6 max-w-6xl">
          <p className="text-center text-neutral-500 text-sm mb-12 uppercase tracking-wider">TRUSTED BY CREATORS FROM</p>
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12 text-neutral-400">
            <div className="text-xl md:text-2xl font-bold">YouTube</div>
            <div className="text-xl md:text-2xl font-bold">Twitch</div>
            <div className="text-xl md:text-2xl font-bold">TikTok</div>
            <div className="text-xl md:text-2xl font-bold">Instagram</div>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="bg-black py-20">
        <div className="container mx-auto px-6 max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Scale Your Impact <span className="text-yellow-400">Without Limits</span>
            </h2>
            <p className="text-neutral-400 text-lg">Your AI replica never sleeps, never burns out</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 md:gap-12">
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-bold text-white mb-3">24/7</div>
              <div className="text-neutral-400 text-lg">AI Availability</div>
            </div>
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-bold text-white mb-3">∞</div>
              <div className="text-neutral-400 text-lg">Conversations Possible</div>
            </div>
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-bold text-white mb-3">0</div>
              <div className="text-neutral-400 text-lg">Burnout Risk</div>
            </div>
          </div>
        </div>
      </div>
          
      {/* Bento Grid Features */}
      <div id="features" className="bg-black py-20">
        <div className="container mx-auto px-6 max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Everything you need to scale your expertise
            </h2>
            <p className="text-neutral-400 text-lg">Engage fans authentically while you focus on creating</p>
          </div>
          
          <BentoGrid className="mx-auto">
            <BentoGridItem
              title="💰 Always-On Engagement"
              description="Your AI replica engages fans 24/7, turning every conversation into potential revenue. No additional content creation required."
              header={
                <div className="flex flex-1 w-full h-full min-h-[12rem] rounded-xl bg-gradient-to-br from-green-900 to-green-700 relative overflow-hidden p-6">
                  <div className="absolute inset-0 flex items-center justify-center opacity-20">
                    <DollarSign className="w-24 h-24 text-green-200" />
                  </div>
                  <div className="relative z-10 flex flex-col justify-between h-full">
                    <div className="flex items-center space-x-2 mb-4">
                      <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                      <span className="text-green-300 text-sm">Live earnings</span>
                    </div>
                    <div className="space-y-2">
                      <div className="text-green-100 text-3xl font-bold">$XXX</div>
                      <div className="text-green-300 text-sm">Potential earnings</div>
                      <div className="text-xs text-green-400">Revenue varies by creator</div>
                    </div>
                  </div>
                </div>
              }
              className="md:col-span-2"
            />
            
            <BentoGridItem
              title="⚡ Lightning Setup"
              description="From YouTube channel to AI replica in under 5 minutes. Zero technical knowledge required."
              header={
                <div className="flex flex-1 w-full h-full min-h-[12rem] rounded-xl bg-gradient-to-br from-yellow-900 to-yellow-700 relative overflow-hidden p-6">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Zap className="w-16 h-16 text-yellow-200 animate-pulse" />
                  </div>
                  <div className="absolute bottom-4 left-4">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                      <div className="w-4 h-2 bg-yellow-400 rounded-full"></div>
                      <div className="w-6 h-2 bg-yellow-400 rounded-full"></div>
                    </div>
                    <div className="text-yellow-200 text-sm mt-2">Setup progress</div>
                  </div>
                </div>
              }
            />
            
            <BentoGridItem
              title="🤖 Your Digital Twin"
              description="Powered by GPT-4, trained on your content to think and respond authentically like you"
              header={
                <div className="flex flex-1 w-full h-full min-h-[12rem] rounded-xl bg-gradient-to-br from-blue-900 to-blue-700 relative overflow-hidden p-6">
                  <div className="absolute inset-0 flex items-center justify-center opacity-30">
                    <Bot className="w-20 h-20 text-blue-200" />
                  </div>
                  <div className="relative z-10 space-y-3">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 rounded-full bg-blue-400 flex items-center justify-center">
                        <span className="text-xs font-bold">AI</span>
                      </div>
                      <div className="bg-blue-800/50 rounded-lg px-3 py-1">
                        <div className="text-blue-200 text-xs">Processing your style...</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      <div className="h-1 bg-blue-400 rounded"></div>
                      <div className="h-1 bg-blue-400 rounded"></div>
                      <div className="h-1 bg-blue-500/50 rounded"></div>
                    </div>
                  </div>
                </div>
              }
            />
            
            <BentoGridItem
              title="👥 Scale Without Burnout"
              description="Connect with fans worldwide while you focus on creating. Your AI replica handles the conversations."
              header={
                <div className="flex flex-1 w-full h-full min-h-[12rem] rounded-xl bg-gradient-to-br from-purple-900 to-purple-700 relative overflow-hidden p-6">
                  <div className="absolute inset-0 flex items-center justify-center opacity-20">
                    <Users className="w-24 h-24 text-purple-200" />
                  </div>
                  <div className="relative z-10 flex flex-col justify-between h-full">
                    <div className="flex items-center justify-between">
                      <div className="flex -space-x-2">
                        <div className="w-8 h-8 rounded-full bg-purple-400 border-2 border-purple-700"></div>
                        <div className="w-8 h-8 rounded-full bg-pink-400 border-2 border-purple-700"></div>
                        <div className="w-8 h-8 rounded-full bg-indigo-400 border-2 border-purple-700"></div>
                        <div className="w-8 h-8 rounded-full bg-purple-600 border-2 border-purple-700 flex items-center justify-center">
                          <span className="text-xs text-purple-200">+∞</span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-1">
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                        <span className="text-purple-300 text-xs">Online now</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-purple-100 text-lg font-bold">24/7 Active</div>
                      <div className="text-purple-300 text-sm">Never miss a conversation</div>
                    </div>
                  </div>
                </div>
              }
              className="md:col-span-2"
            />
          </BentoGrid>
        </div>
      </div>

      {/* How It Works */}
      <div id="product" className="bg-neutral-950 py-20">
        <div className="container mx-auto px-6 max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              From Creator to AI-Powered Expert in Minutes
            </h2>
            <p className="text-neutral-400 text-lg">Simple setup, unlimited reach</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 md:gap-12 mb-20">
            <div className="text-center group">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
                <span className="text-2xl font-bold text-white">1</span>
              </div>
              <h3 className="text-xl font-semibold text-white mb-4">Connect Your Content</h3>
              <p className="text-neutral-400 leading-relaxed">
                Link your YouTube channel and we'll instantly process your videos to understand your unique expertise and communication style.
              </p>
            </div>

            <div className="text-center group">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-purple-800 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
                <span className="text-2xl font-bold text-white">2</span>
              </div>
              <h3 className="text-xl font-semibold text-white mb-4">AI Training</h3>
              <p className="text-neutral-400 leading-relaxed">
                Our AI creates an authentic digital twin that captures your expertise, personality, and communication style.
              </p>
            </div>

            <div className="text-center group">
              <div className="w-16 h-16 bg-gradient-to-br from-green-600 to-green-800 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
                <span className="text-2xl font-bold text-white">3</span>
              </div>
              <h3 className="text-xl font-semibold text-white mb-4">Launch & Scale</h3>
              <p className="text-neutral-400 leading-relaxed">
                Share your AI replica with fans and watch your expertise reach unlimited people, 24/7.
              </p>
            </div>
          </div>

          {/* CTA Section */}
          <div id="pricing" className="text-center">
            <div className="bg-gradient-to-r from-neutral-900 to-neutral-800 rounded-2xl p-8 md:p-12 border border-neutral-700">
              <h3 className="text-2xl md:text-3xl font-bold text-white mb-4">
                Ready to scale your expertise without limits?
              </h3>
              <p className="text-neutral-400 text-lg mb-8 max-w-2xl mx-auto">
                Join creators who are engaging fans 24/7 while focusing on what they love most - creating.
              </p>
              <div className="flex justify-center mb-8">
                <Link href="/auth/signin?userType=creator">
                  <Button className="px-8 py-4 text-lg bg-white text-black hover:bg-neutral-200 shadow-lg">
                    Create Your AI Twin
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
              </div>
              
              <div className="flex flex-wrap items-center justify-center gap-4 md:gap-8 text-sm text-neutral-500">
                <div className="flex items-center gap-2">
                  <span>✓</span>
                  <span>No credit card required</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>✓</span>
                  <span>5-minute setup</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>✓</span>
                  <span>Unlimited fan engagement</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}