'use client'

import { Users, DollarSign, TrendingUp, Activity } from 'lucide-react'
import Image from 'next/image'

interface AdminDashboardProps {
  metrics: {
    totalCreators: number
    activeCreators: number
    totalSubscriptions: number
    activeSubscriptions: number
    totalRevenue: number
  }
  recentCreators: Array<{
    id: string
    username: string
    displayName: string
    profileImage?: string | null
    createdAt: Date
    _count: { subscriptions: number }
  }>
  topCreators: Array<{
    id: string
    username: string
    displayName: string
    profileImage?: string | null
    _count: { subscriptions: number }
  }>
  recentSubscriptions: Array<{
    id: string
    createdAt: Date
    status: string
    user: { name?: string | null; email: string }
    creator: { displayName: string; username: string }
  }>
}

export default function AdminDashboard({
  metrics,
  recentCreators,
  topCreators,
  recentSubscriptions
}: AdminDashboardProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  const StatCard = ({ 
    title, 
    value, 
    icon: Icon, 
    color = 'primary' 
  }: { 
    title: string
    value: string | number
    icon: any
    color?: string
  }) => (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
        <div className={`p-3 rounded-full bg-${color}-100`}>
          <Icon className={`w-6 h-6 text-${color}-600`} />
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-4">
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600">Platform overview and metrics</p>
        </div>
      </div>

      <div className="p-6">
        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Total Creators"
            value={metrics.totalCreators}
            icon={Users}
            color="blue"
          />
          <StatCard
            title="Active Creators"
            value={metrics.activeCreators}
            icon={Activity}
            color="green"
          />
          <StatCard
            title="Active Subscriptions"
            value={metrics.activeSubscriptions}
            icon={TrendingUp}
            color="purple"
          />
          <StatCard
            title="Monthly Revenue"
            value={formatCurrency(metrics.totalRevenue)}
            icon={DollarSign}
            color="yellow"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Creators */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Recent Creators</h2>
            </div>
            <div className="p-6">
              <div className="space-y-3">
                {recentCreators.map((creator) => (
                  <div key={creator.id} className="flex items-center space-x-4">
                    <div className="relative w-10 h-10 flex-shrink-0">
                      <Image
                        src={creator.profileImage || '/default-avatar.png'}
                        alt={creator.displayName}
                        fill
                        className="rounded-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate" title={creator.displayName}>
                        {creator.displayName}
                      </p>
                      <p className="text-sm text-gray-500 truncate" title={creator.username}>@{creator.username}</p>
                    </div>
                    <div className="text-sm text-gray-500 flex-shrink-0">
                      {creator._count.subscriptions} subs
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Top Creators */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Top Creators</h2>
            </div>
            <div className="p-6">
              <div className="space-y-3">
                {topCreators.map((creator, index) => (
                  <div key={creator.id} className="flex items-center space-x-4">
                    <div className="flex-shrink-0 w-6 text-center">
                      <span className="text-sm font-medium text-gray-500">
                        #{index + 1}
                      </span>
                    </div>
                    <div className="relative w-10 h-10 flex-shrink-0">
                      <Image
                        src={creator.profileImage || '/default-avatar.png'}
                        alt={creator.displayName}
                        fill
                        className="rounded-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate" title={creator.displayName}>
                        {creator.displayName}
                      </p>
                      <p className="text-sm text-gray-500 truncate" title={creator.username}>@{creator.username}</p>
                    </div>
                    <div className="text-sm font-medium text-gray-900 flex-shrink-0">
                      {creator._count.subscriptions}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Recent Subscriptions */}
        <div className="mt-8 bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Recent Subscriptions</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Creator
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {recentSubscriptions.map((subscription) => (
                  <tr key={subscription.id}>
                    <td className="px-6 py-4">
                      <div className="max-w-[200px]">
                        <div className="text-sm font-medium text-gray-900 truncate" title={subscription.user.name || 'Anonymous'}>
                          {subscription.user.name || 'Anonymous'}
                        </div>
                        <div className="text-sm text-gray-500 truncate" title={subscription.user.email}>
                          {subscription.user.email}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="max-w-[200px]">
                        <div className="text-sm font-medium text-gray-900 truncate" title={subscription.creator.displayName}>
                          {subscription.creator.displayName}
                        </div>
                        <div className="text-sm text-gray-500 truncate" title={subscription.creator.username}>
                          @{subscription.creator.username}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        subscription.status === 'ACTIVE' 
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {subscription.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(subscription.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}