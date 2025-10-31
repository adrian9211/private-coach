'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface AIAnalysisTabProps {
  activityId: string
  activity: any
}

export function AIAnalysisTab({ activityId, activity }: AIAnalysisTabProps) {
  const [analysis, setAnalysis] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  useEffect(() => {
    // Try to load existing analysis
    loadExistingAnalysis()
  }, [activityId])

  const loadExistingAnalysis = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('activity_analyses')
        .select('summary, created_at')
        .eq('activity_id', activityId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError
      }

      if (data?.summary) {
        setAnalysis(data.summary)
      }
    } catch (err: any) {
      console.error('Error loading analysis:', err)
    }
  }

  const generateAnalysis = async () => {
    setIsGenerating(true)
    setLoading(true)
    setError(null)
    setAnalysis(null)

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('generate-analysis', {
        body: { activityId },
      })

      if (invokeError) {
        console.error('Function invoke error:', invokeError)
        throw new Error(invokeError.message || 'Failed to invoke analysis function')
      }

      if (!data) {
        throw new Error('No response from analysis function')
      }

      // Check for error in response
      if (data.error) {
        console.error('Function returned error:', data)
        throw new Error(data.message || data.error || 'Failed to generate analysis')
      }

      if (data?.analysis?.summary) {
        setAnalysis(data.analysis.summary)
        await loadExistingAnalysis() // Reload to get formatted version
      } else if (data?.summary) {
        // Sometimes the summary is at the top level
        setAnalysis(data.summary)
      } else {
        throw new Error(data.message || 'No analysis generated in response')
      }
    } catch (err: any) {
      console.error('Error generating analysis:', err)
      let errorMessage = 'Failed to generate AI analysis. Please try again.'
      
      if (err.message) {
        errorMessage = err.message
      } else if (err.error) {
        errorMessage = err.error
      }
      
      // Add helpful hints
      if (errorMessage.includes('GOOGLE_API_KEY')) {
        errorMessage += '\n\nPlease ensure GOOGLE_API_KEY is set in Supabase Edge Function secrets.'
      } else if (errorMessage.includes('Gemini')) {
        errorMessage += '\n\nPlease check your Gemini API key and quota.'
      }
      
      setError(errorMessage)
    } finally {
      setIsGenerating(false)
      setLoading(false)
    }
  }

  const isIndoorActivity = activity?.data?.summary?.avgPower && activity.data.summary.avgPower > 0

  return (
    <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xl font-bold text-gray-900">AI Coach Analysis</h3>
          {!analysis && (
            <button
              onClick={generateAnalysis}
              disabled={isGenerating || loading}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              {isGenerating ? (
                <span className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Analyzing...
                </span>
              ) : (
                'Generate Analysis'
              )}
            </button>
          )}
        </div>
        <p className="text-sm text-gray-600">
          Get critical coaching feedback and time-optimized training recommendations
          {isIndoorActivity ? ' (Indoor with Power Meter)' : ' (Outdoor Activity)'}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          <p className="font-semibold">Error</p>
          <p className="text-sm">{error}</p>
          <button
            onClick={generateAnalysis}
            className="mt-2 text-red-600 hover:text-red-800 text-sm font-medium underline"
          >
            Try again
          </button>
        </div>
      )}

      {loading && !analysis && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Generating AI analysis...</p>
            <p className="text-sm text-gray-500 mt-2">This may take a few moments</p>
          </div>
        </div>
      )}

      {analysis && (
        <div className="prose prose-sm max-w-none">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4 sm:p-6 border border-blue-200">
            <div className="text-gray-800 leading-relaxed space-y-4">
              {analysis.split('\n\n').map((paragraph, idx) => {
                // Format headings
                if (paragraph.match(/^#{1,3}\s/)) {
                  const level = paragraph.match(/^#+/)?.[0].length || 0
                  const text = paragraph.replace(/^#+\s/, '').trim()
                  const headingClass = level === 1 ? 'text-2xl' : level === 2 ? 'text-xl' : 'text-lg'
                  return (
                    <h3 key={idx} className={`font-bold text-gray-900 mt-6 mb-3 ${headingClass} first:mt-0`}>
                      {text}
                    </h3>
                  )
                }
                
                // Format lists
                if (paragraph.includes('\n') && (paragraph.includes('- ') || paragraph.includes('• ') || paragraph.match(/^\d+\./m))) {
                  const lines = paragraph.split('\n').filter(l => l.trim())
                  return (
                    <ul key={idx} className="list-disc list-inside space-y-2 ml-4">
                      {lines.map((line, lineIdx) => {
                        const cleanLine = line.replace(/^[-•]\s/, '').replace(/^\d+\.\s/, '').trim()
                        // Format bold in list items
                        const formatted = cleanLine.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold">$1</strong>')
                        return (
                          <li key={lineIdx} className="text-gray-800" dangerouslySetInnerHTML={{ __html: formatted }} />
                        )
                      })}
                    </ul>
                  )
                }
                
                // Format regular paragraphs
                const formatted = paragraph
                  .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-gray-900">$1</strong>')
                  .replace(/⚠️/g, '<span class="text-orange-600">⚠️</span>')
                  .replace(/✅/g, '<span class="text-green-600">✅</span>')
                  .replace(/🎯/g, '<span class="text-blue-600">🎯</span>')
                
                if (!paragraph.trim()) return null
                
                return (
                  <p key={idx} className="mb-3 text-gray-800" dangerouslySetInnerHTML={{ __html: formatted }} />
                )
              }).filter(Boolean)}
            </div>
          </div>
          
          <div className="mt-4 flex gap-3">
            <button
              onClick={generateAnalysis}
              disabled={isGenerating}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium disabled:opacity-50"
            >
              {isGenerating ? 'Regenerating...' : '↻ Regenerate Analysis'}
            </button>
          </div>
        </div>
      )}

      {!analysis && !loading && !error && (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <h4 className="text-lg font-semibold text-gray-900 mb-2">No Analysis Yet</h4>
          <p className="text-gray-600 mb-4 max-w-md mx-auto">
            Get personalized coaching feedback and time-optimized training recommendations based on your activity data.
          </p>
          <button
            onClick={generateAnalysis}
            disabled={isGenerating}
            className="bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 disabled:opacity-50 font-medium"
          >
            {isGenerating ? 'Analyzing...' : 'Generate AI Analysis'}
          </button>
        </div>
      )}
    </div>
  )
}

