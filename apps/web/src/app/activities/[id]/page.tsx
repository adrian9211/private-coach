'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { UserMenu } from '@/components/auth/user-menu'
import { GPSViewer } from '@/components/gps-viewer'
import { RPEFeedback } from '@/components/activities/rpe-feedback'
import { AIAnalysisTab } from '@/components/activities/ai-analysis-tab'
import { PowerZoneAnalysis } from '@/components/activities/power-zone-analysis'

interface ActivityData {
  id: string
  file_name: string
  status: string
  metadata: any
  gps_track?: any[] | null
  data: {
    summary: {
      totalDistance: number
      duration: number
      avgSpeed: number
      totalCalories: number
      avgHeartRate: number
      maxHeartRate: number
      avgPower: number
      maxPower: number
      avgCadence: number
      maxCadence: number
    }
    powerZones: any
    heartRateZones: any
    records: any[]
    gps_track?: any[]
  }
  created_at: string
  rpe?: number | null
}

export default function ActivityDetailPage() {
  const params = useParams()
  const id = Array.isArray(params.id) ? params.id[0] : params.id
  const router = useRouter()
  const { user, loading } = useAuth()
  const [activity, setActivity] = useState<ActivityData | null>(null)
  const [loadingActivity, setLoadingActivity] = useState(true)
  const [isNavigating, setIsNavigating] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'analysis'>('overview')
  const [ftp, setFtp] = useState<number | null>(null)

  const fetchActivity = useCallback(async () => {
    if (!id) return
    
    try {
      setLoadingActivity(true)
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error
      setActivity(data)
    } catch (error) {
      console.error('Error fetching activity:', error)
    } finally {
      setLoadingActivity(false)
    }
  }, [id])

  // Refetch on tab focus to avoid stale loading
  useEffect(() => {
    const onFocus = () => {
      if (user && id) {
        fetchActivity()
      }
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') onFocus()
    })
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus as any)
    }
  }, [user, id, fetchActivity])

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/signin')
    }
  }, [user, loading, router])

  useEffect(() => {
    if (user && id) {
      fetchActivity()
    }
  }, [user, id, fetchActivity])

  useEffect(() => {
    const fetchFtp = async () => {
      if (!user) return
      try {
        const { data, error } = await supabase
          .from('users')
          .select('preferences')
          .eq('id', user.id)
          .maybeSingle()
        if (error) throw error
        const prefs = data?.preferences || {}
        if (prefs.ftp && typeof prefs.ftp === 'number') {
          setFtp(prefs.ftp)
        }
      } catch (e) {
        console.warn('Error fetching FTP:', e)
      }
    }
    if (user) {
      fetchFtp()
    }
  }, [user])

  const handleBackNavigation = useCallback((e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    
    if (isNavigating) return // Prevent multiple clicks
    
    setIsNavigating(true)
    
    try {
      // Try router.push first (preferred for Next.js)
      router.push('/activities')
    } catch (error) {
      console.error('Router navigation failed, using window.location:', error)
      // Fallback to window.location if router.push fails
      window.location.href = '/activities'
    }
  }, [router, isNavigating])

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  const formatDistance = (km: number) => {
    return `${km.toFixed(2)} km`
  }

  const formatSpeed = (kmh: number) => {
    return `${kmh.toFixed(1)} km/h`
  }

  const formatPower = (watts: number) => {
    return `${watts}W`
  }

  const formatHeartRate = (bpm: number) => {
    return `${bpm} bpm`
  }

  if (loading || loadingActivity) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        {/* Keep navbar visible */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={handleBackNavigation}
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              ← Home
            </button>
            <div className="text-sm text-gray-500">Loading activity…</div>
          </div>
        </div>
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading activity...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!activity) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Activity Not Found</h1>
          <button
            onClick={handleBackNavigation}
            className="inline-block bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
          >
            Back to Activities
          </button>
        </div>
      </div>
    )
  }

  const { summary, powerZones, heartRateZones } = activity.data || {}

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Navigation */}
      <nav className="bg-white shadow-sm relative z-[100]" style={{ pointerEvents: 'auto' }}>
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <button
              type="button"
              onClick={handleBackNavigation}
              className="text-blue-600 hover:text-blue-800 font-medium transition-colors relative z-[101] cursor-pointer"
              style={{ pointerEvents: 'auto' }}
              disabled={isNavigating}
            >
              {isNavigating ? 'Loading...' : '← Back to Activities'}
            </button>
            <h1 className="text-xl font-bold text-gray-900">Activity Details</h1>
          </div>
          <UserMenu />
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        {/* Activity Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-600">
                Uploaded on {new Date(activity.created_at).toLocaleDateString()}
              </p>
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium mt-2 ${
                activity.status === 'processed' 
                  ? 'bg-green-100 text-green-800' 
                  : activity.status === 'processing'
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {activity.status.charAt(0).toUpperCase() + activity.status.slice(1)}
              </span>
            </div>
          </div>
        </div>

        {activity.status === 'processed' && summary && (
          <>
            {/* Tabs */}
            <div className="bg-white rounded-lg shadow-lg mb-6">
              <div className="border-b border-gray-200">
                <nav className="flex -mb-px">
                  <button
                    onClick={() => setActiveTab('overview')}
                    className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === 'overview'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Overview
                  </button>
                  <button
                    onClick={() => setActiveTab('analysis')}
                    className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === 'analysis'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    AI Coach Analysis
                  </button>
                </nav>
              </div>
            </div>

            {/* Tab Content */}
            {activeTab === 'overview' && (
              <>
            {/* Key Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-lg shadow-lg p-6 text-center">
                <div className="text-3xl font-bold text-blue-600 mb-2">
                  {formatDistance(summary.totalDistance)}
                </div>
                <div className="text-gray-600">Distance</div>
              </div>
              
              <div className="bg-white rounded-lg shadow-lg p-6 text-center">
                <div className="text-3xl font-bold text-green-600 mb-2">
                  {formatDuration(summary.duration)}
                </div>
                <div className="text-gray-600">Duration</div>
              </div>
              
              <div className="bg-white rounded-lg shadow-lg p-6 text-center">
                <div className="text-3xl font-bold text-purple-600 mb-2">
                  {formatSpeed(summary.avgSpeed)}
                </div>
                <div className="text-gray-600">Avg Speed</div>
              </div>
              
              <div className="bg-white rounded-lg shadow-lg p-6 text-center">
                <div className="text-3xl font-bold text-red-600 mb-2">
                  {summary.totalCalories}
                </div>
                <div className="text-gray-600">Calories</div>
              </div>
            </div>

            {/* Power and Heart Rate Metrics */}
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              {/* Power Metrics */}
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Power Metrics</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600 mb-1">
                      {formatPower(summary.avgPower)}
                    </div>
                    <div className="text-sm text-gray-600">Avg Power</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600 mb-1">
                      {formatPower(summary.maxPower)}
                    </div>
                    <div className="text-sm text-gray-600">Max Power</div>
                  </div>
                </div>
                
                {/* Power Zones */}
                {powerZones && (
                  <div className="mt-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Power Zones</h3>
                    <div className="space-y-2">
                      {Object.entries(powerZones).map(([zone, data]: [string, any]) => (
                        <div key={zone} className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700">{data.label}</span>
                          <span className="text-sm text-gray-600">
                            {Math.round(data.min)}-{data.max === Infinity ? '∞' : Math.round(data.max)}W
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Heart Rate Metrics */}
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Heart Rate Metrics</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600 mb-1">
                      {formatHeartRate(summary.avgHeartRate)}
                    </div>
                    <div className="text-sm text-gray-600">Avg HR</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600 mb-1">
                      {formatHeartRate(summary.maxHeartRate)}
                    </div>
                    <div className="text-sm text-gray-600">Max HR</div>
                  </div>
                </div>
                
                {/* Heart Rate Zones */}
                {heartRateZones && (
                  <div className="mt-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Heart Rate Zones</h3>
                    <div className="space-y-2">
                      {Object.entries(heartRateZones).map(([zone, data]: [string, any]) => (
                        <div key={zone} className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700">{data.label}</span>
                          <span className="text-sm text-gray-600">
                            {Math.round(data.min)}-{Math.round(data.max)} bpm
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Cadence Metrics */}
            <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Cadence Metrics</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-indigo-600 mb-1">
                    {summary.avgCadence}
                  </div>
                  <div className="text-sm text-gray-600">Avg Cadence</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-indigo-600 mb-1">
                    {summary.maxCadence}
                  </div>
                  <div className="text-sm text-gray-600">Max Cadence</div>
                </div>
              </div>
            </div>

            {/* Power Zone Analysis */}
            {activity.status === 'processed' && (activity.gps_track || activity.data?.gps_track || activity.data?.records) && (
              <div className="mb-8">
                <PowerZoneAnalysis activity={activity as any} ftp={ftp} />
              </div>
            )}

            {/* RPE Feedback */}
            {activity.status === 'processed' && (
              <div className="mb-8">
                <RPEFeedback 
                  activityId={activity.id} 
                  initialRPE={activity.rpe}
                />
              </div>
            )}

            {/* GPS Track Viewer */}
            {activity.status === 'processed' && (
              <div className="mt-8">
                <GPSViewer activityId={activity.id} />
              </div>
            )}
              </>
            )}

            {activeTab === 'analysis' && (
              <AIAnalysisTab activityId={activity.id} activity={activity} />
            )}
          </>
        )}

        {activity.status === 'processing' && (
          <div className="bg-white rounded-lg shadow-lg p-6 text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Processing Activity</h2>
            <p className="text-gray-600">Your FIT file is being processed. This may take a few moments.</p>
          </div>
        )}
      </div>
    </div>
  )
}


