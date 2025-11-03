'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface AIRecommendationsProps {
  userId: string
  userFtp: number | null
  userWeight: number | null
  userVo2Max: number | null
  trainingGoals: string | null
  weeklyHours: number | null
}

export function AIRecommendations({
  userId,
  userFtp,
  userWeight,
  userVo2Max,
  trainingGoals,
  weeklyHours,
}: AIRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generateRecommendations = async () => {
    if (!userId) return

    try {
      setLoading(true)
      setError(null)

      const { data, error: invokeError } = await supabase.functions.invoke('generate-insights', {
        body: {
          userId,
        },
      })

      if (invokeError) {
        throw invokeError
      }

      if (data?.recommendations) {
        setRecommendations(data.recommendations)
      } else {
        throw new Error('No recommendations returned')
      }
    } catch (err: any) {
      console.error('Error generating recommendations:', err)
      setError(err.message || 'Failed to generate recommendations')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Auto-generate on mount
    generateRecommendations()
  }, [userId])

  const formatRecommendations = (text: string): JSX.Element => {
    // Split by headings and format
    const sections = text.split(/(?=##|\*\*)/g)
    return (
      <div className="prose prose-sm max-w-none">
        {sections.map((section, index) => {
          if (section.startsWith('##')) {
            const heading = section.replace(/##\s*/, '').split('\n')[0]
            const content = section.split('\n').slice(1).join('\n')
            return (
              <div key={index} className="mb-4">
                <h3 className="text-lg font-bold text-gray-900 mb-2">{heading}</h3>
                <div className="text-gray-700 whitespace-pre-line">{content.trim()}</div>
              </div>
            )
          } else if (section.startsWith('**')) {
            const parts = section.split('**')
            return (
              <div key={index} className="mb-2">
                {parts.map((part, i) => {
                  if (i % 2 === 1) {
                    return <strong key={i}>{part}</strong>
                  }
                  return <span key={i}>{part}</span>
                })}
              </div>
            )
          }
          return (
            <div key={index} className="mb-2 text-gray-700 whitespace-pre-line">
              {section}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">AI Recommendations</h2>
        <button
          onClick={generateRecommendations}
          disabled={loading}
          className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Generating...' : '↻ Regenerate'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {loading && (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Analyzing your training data and generating recommendations...</p>
        </div>
      )}

      {!loading && recommendations && (
        <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg p-6 border border-purple-200">
          {formatRecommendations(recommendations)}
        </div>
      )}

      {!loading && !recommendations && !error && (
        <div className="bg-gray-50 rounded-lg p-6 text-center text-gray-500">
          Click "Regenerate" to get AI-powered recommendations based on your training data.
        </div>
      )}

      {/* Missing Data Warning */}
      {(!userFtp || !trainingGoals || !weeklyHours) && (
        <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800 text-sm">
            <strong>Tip:</strong> For more personalized recommendations, complete your profile in
            Settings:
            {!userFtp && ' Set your FTP'}
            {!trainingGoals && ' Define your training goals'}
            {!weeklyHours && ' Set your weekly training hours'}
          </p>
        </div>
      )}
    </div>
  )
}

