'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface ActivityDetailProps {
  activityId: string
}

export function ActivityDetail({ activityId }: ActivityDetailProps) {
  const { user } = useAuth()
  const router = useRouter()
  const [activity, setActivity] = useState<any>(null)
  const [analysis, setAnalysis] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDecoding, setIsDecoding] = useState(false)

  useEffect(() => {
    if (user) {
      fetchActivityDetails()
    }
  }, [user, activityId])

  const fetchActivityDetails = async () => {
    try {
      setLoading(true)
      
      // Fetch activity data
      const { data: activityData, error: activityError } = await supabase
        .from('activities')
        .select('*')
        .eq('id', activityId)
        .eq('user_id', user?.id)
        .single()

      if (activityError) {
        throw activityError
      }

      setActivity(activityData)

      // Fetch analysis if available
      if (activityData.status === 'processed') {
        const { data: analysisData, error: analysisError } = await supabase
          .from('activity_analyses')
          .select('*')
          .eq('activity_id', activityId)
          .single()

        if (!analysisError && analysisData) {
          setAnalysis(analysisData)
        }
      }

    } catch (err) {
      console.error('Error fetching activity details:', err)
      setError('Failed to load activity details')
    } finally {
      setLoading(false)
    }
  }

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  const formatDistance = (meters: number): string => {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(2)} km`
    }
    return `${meters.toFixed(0)} m`
  }

  const formatSpeed = (mps: number): string => {
    const kmh = mps * 3.6
    return `${kmh.toFixed(1)} km/h`
  }

  const handleDecodeToCsv = async () => {
    setIsDecoding(true)
    try {
      const { data, error } = await supabase.functions.invoke('decode-activity', {
        body: { activityId },
      })

      if (error) throw error

      // Combine CSV sections into one file
      let combinedCsv = ''
      for (const section in data) {
        combinedCsv += `--- ${section.toUpperCase()} ---\n`
        combinedCsv += data[section]
        combinedCsv += '\n\n'
      }

      // Trigger download
      const blob = new Blob([combinedCsv], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      if (link.href) {
        URL.revokeObjectURL(link.href)
      }
      const url = URL.createObjectURL(blob)
      link.href = url
      link.setAttribute('download', `${activity.file_name}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

    } catch (err) {
      console.error('Error decoding file:', err)
      setError('Failed to decode FIT file.')
    } finally {
      setIsDecoding(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading activity details...</span>
      </div>
    )
  }

  if (error || !activity) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        {error || 'Activity not found'}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Activity Header */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900">{activity.file_name}</h2>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            activity.status === 'processed' ? 'bg-green-100 text-green-800' :
            activity.status === 'processing' ? 'bg-yellow-100 text-yellow-800' :
            activity.status === 'failed' ? 'bg-red-100 text-red-800' :
            'bg-blue-100 text-blue-800'
          }`}>
            {activity.status.charAt(0).toUpperCase() + activity.status.slice(1)}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {activity.metadata?.totalDistance ? formatDistance(activity.metadata.totalDistance) : '-'}
            </div>
            <div className="text-sm text-gray-600">Distance</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {activity.metadata?.totalTime ? formatDuration(activity.metadata.totalTime) : '-'}
            </div>
            <div className="text-sm text-gray-600">Duration</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {activity.metadata?.avgSpeed ? formatSpeed(activity.metadata.avgSpeed) : '-'}
            </div>
            <div className="text-sm text-gray-600">Avg Speed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">
              {activity.metadata?.avgPower ? `${activity.metadata.avgPower}W` : '-'}
            </div>
            <div className="text-sm text-gray-600">Avg Power</div>
          </div>
        </div>
      </div>

      {/* AI Analysis */}
      {analysis && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">AI Analysis</h3>
          
          <div className="prose max-w-none">
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <h4 className="font-semibold text-gray-900 mb-2">Summary</h4>
              <p className="text-gray-700 whitespace-pre-wrap">{analysis.summary}</p>
            </div>

            {analysis.insights && analysis.insights.length > 0 && (
              <div className="mb-4">
                <h4 className="font-semibold text-gray-900 mb-2">Key Insights</h4>
                <ul className="list-disc list-inside space-y-1">
                  {analysis.insights.map((insight: string, index: number) => (
                    <li key={index} className="text-gray-700">{insight}</li>
                  ))}
                </ul>
              </div>
            )}

            {analysis.recommendations && analysis.recommendations.length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Recommendations</h4>
                <div className="space-y-3">
                  {analysis.recommendations.map((rec: any, index: number) => (
                    <div key={index} className="bg-blue-50 rounded-lg p-4">
                      <h5 className="font-medium text-blue-900">{rec.type}</h5>
                      <p className="text-blue-700">{rec.description}</p>
                      {rec.rationale && (
                        <p className="text-blue-600 text-sm mt-2">{rec.rationale}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Raw Data (for debugging) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Raw Data (Development)</h3>
          <pre className="bg-gray-100 p-4 rounded-lg overflow-auto text-sm">
            {JSON.stringify(activity, null, 2)}
          </pre>
        </div>
      )}
      <div className="mt-6">
        <button
          onClick={handleDecodeToCsv}
          disabled={isDecoding}
          className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300 disabled:opacity-50"
        >
          {isDecoding ? 'Decoding...' : 'Decode to CSV'}
        </button>
      </div>
    </div>
  )
}

