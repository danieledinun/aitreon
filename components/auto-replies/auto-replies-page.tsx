'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SettingsForm } from './settings-form'
import { RecentRepliesFeed } from './recent-replies-feed'
import { AnalyticsCard } from './analytics-card'

interface AutoRepliesPageProps {
  creatorId: string
}

export default function AutoRepliesPage({ creatorId }: AutoRepliesPageProps) {
  const [activeTab, setActiveTab] = useState('settings')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-poppins text-gray-900 dark:text-white">
          Auto-Replies
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Let your AI twin automatically reply to YouTube comments.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="replies">Recent Replies</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="mt-6">
          <SettingsForm creatorId={creatorId} />
        </TabsContent>

        <TabsContent value="replies" className="mt-6">
          <RecentRepliesFeed creatorId={creatorId} />
        </TabsContent>

        <TabsContent value="analytics" className="mt-6">
          <AnalyticsCard creatorId={creatorId} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
