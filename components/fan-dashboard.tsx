'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, MessageCircle, Play, Star, Users, Video, Filter, Grid, List, Heart, Clock, TrendingUp, Bookmark, Eye, Crown, User, CreditCard, Settings, Mail, Phone, MapPin, Calendar, Shield, Edit, CheckCircle, Lock, Plus, MoreHorizontal, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import { FocusCards } from '@/components/ui/focus-cards'
import RecentActivityFeed from '@/components/recent-activity-feed'

interface Creator {
  id: string
  display_name: string
  bio?: string
  avatar_url?: string
  youtube_channel_url?: string
  subscriber_count?: number
  video_count?: number
  category?: string
  created_at: string
  user_id: string
  profile_image?: string
  username?: string
  is_active?: boolean
  subscription_date?: string
  last_conversation?: string
  conversation_count?: number
}

interface FanDashboardProps {
  userId: string
}

export default function FanDashboard({ userId }: FanDashboardProps) {
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const [creators, setCreators] = useState<Creator[]>([])
  const [filteredCreators, setFilteredCreators] = useState<Creator[]>([])
  const [recentlyVisited, setRecentlyVisited] = useState<Creator[]>([])
  const [subscribed, setSubscribed] = useState<Creator[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [sortBy, setSortBy] = useState('popularity')
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'discover')

  // Profile state
  const [profileData, setProfileData] = useState({
    name: '',
    email: '',
    phone: '',
    location: '',
    bio: '',
    avatar_url: ''
  })
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [subscriptions, setSubscriptions] = useState<any[]>([])
  const [paymentMethods, setPaymentMethods] = useState<any[]>([])

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
  }, [])

  useEffect(() => {
    if (session?.user?.id) {
      fetchSubscribed()
      fetchProfileData()
      fetchSubscriptions()
      fetchPaymentMethods()
    }
  }, [session?.user?.id])

  useEffect(() => {
    filterCreators()
  }, [searchQuery, selectedCategory, sortBy, creators])

  const fetchCreators = async () => {
    try {
      // First get creators
      const { data: creatorsData, error: creatorsError } = await supabase
        .from('creators')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (creatorsError) throw creatorsError

      // Then get conversation count for each creator
      const creatorsWithConversationCount = await Promise.all(
        (creatorsData || []).map(async (creator) => {
          const { count } = await supabase
            .from('chat_sessions')
            .select('*', { count: 'exact', head: true })
            .eq('creator_id', creator.id)

          return {
            ...creator,
            conversation_count: count || 0
          }
        })
      )

      setCreators(creatorsWithConversationCount)
    } catch (error) {
      console.error('Error fetching creators:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchRecentlyVisited = async () => {
    try {
      if (!session?.user?.id) return

      // Fetch recent conversations from chat_sessions table
      const { data: recentSessions, error } = await supabase
        .from('chat_sessions')
        .select(`
          id,
          creator_id,
          updated_at,
          created_at,
          creators (
            id,
            display_name,
            bio,
            profile_image,
            username
          )
        `)
        .eq('user_id', session.user.id)
        .order('updated_at', { ascending: false })
        .limit(6)

      if (error) {
        console.error('Error fetching recent conversations:', error)
        // Fallback to mock data
        const mockRecent = creators.slice(0, 3)
        setRecentlyVisited(mockRecent)
        return
      }

      if (recentSessions && recentSessions.length > 0) {
        // Convert chat sessions to creator format with last conversation date
        const recentCreators = recentSessions
          .filter(session => session.creators)
          .map(session => {
            const creator = session.creators as any
            return {
              id: creator.id,
              display_name: creator.display_name,
              bio: creator.bio,
              profile_image: creator.profile_image,
              username: creator.username,
              user_id: '',
              created_at: session.created_at,
              last_conversation: session.updated_at,
              is_active: true,
              category: undefined,
              avatar_url: creator.profile_image,
              subscriber_count: undefined,
              conversation_count: undefined
            } as Creator
          })

        setRecentlyVisited(recentCreators)
        console.log('✅ Recent conversations fetched:', recentCreators.length)
      } else {
        // No recent conversations, show empty state
        setRecentlyVisited([])
      }
    } catch (error) {
      console.error('Error fetching recent conversations:', error)
      // Fallback to mock data
      const mockRecent = creators.slice(0, 3)
      setRecentlyVisited(mockRecent)
    }
  }

  const fetchSubscribed = async () => {
    try {
      console.log('🔄 Fan Dashboard: Fetching subscriptions for user:', userId)
      console.log('🔍 Fan Dashboard: Session user ID:', session?.user?.id)

      // Fetch real subscriptions from database using user_subscriptions table
      const { data: subscriptions, error } = await supabase
        .from('user_subscriptions')
        .select(`
          creator_id,
          created_at,
          subscription_type,
          is_active,
          creators (
            id,
            display_name,
            bio,
            profile_image,
            youtube_channel_url,
            username
          )
        `)
        .eq('user_id', userId)
        .eq('is_active', true)

      console.log('🔍 Fan Dashboard: Query params - user_id:', userId, 'is_active: true')

      if (error) {
        console.error('❌ Fan Dashboard: Error fetching subscriptions:', error)
        setSubscribed([])
        return
      }

      console.log('✅ Fan Dashboard: Subscriptions fetched:', subscriptions?.length || 0)
      console.log('📄 Fan Dashboard: Subscription data:', subscriptions)

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
              subscriber_count: undefined, // Not available in creators table
              conversation_count: 0, // Will be populated by fetchCreators
              is_active: true, // Assume active since we're filtering by is_active
              user_id: '', // Not needed for display
              username: creator.username,
              created_at: sub.created_at, // Use subscription date
              category: undefined,
              avatar_url: creator.profile_image,
              subscription_date: sub.created_at
            } as Creator
          })
        setSubscribed(subscribedCreators)
        console.log('✅ Subscribed creators set:', subscribedCreators.length)
      } else {
        setSubscribed([])
        console.log('ℹ️ No subscriptions found')
      }
    } catch (error) {
      console.error('❌ Error fetching subscribed creators:', error)
      setSubscribed([])
    }
  }

  const fetchProfileData = async () => {
    try {
      if (!session?.user?.id) return

      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single()

      if (error) {
        console.error('Error fetching profile data:', error)
        // Use session data as fallback if database fetch fails
        setProfileData({
          name: session.user.name || '',
          email: session.user.email || '',
          phone: '',
          location: '',
          bio: '',
          avatar_url: session.user.image || ''
        })
        return
      }

      if (user) {
        setProfileData({
          name: user.name || session?.user?.name || '',
          email: user.email || session?.user?.email || '',
          phone: user.phone || '',
          location: user.location || '',
          bio: user.bio || '',
          avatar_url: user.image || session?.user?.image || ''
        })
      }
    } catch (error) {
      console.error('Error fetching profile:', error)
      // Use session data as fallback on error
      setProfileData({
        name: session?.user?.name || '',
        email: session?.user?.email || '',
        phone: '',
        location: '',
        bio: '',
        avatar_url: session?.user?.image || ''
      })
    }
  }

  const fetchSubscriptions = async () => {
    try {
      if (!session?.user?.id) return

      const { data, error } = await supabase
        .from('subscriptions')
        .select(`
          id,
          status,
          created_at,
          updated_at,
          plan_type,
          amount,
          creators (
            id,
            display_name,
            profile_image
          )
        `)
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching subscriptions:', error)
        return
      }

      setSubscriptions(data || [])
    } catch (error) {
      console.error('Error fetching subscriptions:', error)
    }
  }

  const fetchPaymentMethods = async () => {
    try {
      if (!session?.user?.id) return

      // For demo purposes, we'll simulate payment methods
      // In production, this would integrate with Stripe or similar
      const mockPaymentMethods = [
        {
          id: '1',
          type: 'card',
          last_four: '4242',
          brand: 'visa',
          exp_month: 12,
          exp_year: 2025,
          is_default: true
        }
      ]

      setPaymentMethods(mockPaymentMethods)
    } catch (error) {
      console.error('Error fetching payment methods:', error)
    }
  }

  const updateProfile = async () => {
    try {
      if (!session?.user?.id) return

      const updateData = {
        name: profileData.name,
        phone: profileData.phone,
        location: profileData.location,
        bio: profileData.bio,
      }

      const { error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', session.user.id)

      if (error) {
        console.error('Error updating profile:', error)
        return false
      }

      setIsEditingProfile(false)
      return true
    } catch (error) {
      console.error('Error updating profile:', error)
      return false
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
      console.log('🔄 Toggle follow for creator:', creatorId, 'user:', userId)
      const isFollowed = subscribed.some(creator => creator.id === creatorId)
      console.log('Current follow status:', isFollowed)

      if (isFollowed) {
        // Unfollow - deactivate subscription
        console.log('🔄 Unfollowing creator...')
        const { error } = await supabase
          .from('user_subscriptions')
          .update({ is_active: false })
          .eq('user_id', userId)
          .eq('creator_id', creatorId)

        if (error) {
          console.error('❌ Error unfollowing creator:', error)
          console.error('❌ Error details:', JSON.stringify(error, null, 2))
          return
        }
        console.log('✅ Successfully unfollowed creator')
      } else {
        // Follow - create or reactivate subscription
        console.log('🔄 Following creator...')
        const { error } = await supabase
          .from('user_subscriptions')
          .upsert({
            user_id: userId,
            creator_id: creatorId,
            subscription_type: 'follow',
            is_active: true
          }, {
            onConflict: 'user_id,creator_id'
          })

        if (error) {
          console.error('❌ Error following creator:', error)
          console.error('❌ Error details:', JSON.stringify(error, null, 2))
          return
        }
        console.log('✅ Successfully followed creator')
      }

      // Refresh the subscriptions data
      console.log('🔄 Refreshing subscriptions...')
      await fetchSubscribed()
    } catch (error) {
      console.error('❌ Error updating subscription:', error)
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

              {/* Quick Navigation */}
              <nav className="flex items-center space-x-4">
                <Button
                  variant={activeTab === 'discover' ? 'default' : 'ghost'}
                  onClick={() => setActiveTab('discover')}
                  size="sm"
                >
                  Discover
                </Button>
                <Button
                  variant={activeTab === 'following' ? 'default' : 'ghost'}
                  onClick={() => setActiveTab('following')}
                  size="sm"
                >
                  Following
                </Button>
                <Button
                  variant={activeTab === 'subscriptions' ? 'default' : 'ghost'}
                  onClick={() => setActiveTab('subscriptions')}
                  size="sm"
                >
                  Subscribed
                </Button>
                <Button
                  variant={activeTab === 'recent' ? 'default' : 'ghost'}
                  onClick={() => setActiveTab('recent')}
                  size="sm"
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
            <TabsList className="grid w-full lg:w-auto grid-cols-2 md:grid-cols-4 lg:grid-cols-1 lg:flex-col h-auto p-1">
              <TabsTrigger value="discover" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white justify-start">
                <Search className="h-4 w-4 mr-2" />
                Discover
              </TabsTrigger>
              <TabsTrigger value="following" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white justify-start">
                <Users className="h-4 w-4 mr-2" />
                Following
              </TabsTrigger>
              <TabsTrigger value="subscriptions" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white justify-start">
                <CreditCard className="h-4 w-4 mr-2" />
                Subscribed
              </TabsTrigger>
              <TabsTrigger value="recent" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white justify-start">
                <Clock className="h-4 w-4 mr-2" />
                Recent
              </TabsTrigger>
              <TabsTrigger value="profile" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white justify-start">
                <User className="h-4 w-4 mr-2" />
                Profile
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
              {/* Following Tab - Show Followed Creators (Free) */}
              <TabsContent value="following" className="space-y-8 mt-0">
                {subscribed.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-32 h-32 mx-auto bg-gradient-to-br from-purple-100 to-pink-100 dark:from-gray-700 dark:to-gray-600 rounded-full flex items-center justify-center mb-6">
                      <Users className="h-16 w-16 text-purple-500" />
                    </div>
                    <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">
                      No Followed Creators
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto">
                      Follow creators to see their content and chat with their AI replicas
                    </p>
                    <Button
                      onClick={() => setActiveTab('discover')}
                      className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg"
                    >
                      <Search className="h-4 w-4 mr-2" />
                      Discover Creators
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                          Following
                        </h2>
                        <p className="text-gray-600 dark:text-gray-400">
                          Creators you're following and can chat with
                        </p>
                      </div>
                      <Badge variant="secondary" className="text-sm">
                        {subscribed.length} {subscribed.length === 1 ? 'Creator' : 'Creators'}
                      </Badge>
                    </div>

                    <FocusCards
                      creators={subscribed}
                      onStartChat={handleVisitCreator}
                      onToggleFollow={handleFollowCreator}
                      isFollowed={isCreatorFollowed}
                    />
                  </div>
                )}
              </TabsContent>

              {/* Subscriptions Tab - Show Paid Subscriptions */}
              <TabsContent value="subscriptions" className="space-y-8 mt-0">
                {subscriptions.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-32 h-32 mx-auto bg-gradient-to-br from-green-100 to-emerald-100 dark:from-gray-700 dark:to-gray-600 rounded-full flex items-center justify-center mb-6">
                      <CreditCard className="h-16 w-16 text-green-500" />
                    </div>
                    <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">
                      No Active Subscriptions
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto">
                      Subscribe to creators to unlock exclusive content and support their work
                    </p>
                    <Button
                      onClick={() => setActiveTab('discover')}
                      className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white shadow-lg"
                    >
                      <Search className="h-4 w-4 mr-2" />
                      Discover Creators
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                          Active Subscriptions
                        </h2>
                        <p className="text-gray-600 dark:text-gray-400">
                          Your paid subscriptions and premium content access
                        </p>
                      </div>
                      <Badge variant="secondary" className="text-sm">
                        {subscriptions.length} {subscriptions.length === 1 ? 'Subscription' : 'Subscriptions'}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {subscriptions.map((subscription: any) => (
                        <Card key={subscription.id} className="group hover:shadow-xl transition-all duration-300 border-0 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm hover:bg-white dark:hover:bg-gray-800">
                          <CardHeader className="pb-4">
                            <div className="flex items-center space-x-3">
                              <Avatar className="h-12 w-12 ring-2 ring-green-500/30">
                                <AvatarImage src={subscription.creators?.profile_image} />
                                <AvatarFallback className="bg-gradient-to-br from-green-500 to-emerald-500 text-white font-semibold">
                                  {getInitials(subscription.creators?.display_name || 'Creator')}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1">
                                <CardTitle className="text-lg">{subscription.creators?.display_name}</CardTitle>
                                <Badge className="mt-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                  {subscription.status === 'ACTIVE' ? 'Active' : subscription.status}
                                </Badge>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="pb-4">
                            <div className="space-y-3">
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600 dark:text-gray-400">Plan:</span>
                                <span className="font-medium">{subscription.plan_type || 'Premium'}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600 dark:text-gray-400">Amount:</span>
                                <span className="font-medium">${subscription.amount || '0'}/month</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600 dark:text-gray-400">Since:</span>
                                <span className="font-medium">
                                  {new Date(subscription.created_at).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                          </CardContent>
                          <CardFooter className="pt-0">
                            <Link
                              href={`/${subscription.creators?.username || subscription.creators?.display_name?.toLowerCase().replace(/\\s+/g, '')}`}
                              className="w-full"
                            >
                              <Button className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white">
                                <MessageCircle className="h-4 w-4 mr-2" />
                                Premium Chat
                              </Button>
                            </Link>
                          </CardFooter>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* Recent Tab */}
              <TabsContent value="recent" className="space-y-6 mt-0">
                <RecentActivityFeed userId={userId} />
              </TabsContent>

              {/* Profile Tab */}
              <TabsContent value="profile" className="space-y-6 mt-0">
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                        Profile Settings
                      </h2>
                      <p className="text-gray-600 dark:text-gray-400">
                        Manage your personal information and account settings
                      </p>
                    </div>
                    <Button
                      variant={isEditingProfile ? "default" : "outline"}
                      onClick={async () => {
                        if (isEditingProfile) {
                          await updateProfile()
                        } else {
                          setIsEditingProfile(true)
                        }
                      }}
                      className={isEditingProfile ? "bg-green-600 hover:bg-green-700" : ""}
                    >
                      {isEditingProfile ? (
                        <>
                          <Check className="h-4 w-4 mr-2" />
                          Save Changes
                        </>
                      ) : (
                        <>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit Profile
                        </>
                      )}
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Profile Information Card */}
                    <Card className="lg:col-span-2 border-0 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm">
                      <CardHeader>
                        <CardTitle className="flex items-center">
                          <User className="h-5 w-5 mr-2 text-blue-600" />
                          Personal Information
                        </CardTitle>
                        <CardDescription>
                          Update your personal details and contact information
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                              Full Name
                            </label>
                            {isEditingProfile ? (
                              <Input
                                value={profileData.name}
                                onChange={(e) => setProfileData(prev => ({ ...prev, name: e.target.value }))}
                                placeholder="Enter your full name"
                                className="w-full"
                              />
                            ) : (
                              <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-md text-gray-900 dark:text-gray-100">
                                {profileData.name || "Not set"}
                              </div>
                            )}
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                              Email Address
                            </label>
                            <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-md text-gray-900 dark:text-gray-100">
                              {profileData.email || "Not set"}
                              <Badge variant="secondary" className="ml-2 text-xs">Verified</Badge>
                            </div>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                              Phone Number
                            </label>
                            {isEditingProfile ? (
                              <Input
                                value={profileData.phone}
                                onChange={(e) => setProfileData(prev => ({ ...prev, phone: e.target.value }))}
                                placeholder="Enter your phone number"
                                className="w-full"
                              />
                            ) : (
                              <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-md text-gray-900 dark:text-gray-100">
                                {profileData.phone || "Not set"}
                              </div>
                            )}
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                              Location
                            </label>
                            {isEditingProfile ? (
                              <Input
                                value={profileData.location}
                                onChange={(e) => setProfileData(prev => ({ ...prev, location: e.target.value }))}
                                placeholder="Enter your location"
                                className="w-full"
                              />
                            ) : (
                              <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-md text-gray-900 dark:text-gray-100">
                                {profileData.location || "Not set"}
                              </div>
                            )}
                          </div>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                            Bio
                          </label>
                          {isEditingProfile ? (
                            <textarea
                              value={profileData.bio}
                              onChange={(e) => setProfileData(prev => ({ ...prev, bio: e.target.value }))}
                              placeholder="Tell us about yourself"
                              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 resize-none"
                              rows={3}
                            />
                          ) : (
                            <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-md text-gray-900 dark:text-gray-100 min-h-[80px]">
                              {profileData.bio || "Not set"}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Account Overview Card */}
                    <Card className="border-0 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm">
                      <CardHeader>
                        <CardTitle className="flex items-center">
                          <Shield className="h-5 w-5 mr-2 text-green-600" />
                          Account Overview
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                          <div className="flex items-center">
                            <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                            <span className="text-sm font-medium">Account Status</span>
                          </div>
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                            Active
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                          <div className="flex items-center">
                            <Mail className="h-5 w-5 text-blue-600 mr-2" />
                            <span className="text-sm font-medium">Email Verified</span>
                          </div>
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        </div>
                        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                          <div className="flex items-center">
                            <Calendar className="h-5 w-5 text-gray-600 mr-2" />
                            <span className="text-sm font-medium">Member Since</span>
                          </div>
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {new Date().toLocaleDateString()}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Payment Methods Section */}
                  <Card className="border-0 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm">
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <CreditCard className="h-5 w-5 mr-2 text-purple-600" />
                        Payment Methods
                      </CardTitle>
                      <CardDescription>
                        Manage your payment methods and billing information
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {paymentMethods.length === 0 ? (
                        <div className="text-center py-8">
                          <CreditCard className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                            No Payment Methods
                          </h3>
                          <p className="text-gray-600 dark:text-gray-400 mb-4">
                            Add a payment method to subscribe to creators
                          </p>
                          <Button className="bg-purple-600 hover:bg-purple-700 text-white">
                            <Plus className="h-4 w-4 mr-2" />
                            Add Payment Method
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {paymentMethods.map((method, index) => (
                            <div key={index} className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                              <div className="flex items-center">
                                <CreditCard className="h-5 w-5 text-gray-400 mr-3" />
                                <div>
                                  <div className="font-medium">•••• •••• •••• {method.last4}</div>
                                  <div className="text-sm text-gray-500">Expires {method.expiry}</div>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                {method.isDefault && (
                                  <Badge variant="outline" className="text-xs">Default</Badge>
                                )}
                                <Button variant="ghost" size="sm">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                          <Button variant="outline" className="w-full">
                            <Plus className="h-4 w-4 mr-2" />
                            Add Another Payment Method
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Account Security Section */}
                  <Card className="border-0 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm">
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <Lock className="h-5 w-5 mr-2 text-red-600" />
                        Account Security
                      </CardTitle>
                      <CardDescription>
                        Manage your account security and privacy settings
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                        <div>
                          <div className="font-medium">Password</div>
                          <div className="text-sm text-gray-500">Last updated 30 days ago</div>
                        </div>
                        <Button variant="outline" size="sm">
                          Change Password
                        </Button>
                      </div>
                      <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                        <div>
                          <div className="font-medium">Two-Factor Authentication</div>
                          <div className="text-sm text-gray-500">Add an extra layer of security</div>
                        </div>
                        <Button variant="outline" size="sm">
                          Enable 2FA
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </div>
          </div>
        </Tabs>
      </div>
    </div>
  )
}