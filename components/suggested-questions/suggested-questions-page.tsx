'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { HelpCircle, Plus, Trash2, Save, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface SuggestedQuestion {
  id: string
  question: string
  description: string
}

interface SuggestedQuestionsPageProps {
  creatorId: string
  existingQuestions?: {
    questions: SuggestedQuestion[] | string
  } | null
}

export default function SuggestedQuestionsPage({ creatorId, existingQuestions }: SuggestedQuestionsPageProps) {
  const [questions, setQuestions] = useState<SuggestedQuestion[]>(() => {
    if (existingQuestions?.questions) {
      try {
        // Handle both JSON object (from database JSONB) and JSON string
        if (typeof existingQuestions.questions === 'string') {
          return JSON.parse(existingQuestions.questions)
        } else if (Array.isArray(existingQuestions.questions)) {
          return existingQuestions.questions
        }
        return []
      } catch (e) {
        console.error('Error parsing existing questions:', e)
        return []
      }
    }
    return []
  })
  
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)

  const addQuestion = () => {
    const newQuestion: SuggestedQuestion = {
      id: Date.now().toString(),
      question: '',
      description: ''
    }
    setQuestions([...questions, newQuestion])
  }

  const updateQuestion = (id: string, field: keyof SuggestedQuestion, value: string) => {
    setQuestions(questions.map(q => 
      q.id === id ? { ...q, [field]: value } : q
    ))
  }

  const removeQuestion = (id: string) => {
    setQuestions(questions.filter(q => q.id !== id))
  }

  const saveQuestions = async () => {
    setLoading(true)
    setSaved(false)

    try {
      const response = await fetch('/api/creator/custom-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          creatorId,
          questions: questions.filter(q => q.question.trim()) // Only save non-empty questions
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        console.error('API Error:', data)
        throw new Error(data.error || 'Failed to save questions')
      }

      console.log('✅ Questions saved successfully:', data)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (error) {
      console.error('Error saving questions:', error)
      alert(`Failed to save questions: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`)
    } finally {
      setLoading(false)
    }
  }

  const addDefaultQuestions = () => {
    const defaultQuestions: SuggestedQuestion[] = [
      {
        id: Date.now().toString(),
        question: "What's your favorite air fryer recipe?",
        description: "Get recommendations for popular air fryer dishes"
      },
      {
        id: (Date.now() + 1).toString(),
        question: "How do I make crispy chicken nuggets?",
        description: "Learn the technique for perfectly crispy homemade nuggets"
      },
      {
        id: (Date.now() + 2).toString(),
        question: "What's the best temperature for air frying vegetables?",
        description: "Get cooking tips for perfectly roasted vegetables"
      },
      {
        id: (Date.now() + 3).toString(),
        question: "Can you show me a copycat fast food recipe?",
        description: "Discover how to recreate your favorite restaurant dishes"
      }
    ]
    setQuestions([...questions, ...defaultQuestions])
  }

  return (
    <div className="space-y-8">
      {/* Modern Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link href="/creator" className="text-gray-600 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-3xl font-bold flex items-center gap-3 text-gray-900 dark:text-white">
              <HelpCircle className="h-7 w-7 text-purple-400" />
              Suggested Questions
            </h1>
          </div>
          <p className="text-gray-600 dark:text-neutral-400 text-lg">Create questions that users can quickly ask your AI replica</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto space-y-6">
          
        {/* Instructions */}
        <Card className="p-6 mb-6 bg-white dark:bg-neutral-900/50 border-gray-300 dark:border-neutral-700">
          <h3 className="font-semibold text-lg mb-3 text-gray-900 dark:text-white">How Suggested Questions Work</h3>
          <div className="text-gray-700 dark:text-neutral-300 space-y-2 text-sm">
            <p>• Suggested questions appear as quick-click buttons on your AI replica's chat interface</p>
            <p>• Users can click these questions to instantly start conversations with your AI</p>
            <p>• Good questions are specific, engaging, and showcase your expertise</p>
            <p>• Questions are displayed in the order you create them</p>
          </div>
        </Card>

        {/* Questions List */}
        <Card className="p-6 bg-white dark:bg-neutral-900/50 border-gray-300 dark:border-neutral-700">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-semibold text-lg text-gray-900 dark:text-white">Your Suggested Questions</h3>
            <div className="flex gap-2">
              {questions.length === 0 && (
                <Button 
                  onClick={addDefaultQuestions}
                  variant="outline"
                  size="sm"
                  className="border-gray-300 dark:border-neutral-600 text-gray-700 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-800"
                >
                  Add Examples
                </Button>
              )}
              <Button onClick={addQuestion} size="sm" className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800">
                <Plus className="h-4 w-4 mr-1" />
                Add Question
              </Button>
            </div>
          </div>

          {questions.length === 0 ? (
            <div className="text-center py-12 text-gray-600 dark:text-neutral-400">
              <HelpCircle className="h-12 w-12 mx-auto mb-4 text-gray-400 dark:text-neutral-600" />
              <p className="text-gray-900 dark:text-white">No suggested questions yet</p>
              <p className="text-sm">Add questions to help users start conversations with your AI</p>
            </div>
          ) : (
            <div className="space-y-4">
              {questions.map((question, index) => (
                <div key={question.id} className="border border-gray-300 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800/30 rounded-lg p-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-1 space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">
                          Question {index + 1}
                        </label>
                        <Input
                          value={question.question}
                          onChange={(e) => updateQuestion(question.id, 'question', e.target.value)}
                          placeholder="e.g., What's your favorite air fryer recipe?"
                          className="w-full bg-white dark:bg-neutral-700 border-gray-300 dark:border-neutral-600 text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-neutral-400"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">
                          Description (optional)
                        </label>
                        <Textarea
                          value={question.description}
                          onChange={(e) => updateQuestion(question.id, 'description', e.target.value)}
                          placeholder="Brief description of what this question is about..."
                          rows={2}
                          className="w-full bg-white dark:bg-neutral-700 border-gray-300 dark:border-neutral-600 text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-neutral-400"
                        />
                      </div>
                    </div>
                    <Button
                      onClick={() => removeQuestion(question.id)}
                      variant="outline"
                      size="sm"
                      className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 border-red-300 dark:border-red-800/30"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {questions.length > 0 && (
            <div className="mt-6 flex justify-end">
              <Button 
                onClick={saveQuestions}
                disabled={loading || questions.every(q => !q.question.trim())}
                className={`flex items-center gap-2 ${
                  saved ? 'bg-green-600 hover:bg-green-700' : 'bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800'
                }`}
              >
                <Save className="h-4 w-4" />
                {loading ? 'Saving...' : saved ? 'Saved!' : 'Save Questions'}
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}