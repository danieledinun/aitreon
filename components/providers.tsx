'use client'

import { SessionProvider } from 'next-auth/react'
import { SyncProvider } from '@/contexts/SyncContext'
import { GlobalSyncProgress } from '@/components/ui/global-sync-progress'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SyncProvider>
        {children}
        <GlobalSyncProgress />
      </SyncProvider>
    </SessionProvider>
  )
}