'use client'

import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { Database } from '@/lib/supabase-types'

type Activity = Database['public']['Tables']['activities']['Row']
type ActivitySummary = Database['public']['Views']['activity_summaries']['Row']

interface DashboardOverviewProps {
  summary: ActivitySummary;
  recentActivities: Activity[];
}

export function DashboardOverview({ summary, recentActivities }: DashboardOverviewProps) {
  const router = useRouter()

  const formatDuration = (seconds: number | null): string => {
    if (seconds === null) return '0m'
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }
    return `${minutes}m`
  }

  const formatDistance = (km: number | null): string => {
    if (km === null) return '0.0 km'
    if (km >= 1000) {
      return `${(km / 1000).toFixed(1)}k km`
    }
    return `${km.toFixed(1)} km`
  }

  // This check is for a brand new user with no activities at all.
  if (summary.total_activities === 0 && (!recentActivities || recentActivities.length === 0)) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6 text-center">
        <p className="text-gray-600">No activity data available. Upload your first activity to get started!</p>
        <button
          onClick={() => router.push('/upload')}
          className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 font-medium"
        >
          Upload Activity
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Distance</p>
              <p className="text-3xl font-bold text-blue-600">{formatDistance(summary.total_distance)}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Time</p>
              <p className="text-3xl font-bold text-green-600">{formatDuration(summary.total_duration)}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg Power</p>
              <p className="text-3xl font-bold text-orange-600">{Math.round(summary.avg_power || 0)}W</p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Activities</p>
              <p className="text-3xl font-bold text-purple-600">{summary.total_activities}</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activities */}
      {recentActivities && recentActivities.length > 0 && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Recent Activities</h2>
            <button
              onClick={() => router.push('/activities')}
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              View All
            </button>
          </div>
          
          <div className="space-y-4">
            {recentActivities.map((activity) => (
              <div 
                key={activity.id} 
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                onClick={() => router.push(`/activities/${activity.id}`)}
              >
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-4">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">{activity.file_name}</h3>
                    <p className="text-sm text-gray-600">
                      {activity.upload_date ? format(new Date(activity.upload_date), 'PP') : 'N/A'}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-6 text-sm">
                  <div className="text-center">
                    <div className="font-semibold text-blue-600">
                      {(activity.total_distance || 0).toFixed(1)} km
                    </div>
                    <div className="text-gray-500">Distance</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-green-600">
                      {formatDuration(activity.total_timer_time || 0)}
                    </div>
                    <div className="text-gray-500">Duration</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-orange-600">
                      {Math.round(activity.avg_power || 0)}W
                    </div>
                    <div className="text-gray-500">Avg Power</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}


