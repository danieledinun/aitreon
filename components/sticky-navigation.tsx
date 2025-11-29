'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'

export default function StickyNavigation() {
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY
      setIsScrolled(scrollY > 100)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ease-in-out ${
      isScrolled
        ? 'py-3 backdrop-blur-md bg-tandym-midnight/80 border-b border-tandym-cobalt/20'
        : 'py-6 backdrop-blur-sm bg-tandym-midnight/30'
    }`}>
      <div className={`transition-all duration-300 ease-in-out ${
        isScrolled
          ? 'max-w-7xl mx-auto px-6 flex justify-between items-center'
          : 'container mx-auto px-6 flex justify-between items-center'
      }`}>
        <Link href="/" className="flex items-center space-x-2 group">
          <div className={`bg-gradient-to-br from-tandym-cobalt to-tandym-lilac rounded-xl flex items-center justify-center transition-all duration-300 ${
            isScrolled ? 'w-6 h-6' : 'w-8 h-8'
          }`}>
            <Sparkles className={`text-white transition-all duration-300 ${
              isScrolled ? 'w-3 h-3' : 'w-5 h-5'
            }`} />
          </div>
          <h1 className={`font-bold font-poppins bg-gradient-to-r from-tandym-cobalt via-tandym-lilac to-tandym-coral bg-clip-text text-transparent transition-all duration-300 ${
            isScrolled ? 'text-xl' : 'text-2xl'
          }`}>Tandym.ai</h1>
        </Link>

        {/* Center navigation links - always visible */}
        <div className="hidden md:flex items-center space-x-8 text-sm font-medium">
          <Link href="#features" className="text-gray-300 hover:text-tandym-lilac transition-colors">
            Features
          </Link>
          <Link href="#how-it-works" className="text-gray-300 hover:text-tandym-lilac transition-colors">
            How It Works
          </Link>
          <Link href="#benefits" className="text-gray-300 hover:text-tandym-lilac transition-colors">
            Benefits
          </Link>
          <Link href="/pricing" className="text-gray-300 hover:text-tandym-lilac transition-colors">
            Pricing
          </Link>
        </div>

        <div className="flex items-center space-x-4">
          <Link href="/auth/signin">
            <Button
              variant="outline"
              className={`border-tandym-cobalt/50 text-tandym-lilac hover:bg-tandym-cobalt/10 hover:border-tandym-cobalt backdrop-blur-sm transition-all duration-300 rounded-full ${
                isScrolled ? 'text-xs px-4 py-2' : 'text-sm'
              }`}
            >
              Sign In
            </Button>
          </Link>
          <Link href="/auth/signin?userType=creator">
            <Button
              className={`bg-tandym-cobalt hover:bg-tandym-cobalt/90 text-white rounded-full shadow-lg shadow-tandym-cobalt/30 transition-all duration-300 ${
                isScrolled ? 'text-xs px-4 py-2' : 'text-sm px-6 py-2'
              }`}
            >
              Create My Twin
            </Button>
          </Link>
        </div>
      </div>
    </nav>
  )
}