import { notFound, redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/database'
import SubscriptionForm from '@/components/subscription-form'

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

  const existingSubscription = await db.subscription.findFirst({
    where: {
      user_id: session.user.id,
      creator_id: creator.id
    }
  })

  if (existingSubscription && existingSubscription.status === 'ACTIVE') {
    redirect(`/${creator.username}`)
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4 max-w-2xl">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Support {creator.display_name}
            </h1>
            <p className="text-gray-600">
              Get unlimited access to chat with the AI version of {creator.display_name}
            </p>
          </div>

          <div className="bg-primary-50 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-semibold text-primary-900 mb-4">
              Premium Benefits
            </h2>
            <ul className="space-y-2 text-primary-800">
              <li className="flex items-center space-x-2">
                <span className="text-primary-600">✓</span>
                <span>Unlimited AI conversations</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="text-primary-600">✓</span>
                <span>Priority response times</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="text-primary-600">✓</span>
                <span>Access to all content and knowledge</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="text-primary-600">✓</span>
                <span>Support your favorite creator</span>
              </li>
            </ul>
          </div>

          <div className="border border-gray-200 rounded-lg p-6 mb-8">
            <div className="flex justify-between items-center mb-4">
              <span className="text-lg font-medium">Monthly Subscription</span>
              <span className="text-2xl font-bold">$5/month</span>
            </div>
            <p className="text-sm text-gray-600">
              You can cancel anytime. {Math.round((1 - creator.commission_rate) * 100)}% goes directly to {creator.display_name}.
            </p>
          </div>

          <SubscriptionForm 
            creatorId={creator.id}
            creatorName={creator.display_name}
            userId={session.user.id}
          />
        </div>
      </div>
    </div>
  )
}