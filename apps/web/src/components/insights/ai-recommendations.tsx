'use client'

import { useEffect, useState, useCallback } from 'react'
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
  const [isCached, setIsCached] = useState(false)

  const generateRecommendations = useCallback(async () => {
    if (!userId) {
      console.log('generateRecommendations: No userId provided')
      return
    }

    try {
      console.log('generateRecommendations: Starting for userId:', userId)
      setLoading(true)
      setError(null)

      const { data, error: invokeError } = await supabase.functions.invoke('generate-insights', {
        body: {
          userId,
        },
      })

      console.log('generateRecommendations: Response received', { data, error: invokeError })

      if (invokeError) {
        console.error('generateRecommendations: Invoke error', invokeError)
        throw invokeError
      }

      if (data?.recommendations) {
        console.log('generateRecommendations: Success, recommendations received')
        setRecommendations(data.recommendations)
        setIsCached(false) // Newly generated, not from cache
      } else if (data?.error) {
        console.error('generateRecommendations: Error in response', data.error)
        throw new Error(data.error || 'No recommendations returned')
      } else {
        console.error('generateRecommendations: No recommendations in response', data)
        throw new Error('No recommendations returned')
      }
    } catch (err: any) {
      console.error('Error generating recommendations:', err)
      setError(err.message || 'Failed to generate recommendations')
    } finally {
      setLoading(false)
    }
  }, [userId])

  // Load cached insights first
  useEffect(() => {
    const loadCachedInsights = async () => {
      console.log('AIRecommendations: useEffect triggered', { userId, userIdType: typeof userId, userIdLength: userId?.length })
      
      if (!userId || userId === '' || userId.trim() === '') {
        console.log('AIRecommendations: No valid userId, skipping')
        return
      }

      try {
        console.log('AIRecommendations: Loading cached insights for userId:', userId)
        const { data, error } = await supabase
          .from('user_insights')
          .select('recommendations, generated_at')
          .eq('user_id', userId)
          .maybeSingle()

        console.log('AIRecommendations: Query result', { data: !!data, error })

        if (error) {
          console.error('Error loading cached insights:', error)
          // If table doesn't exist, that's okay - we'll generate
          if (error.code === '42P01' || error.message?.includes('does not exist')) {
            console.log('AIRecommendations: user_insights table does not exist yet, generating new insights')
            generateRecommendations()
            return
          }
          // For other errors, try generating anyway
          console.log('AIRecommendations: Error loading cache, generating new insights')
          generateRecommendations()
          return
        }

        if (data?.recommendations) {
          console.log('AIRecommendations: Loaded cached insights from', data.generated_at)
          setRecommendations(data.recommendations)
          setIsCached(true)
          
          // Check if insights are stale (older than 24 hours) and regenerate in background
          const generatedAt = new Date(data.generated_at)
          const hoursSinceGeneration = (Date.now() - generatedAt.getTime()) / (1000 * 60 * 60)
          
          console.log('AIRecommendations: Insights age', hoursSinceGeneration, 'hours')
          
          if (hoursSinceGeneration > 24) {
            console.log('AIRecommendations: Cached insights are stale (>24h), regenerating in background')
            generateRecommendations()
          }
        } else {
          console.log('AIRecommendations: No cached insights found, generating new')
          // No cached insights, generate immediately
          generateRecommendations()
        }
      } catch (err: any) {
        console.error('Error loading cached insights:', err)
        console.log('AIRecommendations: Exception caught, generating new insights')
        // Fallback to generating if load fails
        generateRecommendations()
      }
    }

    if (userId && userId.trim() !== '') {
      loadCachedInsights()
    } else {
      console.log('AIRecommendations: userId is empty, waiting...')
    }
  }, [userId, generateRecommendations])

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
          {isCached && (
            <div className="mb-4 text-xs text-gray-500 italic">
              Showing cached insights. Click "Regenerate" for fresh analysis.
            </div>
          )}
          {formatRecommendations(recommendations)}
        </div>
      )}

      {!loading && !recommendations && !error && (
        <div className="bg-gray-50 rounded-lg p-6 text-center">
          <p className="text-gray-500 mb-2">Click "Regenerate" to get AI-powered recommendations based on your training data.</p>
          {process.env.NODE_ENV === 'development' && (
            <p className="text-xs text-gray-400 mt-2 font-mono">
              Debug: userId={userId ? `${userId.substring(0, 8)}...` : 'NOT SET'}
            </p>
          )}
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

