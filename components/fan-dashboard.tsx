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
      // For now, get subscribed from localStorage
      const subscribedList = JSON.parse(localStorage.getItem('subscribedCreators') || '[]')

      if (subscribedList.length > 0 && creators.length > 0) {
        const subscribedCreators = creators.filter(creator =>
          subscribedList.includes(creator.id)
        )
        setSubscribed(subscribedCreators)
      } else {
        // Mock some subscribed data if none exists
        const mockSubscribed = creators.slice(1, 4)
        setSubscribed(mockSubscribed)
      }
    } catch (error) {
      console.error('Error fetching subscribed creators:', error)
      // Fallback to mock data
      const mockSubscribed = creators.slice(1, 4)
      setSubscribed(mockSubscribed)
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

  const handleFollowCreator = (creatorId: string) => {
    try {
      const subscribedList = JSON.parse(localStorage.getItem('subscribedCreators') || '[]')
      let updatedList

      if (subscribedList.includes(creatorId)) {
        // Unfollow
        updatedList = subscribedList.filter((id: string) => id !== creatorId)
      } else {
        // Follow
        updatedList = [...subscribedList, creatorId]
      }

      localStorage.setItem('subscribedCreators', JSON.stringify(updatedList))
      fetchSubscribed()
    } catch (error) {
      console.error('Error updating subscriptions:', error)
    }
  }

  const isCreatorFollowed = (creatorId: string) => {
    try {
      const subscribedList = JSON.parse(localStorage.getItem('subscribedCreators') || '[]')
      return subscribedList.includes(creatorId)
    } catch (error) {
      return false
    }
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
            <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%23ffffff" fill-opacity="0.1"%3E%3Ccircle cx="30" cy="30" r="3"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-20"></div>
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
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredCreators.map((creator, index) => (
                      <Card key={creator.id} className="group hover:shadow-xl hover:shadow-blue-500/10 transition-all duration-300 border-0 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm hover:bg-white dark:hover:bg-gray-800 hover:-translate-y-1">
                        <CardHeader className="pb-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="relative">
                                <Avatar className="h-14 w-14 ring-2 ring-blue-500/20 group-hover:ring-blue-500/40 transition-all">
                                  <AvatarImage src={creator.avatar_url} />
                                  <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-500 text-white font-semibold">
                                    {getInitials(creator.display_name)}
                                  </AvatarFallback>
                                </Avatar>
                                {creator.verification_status === 'verified' && (
                                  <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center ring-2 ring-white">
                                    <span className="text-white text-xs">✓</span>
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <CardTitle className="text-lg group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-1">
                                  {creator.display_name}
                                </CardTitle>
                                <div className="flex items-center space-x-2 mt-1">
                                  <Badge variant="secondary" className="text-xs px-2 py-1">
                                    {creator.category || 'Creator'}
                                  </Badge>
                                  <div className="flex items-center space-x-1">
                                    {[...Array(5)].map((_, i) => (
                                      <Star key={i} className={`h-3 w-3 ${i < 4 ? 'text-yellow-400 fill-current' : 'text-gray-300'}`} />
                                    ))}
                                    <span className="text-xs text-gray-500 ml-1">4.8</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <Button variant="ghost" size="sm" className="p-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Bookmark className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardHeader>

                        <CardContent className="pb-4">
                          <CardDescription className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-4">
                            {creator.bio || 'Passionate creator sharing amazing content with the community.'}
                          </CardDescription>

                          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-4">
                            <div className="flex items-center space-x-1">
                              <Users className="h-3 w-3" />
                              <span>{formatSubscriberCount(creator.subscriber_count || 1000)} followers</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Eye className="h-3 w-3" />
                              <span>{creator.video_count || 50} videos</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <MessageCircle className="h-3 w-3" />
                              <span>{Math.floor(Math.random() * 500) + 100} chats</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-medium text-gray-900 dark:text-white">Response time</span>
                            <span className="text-sm text-green-600 font-medium">Instant</span>
                          </div>
                        </CardContent>

                        <CardFooter className="pt-0 pb-6">
                          <div className="w-full space-y-2">
                            <Link href={`/${creator.display_name.toLowerCase()}`} className="block" onClick={() => handleVisitCreator(creator.id)}>
                              <Button className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-200">
                                <MessageCircle className="h-4 w-4 mr-2" />
                                Start Chatting
                              </Button>
                            </Link>
                            <div className="flex space-x-2">
                              <Button
                                variant="outline"
                                className={`flex-1 text-xs transition-all ${isCreatorFollowed(creator.id) ? 'bg-pink-50 text-pink-600 border-pink-200 hover:bg-pink-100' : 'hover:bg-pink-50 hover:text-pink-600 hover:border-pink-200'}`}
                                onClick={() => handleFollowCreator(creator.id)}
                              >
                                <Heart className={`h-3 w-3 mr-1 ${isCreatorFollowed(creator.id) ? 'fill-current' : ''}`} />
                                {isCreatorFollowed(creator.id) ? 'Following' : 'Follow'}
                              </Button>
                              <Button variant="outline" className="flex-1 text-xs hover:bg-yellow-50 hover:text-yellow-600 hover:border-yellow-200">
                                <Star className="h-3 w-3 mr-1" />
                                Subscribe
                              </Button>
                            </div>
                          </div>
                        </CardFooter>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
              {/* Following Tab */}
              <TabsContent value="following" className="space-y-6 mt-0">
                {subscribed.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-32 h-32 mx-auto bg-gradient-to-br from-pink-100 to-purple-100 dark:from-gray-700 dark:to-gray-600 rounded-full flex items-center justify-center mb-6">
                      <Heart className="h-16 w-16 text-pink-500" />
                    </div>
                    <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">
                      No Creators Followed Yet
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto">
                      Start following your favorite creators to see them here and get updates on their latest content
                    </p>
                    <Button onClick={() => setActiveTab('discover')} className="bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white shadow-lg">
                      <Search className="h-4 w-4 mr-2" />
                      Discover Creators
                    </Button>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                          Following ({subscribed.length})
                        </h2>
                        <p className="text-gray-600 dark:text-gray-400">
                          Creators you're following
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {subscribed.map((creator) => (
                        <Card key={creator.id} className="group hover:shadow-xl hover:shadow-pink-500/10 transition-all duration-300 border-0 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm hover:bg-white dark:hover:bg-gray-800">
                          <CardHeader className="pb-4">
                            <div className="flex items-center space-x-3">
                              <Avatar className="h-12 w-12 ring-2 ring-pink-500/30">
                                <AvatarImage src={creator.avatar_url || creator.profile_image} />
                                <AvatarFallback className="bg-gradient-to-br from-pink-500 to-purple-500 text-white font-semibold">
                                  {getInitials(creator.display_name)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1">
                                <CardTitle className="text-lg">{creator.display_name}</CardTitle>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Following since recently</p>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleFollowCreator(creator.id)}
                                className="text-pink-600 hover:text-pink-700 hover:bg-pink-50"
                              >
                                <Heart className="h-4 w-4 fill-current" />
                              </Button>
                            </div>
                          </CardHeader>
                          <CardContent className="pb-4">
                            <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-4">
                              {creator.bio || 'Amazing creator sharing valuable content with the community.'}
                            </p>
                            <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
                              <span>{formatSubscriberCount(creator.subscriber_count || 1000)} followers</span>
                              <span className="text-green-600 font-medium">Active</span>
                            </div>
                          </CardContent>
                          <CardFooter className="pt-0">
                            <Link href={`/${creator.display_name.toLowerCase()}`} className="w-full" onClick={() => handleVisitCreator(creator.id)}>
                              <Button className="w-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white">
                                <MessageCircle className="h-4 w-4 mr-2" />
                                Continue Chatting
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