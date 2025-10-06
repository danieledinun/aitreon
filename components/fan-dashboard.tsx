'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, MessageCircle, Play, Star, Users, Video, Filter, Grid, List, Heart, Clock, TrendingUp, Bookmark, Eye, Crown } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import { FocusCards } from '@/components/ui/focus-cards'

interface Creator {
  id: string
  display_name: string
  bio?: string
  avatar_url?: string
  youtube_channel_url?: string
  verification_status?: string
  subscriber_count?: number
  video_count?: number
  category?: string
  created_at: string
  user_id: string
  profile_image?: string
  username?: string
  is_active?: boolean
  subscription_date?: string
}

interface FanDashboardProps {
  userId: string
}

export default function FanDashboard({ userId }: FanDashboardProps) {
  const { data: session } = useSession()
  const [creators, setCreators] = useState<Creator[]>([])
  const [filteredCreators, setFilteredCreators] = useState<Creator[]>([])
  const [recentlyVisited, setRecentlyVisited] = useState<Creator[]>([])
  const [subscribed, setSubscribed] = useState<Creator[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [sortBy, setSortBy] = useState('popularity')
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('discover')

  const categories = [
    { value: 'all', label: 'All Categories' },
    { value: 'fitness', label: 'Fitness & Health' },
    { value: 'gaming', label: 'Gaming' },
    { value: 'tech', label: 'Technology' },
    { value: 'lifestyle', label: 'Lifestyle' },
    { value: 'education', label: 'Education' },
    { value: 'entertainment', label: 'Entertainment' },
    { value: 'music', label: 'Music' },
    { value: 'cooking', label: 'Cooking' },
    { value: 'business', label: 'Business' }
  ]

  const sortOptions = [
    { value: 'popularity', label: 'Most Popular' },
    { value: 'newest', label: 'Newest First' },
    { value: 'alphabetical', label: 'A-Z' },
    { value: 'subscribers', label: 'Most Followers' }
  ]

  useEffect(() => {
    fetchCreators()
    fetchRecentlyVisited()
    fetchSubscribed()
  }, [])

  useEffect(() => {
    filterCreators()
  }, [searchQuery, selectedCategory, sortBy, creators])

  const fetchCreators = async () => {
    try {
      const { data, error } = await supabase
        .from('creators')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (error) throw error
      setCreators(data || [])
    } catch (error) {
      console.error('Error fetching creators:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchRecentlyVisited = async () => {
    try {
      // For now, get recently visited from localStorage
      const recentVisits = JSON.parse(localStorage.getItem('recentlyVisited') || '[]')
      const recentCreatorIds = recentVisits.slice(0, 6) // Last 6 visited

      if (recentCreatorIds.length > 0 && creators.length > 0) {
        const recentCreators = creators.filter(creator =>
          recentCreatorIds.includes(creator.id)
        )
        setRecentlyVisited(recentCreators)
      } else {
        // Mock some recent data if none exists
        const mockRecent = creators.slice(0, 3)
        setRecentlyVisited(mockRecent)
      }
    } catch (error) {
      console.error('Error fetching recently visited:', error)
      // Fallback to mock data
      const mockRecent = creators.slice(0, 3)
      setRecentlyVisited(mockRecent)
    }
  }

  const fetchSubscribed = async () => {
    try {
      // Fetch real subscriptions from database
      const { data: subscriptions, error } = await supabase
        .from('subscriptions')
        .select(`
          creator_id,
          created_at,
          status,
          creators (
            id,
            display_name,
            bio,
            profile_image,
            youtube_channel_url,
            verification_status,
            subscriber_count,
            video_count,
            is_active,
            user_id,
            username,
            created_at
          )
        `)
        .eq('user_id', userId)
        .eq('status', 'active')

      if (error) {
        console.error('Error fetching subscriptions:', error)
        setSubscribed([])
        return
      }

      if (subscriptions && subscriptions.length > 0) {
        // Extract creator data from subscriptions and ensure proper typing
        const subscribedCreators = subscriptions
          .filter(sub => sub.creators)
          .map(sub => {
            const creator = sub.creators as any // Supabase relation typing
            return {
              id: creator.id,
              display_name: creator.display_name,
              bio: creator.bio,
              profile_image: creator.profile_image,
              youtube_channel_url: creator.youtube_channel_url,
              verification_status: creator.verification_status,
              subscriber_count: creator.subscriber_count,
              video_count: creator.video_count,
              is_active: creator.is_active,
              user_id: creator.user_id,
              username: creator.username,
              created_at: creator.created_at,
              category: undefined,
              avatar_url: creator.profile_image,
              subscription_date: sub.created_at
            } as Creator
          })
        setSubscribed(subscribedCreators)
      } else {
        setSubscribed([])
      }
    } catch (error) {
      console.error('Error fetching subscribed creators:', error)
      setSubscribed([])
    }
  }

  const handleVisitCreator = (creatorId: string) => {
    try {
      const recentVisits = JSON.parse(localStorage.getItem('recentlyVisited') || '[]')
      const updatedVisits = [creatorId, ...recentVisits.filter((id: string) => id !== creatorId)].slice(0, 10)
      localStorage.setItem('recentlyVisited', JSON.stringify(updatedVisits))
      fetchRecentlyVisited()
    } catch (error) {
      console.error('Error updating recent visits:', error)
    }
  }

  const handleFollowCreator = async (creatorId: string) => {
    try {
      const isFollowed = subscribed.some(creator => creator.id === creatorId)

      if (isFollowed) {
        // Unfollow - delete subscription
        const { error } = await supabase
          .from('subscriptions')
          .delete()
          .eq('user_id', userId)
          .eq('creator_id', creatorId)

        if (error) {
          console.error('Error unfollowing creator:', error)
          return
        }
      } else {
        // Follow - create subscription
        const { error } = await supabase
          .from('subscriptions')
          .insert({
            user_id: userId,
            creator_id: creatorId,
            status: 'active',
            tier: 'free'
          })

        if (error) {
          console.error('Error following creator:', error)
          return
        }
      }

      // Refresh the subscriptions data
      await fetchSubscribed()
    } catch (error) {
      console.error('Error updating subscription:', error)
    }
  }

  const isCreatorFollowed = (creatorId: string) => {
    return subscribed.some(creator => creator.id === creatorId)
  }

  const filterCreators = () => {
    let filtered = creators

    if (searchQuery) {
      filtered = filtered.filter(creator =>
        creator.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        creator.bio?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(creator => creator.category === selectedCategory)
    }

    // Sort creators
    switch (sortBy) {
      case 'newest':
        filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        break
      case 'alphabetical':
        filtered.sort((a, b) => a.display_name.localeCompare(b.display_name))
        break
      case 'subscribers':
        filtered.sort((a, b) => (b.subscriber_count || 0) - (a.subscriber_count || 0))
        break
      default: // popularity
        filtered.sort((a, b) => (b.subscriber_count || 0) - (a.subscriber_count || 0))
    }

    setFilteredCreators(filtered)
  }

  const formatSubscriberCount = (count: number) => {
    if (count >= 1000000) {
      return (count / 1000000).toFixed(1) + 'M'
    } else if (count >= 1000) {
      return (count / 1000).toFixed(1) + 'K'
    }
    return count.toString()
  }

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      {/* Modern Header */}
      <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200/50 dark:border-gray-700/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-6">
              <Link href="/" className="flex items-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 shadow-lg">
                  <Crown className="h-6 w-6 text-white" />
                </div>
                <span className="ml-3 text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Aitrion</span>
              </Link>

              {/* Navigation Pills */}
              <nav className="hidden md:flex items-center space-x-1">
                <Button
                  variant={activeTab === 'discover' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setActiveTab('discover')}
                  className="rounded-full"
                >
                  Discover
                </Button>
                <Button
                  variant={activeTab === 'following' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setActiveTab('following')}
                  className="rounded-full"
                >
                  Following
                </Button>
                <Button
                  variant={activeTab === 'recent' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setActiveTab('recent')}
                  className="rounded-full"
                >
                  Recent
                </Button>
              </nav>
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <Avatar className="h-9 w-9 ring-2 ring-blue-500/20">
                  <AvatarImage src={session?.user?.image || undefined} />
                  <AvatarFallback className="bg-gradient-to-r from-blue-500 to-purple-500 text-white">{getInitials(session?.user?.name || 'User')}</AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 hidden sm:block">
                  {session?.user?.name}
                </span>
              </div>
              <Button variant="outline" onClick={() => signOut()} className="rounded-full">
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Welcome Section */}
        <div className="mb-8">
          <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 rounded-2xl p-8 text-white relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.1%22%3E%3Ccircle%20cx%3D%2230%22%20cy%3D%2230%22%20r%3D%223%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-20"></div>
            <div className="relative z-10">
              <h1 className="text-4xl font-bold mb-3">
                Welcome back, {session?.user?.name?.split(' ')[0]}! ✨
              </h1>
              <p className="text-xl text-blue-100 mb-6">
                Discover and chat with AI versions of your favorite creators
              </p>
              <div className="flex items-center space-x-6 text-sm">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                    <Users className="h-4 w-4" />
                  </div>
                  <span>{creators.length} Creators Available</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                    <MessageCircle className="h-4 w-4" />
                  </div>
                  <span>Unlimited Conversations</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-8">
          <div className="flex flex-col lg:flex-row gap-6 items-start">
            <TabsList className="grid w-full lg:w-auto grid-cols-3 lg:grid-cols-1 lg:flex-col h-auto p-1">
              <TabsTrigger value="discover" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                <Search className="h-4 w-4 mr-2" />
                Discover
              </TabsTrigger>
              <TabsTrigger value="following" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                <Heart className="h-4 w-4 mr-2" />
                Following
              </TabsTrigger>
              <TabsTrigger value="recent" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                <Clock className="h-4 w-4 mr-2" />
                Recent
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 w-full">

              {/* Discover Tab */}
              <TabsContent value="discover" className="space-y-6 mt-0">
                {/* Search and Filters */}
                <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-xl border border-gray-200/50 dark:border-gray-700/50 p-6">
                  <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
                    <div className="flex-1 max-w-md">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                        <Input
                          placeholder="Search creators by name or bio..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10 bg-white/50 border-gray-200/50 focus:bg-white transition-colors"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                        <SelectTrigger className="w-40">
                          <SelectValue placeholder="Category" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map(category => (
                            <SelectItem key={category.value} value={category.value}>
                              {category.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select value={sortBy} onValueChange={setSortBy}>
                        <SelectTrigger className="w-40">
                          <SelectValue placeholder="Sort by" />
                        </SelectTrigger>
                        <SelectContent>
                          {sortOptions.map(option => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Creators Grid */}
                {loading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {[...Array(8)].map((_, i) => (
                      <Card key={i} className="animate-pulse bg-white/70 backdrop-blur-sm">
                        <CardHeader>
                          <div className="flex items-center space-x-4">
                            <div className="w-14 h-14 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                            <div className="space-y-2 flex-1">
                              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
                            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : filteredCreators.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="w-32 h-32 mx-auto bg-gradient-to-br from-blue-100 to-purple-100 dark:from-gray-800 dark:to-gray-700 rounded-full flex items-center justify-center mb-6">
                      <Search className="h-16 w-16 text-gray-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                      No creators found
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
                      Try adjusting your search criteria or browse all creators to discover amazing content
                    </p>
                  </div>
                ) : (
                  <FocusCards
                    creators={filteredCreators}
                    onStartChat={handleVisitCreator}
                    onToggleFollow={handleFollowCreator}
                    isFollowed={isCreatorFollowed}
                  />
                )}
              </TabsContent>
              {/* Following Tab - Stunning Redesign */}
              <TabsContent value="following" className="space-y-8 mt-0">
                {subscribed.length === 0 ? (
                  <div className="relative text-center py-20">
                    {/* Animated background pattern */}
                    <div className="absolute inset-0 overflow-hidden">
                      <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-pink-400/20 to-purple-400/20 rounded-full blur-3xl animate-pulse"></div>
                      <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-blue-400/20 to-indigo-400/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
                    </div>

                    <div className="relative z-10">
                      {/* Floating hearts animation */}
                      <div className="relative w-40 h-40 mx-auto mb-8">
                        <div className="absolute inset-0 bg-gradient-to-br from-pink-100 via-purple-100 to-indigo-100 dark:from-gray-700 dark:to-gray-600 rounded-full flex items-center justify-center shadow-2xl">
                          <Heart className="h-20 w-20 text-pink-500 animate-pulse" />
                        </div>
                        {/* Floating mini hearts */}
                        <div className="absolute -top-2 -right-2 w-8 h-8 bg-pink-400 rounded-full flex items-center justify-center animate-bounce delay-300">
                          <Heart className="h-4 w-4 text-white fill-current" />
                        </div>
                        <div className="absolute -bottom-2 -left-2 w-6 h-6 bg-purple-400 rounded-full flex items-center justify-center animate-bounce delay-700">
                          <Heart className="h-3 w-3 text-white fill-current" />
                        </div>
                        <div className="absolute top-1/2 -left-4 w-5 h-5 bg-indigo-400 rounded-full flex items-center justify-center animate-bounce delay-1000">
                          <Heart className="h-2.5 w-2.5 text-white fill-current" />
                        </div>
                      </div>

                      <h3 className="text-3xl font-bold bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent mb-4">
                        Your Creator Galaxy Awaits
                      </h3>
                      <p className="text-lg text-gray-600 dark:text-gray-400 mb-10 max-w-lg mx-auto leading-relaxed">
                        Start following your favorite creators to unlock exclusive content, personalized interactions, and join their vibrant communities
                      </p>

                      <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                        <Button
                          onClick={() => setActiveTab('discover')}
                          className="group bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 hover:from-pink-600 hover:via-purple-600 hover:to-indigo-600 text-white shadow-2xl hover:shadow-pink-500/25 transition-all duration-500 transform hover:scale-105 px-8 py-3 text-lg"
                        >
                          <Search className="h-5 w-5 mr-3 group-hover:animate-spin" />
                          Discover Amazing Creators
                        </Button>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          ✨ Over 1,000+ creators waiting to connect
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {/* Enhanced Header Section */}
                    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-pink-50 via-purple-50 to-indigo-50 dark:from-gray-800/50 dark:via-gray-700/50 dark:to-gray-800/50 p-8">
                      {/* Background decoration */}
                      <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-pink-200/30 to-purple-200/30 rounded-full blur-3xl -translate-y-32 translate-x-32"></div>

                      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="space-y-2">
                          <h2 className="text-4xl font-bold bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent">
                            Following ({subscribed.length})
                          </h2>
                          <p className="text-lg text-gray-600 dark:text-gray-400">
                            Your curated collection of amazing creators
                          </p>
                          <div className="flex items-center space-x-4 text-sm text-gray-500">
                            <div className="flex items-center space-x-2">
                              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                              <span>{subscribed.length} Active</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Star className="h-4 w-4 text-yellow-500 fill-current" />
                              <span>Premium Content Available</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-3">
                          <Button variant="outline" className="group hover:bg-gradient-to-r hover:from-pink-50 hover:to-purple-50 border-pink-200 hover:border-pink-300">
                            <Filter className="h-4 w-4 mr-2 group-hover:text-pink-600" />
                            Filter
                          </Button>
                          <Button variant="outline" className="group hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 border-blue-200 hover:border-blue-300">
                            <Users className="h-4 w-4 mr-2 group-hover:text-blue-600" />
                            Manage
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Enhanced Creator Cards Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                      {subscribed.map((creator, index) => (
                        <Card key={creator.id} className="group relative overflow-hidden bg-gradient-to-br from-white via-white to-gray-50/50 dark:from-gray-800 dark:via-gray-800 dark:to-gray-900/50 border-0 shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 hover:scale-[1.02]">
                          {/* Animated background glow */}
                          <div className="absolute inset-0 bg-gradient-to-br from-pink-500/10 via-purple-500/10 to-indigo-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

                          {/* Floating badge */}
                          <div className="absolute top-4 right-4 z-20">
                            <div className="bg-gradient-to-r from-pink-500 to-purple-500 text-white text-xs font-semibold px-3 py-1 rounded-full shadow-lg animate-pulse">
                              Following
                            </div>
                          </div>

                          <CardHeader className="pb-6 relative z-10">
                            <div className="flex flex-col items-center text-center space-y-4">
                              {/* Enhanced Avatar with rings */}
                              <div className="relative">
                                <div className="absolute inset-0 bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 rounded-full animate-spin-slow"></div>
                                <div className="absolute inset-1 bg-gradient-to-r from-pink-400 via-purple-400 to-indigo-400 rounded-full animate-pulse"></div>
                                <Avatar className="relative h-20 w-20 ring-4 ring-white dark:ring-gray-800 shadow-xl">
                                  <AvatarImage src={creator.avatar_url || creator.profile_image} className="object-cover" />
                                  <AvatarFallback className="bg-gradient-to-br from-pink-500 to-purple-500 text-white text-2xl font-bold">
                                    {getInitials(creator.display_name)}
                                  </AvatarFallback>
                                </Avatar>
                              </div>

                              {/* Creator info */}
                              <div className="space-y-2">
                                <CardTitle className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
                                  {creator.display_name}
                                </CardTitle>
                                {creator.verification_status === 'verified' && (
                                  <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                    ✓ Verified Creator
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </CardHeader>

                          <CardContent className="pb-6 relative z-10">
                            <div className="space-y-4">
                              {/* Bio */}
                              {creator.bio && (
                                <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3 text-center leading-relaxed">
                                  {creator.bio}
                                </p>
                              )}

                              {/* Real Stats row */}
                              <div className="flex items-center justify-between p-3 bg-gradient-to-r from-gray-50 to-gray-100/50 dark:from-gray-700/50 dark:to-gray-800/50 rounded-xl">
                                {creator.subscriber_count && (
                                  <div className="text-center">
                                    <div className="text-lg font-bold text-pink-600">{formatSubscriberCount(creator.subscriber_count)}</div>
                                    <div className="text-xs text-gray-500">Subscribers</div>
                                  </div>
                                )}
                                {creator.video_count && (
                                  <div className="text-center">
                                    <div className="text-lg font-bold text-purple-600">{creator.video_count}</div>
                                    <div className="text-xs text-gray-500">Videos</div>
                                  </div>
                                )}
                                <div className="text-center">
                                  <div className="text-lg font-bold text-blue-600">{creator.is_active ? 'Active' : 'Inactive'}</div>
                                  <div className="text-xs text-gray-500">Status</div>
                                </div>
                              </div>
                            </div>
                          </CardContent>

                          <CardFooter className="pt-0 pb-6 relative z-10">
                            <div className="w-full space-y-3">
                              {/* Main action button */}
                              <Link href={`/${creator.display_name.toLowerCase()}`} className="block" onClick={() => handleVisitCreator(creator.id)}>
                                <Button className="w-full group bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 hover:from-pink-600 hover:via-purple-600 hover:to-indigo-600 text-white shadow-lg hover:shadow-xl transition-all duration-300 py-3">
                                  <MessageCircle className="h-4 w-4 mr-2 group-hover:animate-bounce" />
                                  Continue Conversation
                                </Button>
                              </Link>

                              {/* Action buttons row */}
                              <div className="flex space-x-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleFollowCreator(creator.id)}
                                  className="flex-1 group hover:bg-pink-50 hover:border-pink-200 dark:hover:bg-pink-900/20"
                                >
                                  <Heart className="h-3 w-3 mr-1 text-pink-500 fill-current group-hover:animate-pulse" />
                                  Following
                                </Button>
                                <Button variant="outline" size="sm" className="flex-1 group hover:bg-blue-50 hover:border-blue-200 dark:hover:bg-blue-900/20">
                                  <Star className="h-3 w-3 mr-1 text-blue-500 group-hover:animate-spin" />
                                  Premium
                                </Button>
                                <Button variant="outline" size="sm" className="group hover:bg-gray-50 hover:border-gray-200 dark:hover:bg-gray-700/50">
                                  <Bookmark className="h-3 w-3 text-gray-500 group-hover:text-gray-700" />
                                </Button>
                              </div>
                            </div>
                          </CardFooter>
                        </Card>
                      ))}
                    </div>

                    {/* Call to action for more creators */}
                    <div className="text-center py-8">
                      <div className="inline-flex items-center space-x-2 text-gray-500 dark:text-gray-400 text-sm mb-4">
                        <div className="w-8 h-0.5 bg-gradient-to-r from-transparent to-gray-300"></div>
                        <span>Discover more amazing creators</span>
                        <div className="w-8 h-0.5 bg-gradient-to-l from-transparent to-gray-300"></div>
                      </div>
                      <Button
                        onClick={() => setActiveTab('discover')}
                        variant="outline"
                        className="group hover:bg-gradient-to-r hover:from-pink-50 hover:to-purple-50 border-pink-200 hover:border-pink-300"
                      >
                        <Search className="h-4 w-4 mr-2 group-hover:animate-spin" />
                        Explore More Creators
                      </Button>
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* Recent Tab */}
              <TabsContent value="recent" className="space-y-6 mt-0">
                {recentlyVisited.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-32 h-32 mx-auto bg-gradient-to-br from-orange-100 to-yellow-100 dark:from-gray-700 dark:to-gray-600 rounded-full flex items-center justify-center mb-6">
                      <Clock className="h-16 w-16 text-orange-500" />
                    </div>
                    <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">
                      No Recent Activity
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto">
                      Start chatting with creators and they'll appear here for quick access
                    </p>
                    <Button onClick={() => setActiveTab('discover')} className="bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white shadow-lg">
                      <MessageCircle className="h-4 w-4 mr-2" />
                      Start Exploring
                    </Button>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                          Recently Visited
                        </h2>
                        <p className="text-gray-600 dark:text-gray-400">
                          Pick up where you left off
                        </p>
                      </div>
                      <Button variant="outline" onClick={() => {
                        localStorage.removeItem('recentlyVisited')
                        setRecentlyVisited([])
                      }}>
                        Clear History
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {recentlyVisited.map((creator, index) => (
                        <Card key={creator.id} className="group hover:shadow-xl hover:shadow-orange-500/10 transition-all duration-300 border-0 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm hover:bg-white dark:hover:bg-gray-800">
                          <CardHeader className="pb-4">
                            <div className="flex items-center space-x-3">
                              <div className="relative">
                                <Avatar className="h-12 w-12 ring-2 ring-orange-500/30">
                                  <AvatarImage src={creator.avatar_url || creator.profile_image} />
                                  <AvatarFallback className="bg-gradient-to-br from-orange-500 to-yellow-500 text-white font-semibold">
                                    {getInitials(creator.display_name)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-orange-500 text-white text-xs rounded-full flex items-center justify-center">
                                  {index + 1}
                                </div>
                              </div>
                              <div className="flex-1">
                                <CardTitle className="text-lg">{creator.display_name}</CardTitle>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Last visited recently</p>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleFollowCreator(creator.id)}
                                className={`${isCreatorFollowed(creator.id) ? 'text-pink-600' : 'text-gray-400'} hover:text-pink-600`}
                              >
                                <Heart className={`h-4 w-4 ${isCreatorFollowed(creator.id) ? 'fill-current' : ''}`} />
                              </Button>
                            </div>
                          </CardHeader>
                          <CardContent className="pb-4">
                            <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-4">
                              {creator.bio || 'Great creator with amazing content to explore.'}
                            </p>
                            <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
                              <span>{formatSubscriberCount(creator.subscriber_count || 1000)} followers</span>
                              <span className="text-blue-600 font-medium">Continue chat</span>
                            </div>
                          </CardContent>
                          <CardFooter className="pt-0">
                            <Link href={`/${creator.display_name.toLowerCase()}`} className="w-full" onClick={() => handleVisitCreator(creator.id)}>
                              <Button className="w-full bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white">
                                <MessageCircle className="h-4 w-4 mr-2" />
                                Continue Chat
                              </Button>
                            </Link>
                          </CardFooter>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>
            </div>
          </div>
        </Tabs>
      </div>
    </div>
  )
}