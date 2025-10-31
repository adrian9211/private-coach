'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { UserMenu } from '@/components/auth/user-menu'
import { GPSViewer } from '@/components/gps-viewer'

interface ActivityData {
  id: string
  file_name: string
  status: string
  metadata: any
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
  }
  created_at: string
}

export default function ActivityDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const { user, loading } = useAuth()
  const [activity, setActivity] = useState<ActivityData | null>(null)
  const [loadingActivity, setLoadingActivity] = useState(true)

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/signin')
    }
  }, [user, loading, router])

  useEffect(() => {
    if (user && id) {
      fetchActivity()
    }
  }, [user, id])

  const fetchActivity = async () => {
    try {
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
  }

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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading activity...</p>
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
            onClick={() => router.push('/activities')}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
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
      <nav className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.push('/activities')}
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              ← Back to Activities
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
          </>
        )}

        {activity.status === 'processing' && (
          <div className="bg-white rounded-lg shadow-lg p-6 text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Processing Activity</h2>
            <p className="text-gray-600">Your FIT file is being processed. This may take a few moments.</p>
          </div>
        )}

        {/* GPS Track Viewer */}
        {activity.status === 'processed' && (
          <div className="mt-8">
            <GPSViewer activityId={activity.id} />
          </div>
        )}
      </div>
    </div>
  )
}


