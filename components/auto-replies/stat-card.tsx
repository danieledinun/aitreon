'use client'

import { Card, CardContent } from '@/components/ui/card'
import { LucideIcon } from 'lucide-react'

interface StatCardProps {
  icon: LucideIcon
  label: string
  count: number
  gradient: string
  iconColor: string
}

export function StatCard({ icon: Icon, label, count, gradient, iconColor }: StatCardProps) {
  return (
    <Card className={`bg-gradient-to-br ${gradient} border-0 shadow-sm`}>
      <CardContent className="p-5">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-white/60 dark:bg-neutral-800/60">
            <Icon className={`h-5 w-5 ${iconColor}`} />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              {label}
            </p>
            <p className="text-2xl font-bold font-poppins text-gray-900 dark:text-white">
              {count}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
