'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { 
  Sidebar, 
  SidebarBody, 
  SidebarLink 
} from '@/components/ui/sidebar'
import { 
  IconDashboard,
  IconSettings,
  IconUser,
  IconMessageCircle,
  IconVideo,
  IconBolt,
  IconChartBar,
  IconUsers,
  IconQuestionMark,
  IconBrain,
  IconLogout,
  IconDatabase
} from '@tabler/icons-react'
import { Sparkles, Bot, Volume2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { signOut, useSession } from 'next-auth/react'

export default function CreatorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { data: session } = useSession()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const links = [
    {
      label: "Dashboard",
      href: "/creator",
      icon: (
        <IconDashboard className="text-neutral-700 dark:text-neutral-200 h-5 w-5 shrink-0" />
      ),
    },
    {
      label: "Knowledge Base",
      href: "/creator/knowledge",
      icon: (
        <IconDatabase className="text-neutral-700 dark:text-neutral-200 h-5 w-5 shrink-0" />
      ),
    },
    {
      label: "AI Settings", 
      href: "/creator/ai-config",
      icon: (
        <IconBrain className="text-neutral-700 dark:text-neutral-200 h-5 w-5 shrink-0" />
      ),
    },
    {
      label: "Voice Settings",
      href: "/creator/voice-settings",
      icon: (
        <Volume2 className="text-neutral-700 dark:text-neutral-200 h-5 w-5 shrink-0" />
      ),
    },
    {
      label: "Suggested Questions",
      href: "/creator/suggested-questions",
      icon: (
        <IconQuestionMark className="text-neutral-700 dark:text-neutral-200 h-5 w-5 shrink-0" />
      ),
    },
  ]

  const handleLogout = async () => {
    await signOut({ callbackUrl: '/' })
  }

  return (
    <div className={cn(
      "rounded-md flex flex-col md:flex-row bg-gray-100 dark:bg-neutral-800 w-full flex-1 max-w-7xl mx-auto border border-neutral-200 dark:border-neutral-700 overflow-hidden",
      "h-screen" 
    )}>
      <Sidebar open={open} setOpen={setOpen}>
        <SidebarBody className="justify-between gap-6">
          <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
            <div className="mb-8">
              {open ? <Logo /> : <LogoIcon />}
            </div>
            <nav className="flex flex-col gap-1">
              {links.map((link, idx) => (
                <SidebarLink key={idx} link={link} />
              ))}
            </nav>
          </div>
          
          {/* User section */}
          <div className="flex flex-col gap-2 mt-4">
            <div className={cn(
              "flex items-center gap-3 p-3 rounded-lg border border-gray-300 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900/50",
              !open && "justify-center p-2"
            )}>
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className="bg-gradient-to-br from-purple-600 to-blue-600 text-white text-xs font-bold">
                  {session?.user?.name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              {open && (
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {session?.user?.name || 'Creator'}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-neutral-400 truncate">
                    {session?.user?.email}
                  </div>
                </div>
              )}
            </div>
            
            <Button
              onClick={handleLogout}
              variant="ghost"
              className={cn(
                "gap-3 text-gray-700 dark:text-neutral-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-neutral-800 p-3",
                open ? "justify-start" : "justify-center p-2"
              )}
            >
              <IconLogout className="h-4 w-4 shrink-0" />
              {open && <span className="text-sm">Sign Out</span>}
            </Button>
          </div>
        </SidebarBody>
      </Sidebar>
      
      <main className="flex-1 overflow-auto">
        <div className="p-4 md:p-10 rounded-tl-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 flex flex-col gap-2 flex-1 w-full h-full">
          {children}
        </div>
      </main>
    </div>
  )
}

export const Logo = () => {
  return (
    <Link
      href="/creator"
      className="font-normal flex items-center gap-3 text-sm text-gray-900 dark:text-white py-3 px-1 relative z-20"
    >
      <div className="h-6 w-6 bg-gradient-to-br from-orange-500 to-orange-600 dark:from-orange-400 dark:to-orange-500 rounded-lg flex-shrink-0 shadow-sm" />
      <span className="font-semibold text-gray-900 dark:text-white whitespace-nowrap">
        Aitrion Creator
      </span>
    </Link>
  )
}

export const LogoIcon = () => {
  return (
    <div className="flex items-center justify-center py-3 px-2">
      <Link
        href="/creator"
        className="font-normal flex items-center justify-center relative z-20"
      >
        <div className="h-8 w-8 bg-gradient-to-br from-orange-500 to-orange-600 dark:from-orange-400 dark:to-orange-500 rounded-lg flex-shrink-0 shadow-sm" />
      </Link>
    </div>
  )
}