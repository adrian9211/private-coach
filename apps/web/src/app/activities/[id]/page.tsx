'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { UserMenu } from '@/components/auth/user-menu'
import { GPSViewer } from '@/components/gps-viewer'
import { RPEFeedback } from '@/components/activities/rpe-feedback'
import { ActivityFeedback } from '@/components/activities/activity-feedback'
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
      calories?: number
      averageCadence?: number
      normalizedPower?: number
      tss?: number
      intensityFactor?: number
      elevation?: number
      name?: string
      type?: string
      trainer?: boolean
    }
    powerZones: any
    heartRateZones: any
    records: any[]
    gps_track?: any[]
  }
  created_at: string
  rpe?: number | null
  feeling?: number | null
  personal_notes?: string | null
  // Fields from Supabase that were missing in type definition
  total_distance?: number
  total_timer_time?: number
  elapsed_time?: number
  avg_speed?: number
  total_calories?: number
  calories?: number
  avg_heart_rate?: number
  max_heart_rate?: number
  avg_power?: number
  max_power?: number
  avg_cadence?: number
  max_cadence?: number
  normalized_power?: number
  tss?: number
  intensity_factor?: number
  elevation_gain?: number
  total_ascent?: number
  sport?: string
  start_time?: string
  trainer?: boolean
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
  const fetchingRef = useRef(false)

  const fetchActivity = useCallback(async () => {
    if (!id) {
      setLoadingActivity(false)
      return
    }

    // Prevent multiple concurrent fetches
    if (fetchingRef.current) {
      console.log('Fetch already in progress, skipping...')
      return
    }

    try {
      fetchingRef.current = true
      setLoadingActivity(true)
      console.log('Fetching activity:', id)
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('id', id)
        .single()

      console.log('Activity fetch result:', { hasData: !!data, error })

      if (error) {
        console.error('Error fetching activity:', error)
        throw error
      }

      if (!data) {
        console.error('No activity data returned')
        setActivity(null)
      } else {
        console.log('Activity data set successfully:', { id: data.id, status: data.status, hasRpe: !!data.rpe, hasFeeling: !!data.feeling, hasNotes: !!data.personal_notes })
        // Only update if activity changed or is null
        setActivity((prev) => {
          if (prev?.id === data.id) {
            console.log('Activity already set, skipping update')
            return prev
          }
          return data
        })
      }
    } catch (error: any) {
      console.error('Error fetching activity:', error)
      setActivity(null)
      // Still clear loading to show error state
    } finally {
      setLoadingActivity(false)
      fetchingRef.current = false
    }
  }, [id])

  // Refetch on tab focus ONLY if we don't have activity data
  useEffect(() => {
    if (!user || !id || activity) return // Don't refetch if we have activity

    const onFocus = () => {
      // Only refetch if we don't have activity and we're not already fetching
      if (!fetchingRef.current && !loadingActivity && !activity) {
        console.log('Tab focus - refetching activity (no activity found)')
        fetchActivity()
      }
    }
    window.addEventListener('focus', onFocus)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !activity) {
        onFocus()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [user, id, fetchActivity, loadingActivity, activity])

  useEffect(() => {
    // Timeout fallback to prevent infinite loading
    const timeoutId = setTimeout(() => {
      if (loadingActivity) {
        console.warn('Activity loading timeout - forcing loading to false')
        setLoadingActivity(false)
        fetchingRef.current = false
      }
    }, 10000) // 10 second timeout

    if (!loading && !user) {
      clearTimeout(timeoutId)
      router.push('/auth/signin')
      return
    }

    // If auth is done loading and we have an id, fetch the activity
    // Only fetch if not already fetching AND we don't already have the activity
    if (!loading && id && !fetchingRef.current && !activity) {
      if (user) {
        console.log('Initial fetch triggered (no activity yet)')
        fetchActivity()
      } else {
        // Auth finished but no user - clear loading
        setLoadingActivity(false)
      }
    } else if (activity) {
      // We have activity, clear loading just in case
      setLoadingActivity(false)
      fetchingRef.current = false
    }

    return () => {
      clearTimeout(timeoutId)
    }
  }, [user, loading, router, id, fetchActivity, activity])

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
    // Ensure we have a valid number and round to nearest second
    const totalSeconds = Math.round(Number(seconds))

    if (isNaN(totalSeconds) || totalSeconds < 0) {
      return '0:00'
    }

    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const secs = totalSeconds % 60

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  const formatDistance = (km: number) => {
    return `${km.toFixed(2)} km`
  }

  const formatSpeed = (speed: number) => {
    // Ensure we have a valid number
    const speedValue = Number(speed)

    if (isNaN(speedValue) || speedValue < 0) {
      return '0.0 km/h'
    }

    // Normal cycling speeds are typically 10-80 km/h
    // If speed > 100, there's likely a unit conversion issue
    let kmh = speedValue

    // If value is unreasonably high (>100), it might be:
    // 1. Already in m/s but stored incorrectly (needs * 3.6)
    // 2. Double-converted (needs / 3.6)
    // 3. Data error

    if (speedValue > 100) {
      // Try dividing first (in case it was double-converted: m/s -> km/h -> km/h again)
      const divided = speedValue / 3.6
      if (divided <= 80 && divided > 0) {
        // This looks like a reasonable speed after dividing - likely double conversion
        kmh = divided
        console.warn('Speed value > 100, dividing by 3.6 (likely double-converted):', speedValue, '->', kmh, 'km/h')
      } else {
        // Try multiplying (in case it's in m/s and wasn't converted)
        const multiplied = speedValue * 3.6
        if (multiplied > 200) {
          // Still too high, try dividing
          kmh = speedValue / 3.6
          console.warn('Speed value > 100, attempting correction:', speedValue, '->', kmh, 'km/h')
        } else {
          kmh = multiplied
        }
      }
    } else if (speedValue > 80 && speedValue <= 100) {
      // Very high but theoretically possible (world record ~89 km/h)
      // Keep as-is
      kmh = speedValue
    }

    // Final safety check - cap at reasonable maximum
    if (kmh > 100) {
      console.error('Speed value still too high after correction:', kmh, 'km/h - using calculated value from distance/duration')
      // Try to calculate from distance and duration if available
      if (activity?.data?.summary) {
        const distance = activity.data.summary.totalDistance // in km
        const duration = activity.data.summary.duration // in seconds
        if (distance > 0 && duration > 0) {
          const calculatedSpeed = (distance / duration) * 3600 // km/h
          if (calculatedSpeed > 0 && calculatedSpeed <= 100) {
            kmh = calculatedSpeed
            console.log('Using calculated speed from distance/duration:', kmh, 'km/h')
          }
        }
      }
      // If still wrong, cap at 100
      if (kmh > 100) {
        kmh = Math.min(kmh, 100)
      }
    }

    return `${kmh.toFixed(1)} km/h`
  }

  const formatPower = (watts: number) => {
    return `${watts}W`
  }

  const formatHeartRate = (bpm: number) => {
    return `${bpm} bpm`
  }

  // Only show loading if auth is loading OR activity is loading (and user exists)
  // Don't get stuck if auth finished but user is null
  if (loading || (loadingActivity && user)) {
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
            {!loading && !user && (
              <p className="mt-2 text-sm text-red-600">Redirecting to sign in...</p>
            )}
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

  // Add safe defaults for Intervals.icu imports and handle missing data
  const safeSummary = summary ? {
    totalDistance: summary.totalDistance || activity.total_distance || 0,
    duration: summary.duration || activity.total_timer_time || activity.elapsed_time || 0,
    avgSpeed: summary.avgSpeed || activity.avg_speed || 0,
    totalCalories: summary.totalCalories || summary.calories || activity.total_calories || activity.calories || 0,
    avgHeartRate: summary.avgHeartRate || activity.avg_heart_rate || 0,
    maxHeartRate: summary.maxHeartRate || activity.max_heart_rate || 0,
    avgPower: summary.avgPower || activity.avg_power || 0,
    maxPower: summary.maxPower || activity.max_power || 0,
    avgCadence: summary.avgCadence || summary.averageCadence || activity.avg_cadence || 0,
    maxCadence: summary.maxCadence || activity.max_cadence || 0,
    normalizedPower: summary.normalizedPower || activity.normalized_power || 0,
    tss: summary.tss || activity.tss || 0,
    intensityFactor: summary.intensityFactor || activity.intensity_factor || 0,
    elevation: summary.elevation || activity.elevation_gain || activity.total_ascent || 0,
    name: summary.name || activity.metadata?.name || activity.file_name,
    type: summary.type || activity.metadata?.type || activity.sport || 'Unknown',
    trainer: summary.trainer !== undefined ? summary.trainer : (activity.trainer || false),
  } : null

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
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {safeSummary?.name || activity.file_name}
              </h2>
              <div className="flex items-center gap-4">
                <p className="text-gray-600">
                  {new Date(activity.start_time || activity.created_at).toLocaleDateString()}
                </p>
                {safeSummary?.type && (
                  <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                    {safeSummary.type}
                  </span>
                )}
                {safeSummary?.trainer && (
                  <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800">
                    Indoor
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 mt-2">
                Uploaded on {new Date(activity.created_at).toLocaleDateString()}
              </p>
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium mt-2 ${activity.status === 'processed'
                ? 'bg-green-100 text-green-800'
                : activity.status === 'processing'
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-gray-100 text-gray-800'
                }`}>
                {activity.status.charAt(0).toUpperCase() + activity.status.slice(1)}
              </span>
              {activity.metadata?.source === 'intervals.icu' && (
                <span className="inline-block px-3 py-1 rounded-full text-sm font-medium mt-2 ml-2 bg-indigo-100 text-indigo-800">
                  Synced from Intervals.icu
                </span>
              )}
            </div>
          </div>
        </div>

        {activity.status === 'processed' && safeSummary && (
          <>
            {/* Tabs */}
            <div className="bg-white rounded-lg shadow-lg mb-6">
              <div className="border-b border-gray-200">
                <nav className="flex -mb-px">
                  <button
                    onClick={() => setActiveTab('overview')}
                    className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'overview'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                  >
                    Overview
                  </button>
                  <button
                    onClick={() => setActiveTab('analysis')}
                    className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'analysis'
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
                      {formatDistance(safeSummary.totalDistance)}
                    </div>
                    <div className="text-gray-600">Distance</div>
                  </div>

                  <div className="bg-white rounded-lg shadow-lg p-6 text-center">
                    <div className="text-3xl font-bold text-green-600 mb-2">
                      {formatDuration(safeSummary.duration)}
                    </div>
                    <div className="text-gray-600">Duration</div>
                  </div>

                  <div className="bg-white rounded-lg shadow-lg p-6 text-center">
                    <div className="text-3xl font-bold text-purple-600 mb-2">
                      {formatSpeed(safeSummary.avgSpeed)}
                    </div>
                    <div className="text-gray-600">Avg Speed</div>
                  </div>

                  <div className="bg-white rounded-lg shadow-lg p-6 text-center">
                    <div className="text-3xl font-bold text-red-600 mb-2">
                      {safeSummary.totalCalories}
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
                          {formatPower(safeSummary.avgPower)}
                        </div>
                        <div className="text-sm text-gray-600">Avg Power</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-orange-600 mb-1">
                          {formatPower(safeSummary.maxPower)}
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
                          {formatHeartRate(safeSummary.avgHeartRate)}
                        </div>
                        <div className="text-sm text-gray-600">Avg HR</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-red-600 mb-1">
                          {formatHeartRate(safeSummary.maxHeartRate)}
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
                        {safeSummary.avgCadence}
                      </div>
                      <div className="text-sm text-gray-600">Avg Cadence</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-indigo-600 mb-1">
                        {safeSummary.maxCadence}
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

                {/* Activity Feedback (Feeling + Personal Notes) */}
                {activity.status === 'processed' && (
                  <div className="mb-8">
                    <ActivityFeedback
                      activityId={activity.id}
                      initialFeeling={activity.feeling}
                      initialNotes={activity.personal_notes}
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


