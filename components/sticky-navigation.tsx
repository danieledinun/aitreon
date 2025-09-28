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
        ? 'py-3 backdrop-blur-md bg-black/80 border-b border-neutral-800/50' 
        : 'py-6 backdrop-blur-sm bg-black/30'
    }`}>
      <div className={`transition-all duration-300 ease-in-out ${
        isScrolled 
          ? 'max-w-4xl mx-auto px-6 flex justify-between items-center' 
          : 'px-6 flex justify-between items-center'
      }`}>
        <div className="flex items-center space-x-2">
          <div className={`bg-white rounded-xl flex items-center justify-center transition-all duration-300 ${
            isScrolled ? 'w-6 h-6' : 'w-8 h-8'
          }`}>
            <Sparkles className={`text-black transition-all duration-300 ${
              isScrolled ? 'w-3 h-3' : 'w-5 h-5'
            }`} />
          </div>
          <h1 className={`font-bold text-white transition-all duration-300 ${
            isScrolled ? 'text-xl' : 'text-2xl'
          }`}>Aitrion</h1>
        </div>
        
        {/* Center navigation links - always visible */}
        <div className="hidden md:flex items-center space-x-6 text-sm">
          <Link href="#product" className="text-neutral-300 hover:text-white transition-colors">
            Product
          </Link>
          <Link href="#features" className="text-neutral-300 hover:text-white transition-colors">
            Features
          </Link>
          <Link href="#pricing" className="text-neutral-300 hover:text-white transition-colors">
            Pricing
          </Link>
        </div>

        <div className="flex items-center space-x-4">
          <Link href="/auth/signin">
            <Button 
              variant="outline" 
              className={`border-neutral-700 text-neutral-300 hover:bg-neutral-800/50 backdrop-blur-sm transition-all duration-300 ${
                isScrolled ? 'text-xs px-4 py-2' : 'text-sm'
              }`}
            >
              Sign In
            </Button>
          </Link>
          <Link href="/auth/signup">
            <Button 
              className={`bg-white text-black hover:bg-neutral-200 transition-all duration-300 ${
                isScrolled ? 'text-xs px-4 py-2' : 'text-sm'
              }`}
            >
              Get Started
            </Button>
          </Link>
        </div>
      </div>
    </nav>
  )
}