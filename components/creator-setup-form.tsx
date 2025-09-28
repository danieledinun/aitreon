'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

interface CreatorSetupFormProps {
  userId: string
}

export default function CreatorSetupForm({ userId }: CreatorSetupFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    username: '',
    displayName: '',
    bio: '',
    youtubeChannelUrl: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch('/api/creator/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create creator profile')
      }

      // Show success message and redirect with AI config option
      alert('Creator profile created successfully! You can now configure your AI personality in AI Settings.')
      router.push('/creator')
    } catch (error) {
      console.error('Setup error:', error)
      alert('Failed to create creator profile. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
          Username *
        </label>
        <input
          type="text"
          id="username"
          name="username"
          value={formData.username}
          onChange={handleInputChange}
          required
          pattern="^[a-zA-Z0-9_]+$"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder="your_username"
        />
        <p className="text-xs text-gray-500 mt-1">
          Letters, numbers, and underscores only. This will be your unique URL.
        </p>
      </div>

      <div>
        <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 mb-2">
          Display Name *
        </label>
        <input
          type="text"
          id="displayName"
          name="displayName"
          value={formData.displayName}
          onChange={handleInputChange}
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder="Your Display Name"
        />
      </div>

      <div>
        <label htmlFor="bio" className="block text-sm font-medium text-gray-700 mb-2">
          Bio
        </label>
        <textarea
          id="bio"
          name="bio"
          value={formData.bio}
          onChange={handleInputChange}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder="Tell people about yourself..."
        />
      </div>

      <div>
        <label htmlFor="youtubeChannelUrl" className="block text-sm font-medium text-gray-700 mb-2">
          YouTube Channel URL
        </label>
        <input
          type="url"
          id="youtubeChannelUrl"
          name="youtubeChannelUrl"
          value={formData.youtubeChannelUrl}
          onChange={handleInputChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder="https://www.youtube.com/channel/..."
        />
        <p className="text-xs text-green-600 font-medium mt-1">
          💰 Your videos = AI training data = Passive income stream
        </p>
      </div>

      <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-900 mb-2">🚀 Your Launch Timeline</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• ⚡ Instant: AI profile live at aitrion.com/{formData.username || 'your-username'}</li>
          <li>• 📹 Day 1: Your videos processed into AI knowledge base</li>
          <li>• 🤖 Day 2: AI replica ready to interact with fans</li>
          <li>• 💬 Day 3: Fans can start chatting with your AI</li>
          <li>• 📊 Ongoing: Track interactions and earnings in dashboard</li>
        </ul>
      </div>

      <Button
        type="submit"
        disabled={loading || !formData.username || !formData.displayName}
        className="w-full"
      >
        {loading ? 'Activating Your AI Money Machine...' : '💰 Start Earning Passive Income'}
      </Button>
    </form>
  )
}