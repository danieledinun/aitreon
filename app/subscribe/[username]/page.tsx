import { notFound, redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/database'

interface SubscribePageProps {
  params: {
    username: string
  }
}

export default async function SubscribePage({ params }: SubscribePageProps) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    redirect('/auth/signin')
  }

  const creator = await db.creator.findUnique({
    where: { username: params.username },
    include: {
      user: true
    }
  })

  if (!creator || !creator.is_active) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4 max-w-2xl">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Chat with {creator.display_name}
            </h1>
            <p className="text-gray-600">
              Subscriptions are currently unavailable. You can still chat with the AI version of {creator.display_name} with daily limits.
            </p>
          </div>

          <div className="bg-blue-50 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-semibold text-blue-900 mb-4">
              Available Features
            </h2>
            <ul className="space-y-2 text-blue-800">
              <li className="flex items-center space-x-2">
                <span className="text-blue-600">✓</span>
                <span>Daily AI conversations (limited)</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="text-blue-600">✓</span>
                <span>Access to creator's content and knowledge</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="text-blue-600">✓</span>
                <span>Real-time AI responses</span>
              </li>
            </ul>
          </div>

          <div className="text-center">
            <a
              href={`/${creator.username}`}
              className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Start Chatting
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}