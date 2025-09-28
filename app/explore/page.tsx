import Link from 'next/link'
import { db } from '@/lib/database'
import { Button } from '@/components/ui/button'
import { Users, MessageCircle } from 'lucide-react'

export default async function ExplorePage() {
  const creators = await db.creator.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' }
  })

  // Get users and subscription counts separately
  const creatorsWithData = await Promise.all(
    creators.map(async (creator) => {
      const user = await db.user.findUnique({ where: { id: creator.userId } })
      const subscriptions = await db.subscription.findMany({
        where: { creatorId: creator.id, status: 'ACTIVE' }
      })
      
      return {
        ...creator,
        user,
        _count: {
          subscriptions: subscriptions.length
        }
      }
    })
  )

  return (
    <div className="min-h-screen gradient-bg">
      {/* Navigation */}
      <nav className="px-6 py-6 flex justify-between items-center backdrop-blur-sm bg-white/70 border-b border-gray-200/50">
        <Link href="/" className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center">
            <span className="text-white font-bold">A</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Aitrion</h1>
        </Link>
        <div className="flex items-center space-x-4">
          <Link href="/auth/signin">
            <Button variant="secondary" className="text-sm">Sign In</Button>
          </Link>
          <Link href="/auth/signup">
            <Button className="text-sm">Get Started</Button>
          </Link>
        </div>
      </nav>

      {/* Content */}
      <main className="container mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Explore AI Creators
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Discover and chat with AI versions of your favorite creators, 
            powered by their actual content and expertise.
          </p>
        </div>

        {creatorsWithData.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Users className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              No creators yet
            </h3>
            <p className="text-gray-600 mb-6">
              Be the first to create an AI version of yourself!
            </p>
            <Link href="/auth/signup?type=creator">
              <Button>Become a Creator</Button>
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {creatorsWithData.map((creator) => (
              <div key={creator.id} className="card p-6 hover:shadow-lg transition-all duration-300">
                <div className="text-center mb-6">
                  <div className="relative w-20 h-20 mx-auto mb-4">
                    {creator.user.image ? (
                      <img
                        src={creator.user.image}
                        alt={creator.displayName}
                        className="w-20 h-20 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                        <span className="text-white text-xl font-bold">
                          {creator.displayName.charAt(0)}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <h3 className="text-xl font-bold text-gray-900 mb-1">
                    {creator.displayName}
                  </h3>
                  <p className="text-gray-600 text-sm mb-3">@{creator.username}</p>
                  
                  {creator.bio && (
                    <p className="text-gray-700 text-sm leading-relaxed mb-4 line-clamp-3">
                      {creator.bio}
                    </p>
                  )}
                  
                  <div className="flex items-center justify-center space-x-4 text-sm text-gray-500 mb-6">
                    <div className="flex items-center space-x-1">
                      <Users className="w-4 h-4" />
                      <span>{creator._count.subscriptions} supporters</span>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <Link href={`/${creator.username}`}>
                      <Button className="w-full">
                        <MessageCircle className="w-4 h-4 mr-2" />
                        Chat Now
                      </Button>
                    </Link>
                    <p className="text-xs text-gray-500">
                      Unlimited chat access • Always free
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}