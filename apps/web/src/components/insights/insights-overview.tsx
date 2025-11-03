'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { format } from 'date-fns'

interface InsightsOverviewProps {
  userId: string
  userFtp: number | null
  userWeight: number | null
  userVo2Max: number | null
  trainingGoals: string | null
  weeklyHours: number | null
}

export function InsightsOverview({
  userId,
  userFtp,
  userWeight,
  userVo2Max,
  trainingGoals,
  weeklyHours,
}: InsightsOverviewProps) {
  const [stats, setStats] = useState({
    totalActivities: 0,
    totalDistance: 0,
    totalTime: 0,
    avgPower: 0,
    avgHeartRate: 0,
    recentActivities: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      if (!userId) return

      try {
        setLoading(true)
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

        // Get total stats
        const { data: allActivities, error } = await supabase
          .from('activities')
          .select('total_distance, total_timer_time, avg_power, avg_heart_rate, start_time')
          .eq('user_id', userId)
          .eq('status', 'processed')

        if (error) {
          console.error('Error fetching stats:', error)
          return
        }

        const activities = allActivities || []
        const recent = activities.filter(
          (a) => a.start_time && new Date(a.start_time) >= thirtyDaysAgo
        )

        const totalDistance = activities.reduce((sum, a) => sum + (a.total_distance || 0), 0)
        const totalTime = activities.reduce((sum, a) => sum + (a.total_timer_time || 0), 0)
        const activitiesWithPower = activities.filter((a) => a.avg_power && a.avg_power > 0)
        const avgPower =
          activitiesWithPower.length > 0
            ? activitiesWithPower.reduce((sum, a) => sum + (a.avg_power || 0), 0) /
              activitiesWithPower.length
            : 0
        const activitiesWithHR = activities.filter((a) => a.avg_heart_rate && a.avg_heart_rate > 0)
        const avgHeartRate =
          activitiesWithHR.length > 0
            ? activitiesWithHR.reduce((sum, a) => sum + (a.avg_heart_rate || 0), 0) /
              activitiesWithHR.length
            : 0

        setStats({
          totalActivities: activities.length,
          totalDistance: totalDistance / 1000, // Convert to km
          totalTime,
          avgPower: Math.round(avgPower),
          avgHeartRate: Math.round(avgHeartRate),
          recentActivities: recent.length,
        })
      } catch (err) {
        console.error('Error fetching overview stats:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [userId])

  const ftpPerKg =
    userFtp && userWeight && userFtp > 0 && userWeight > 0
      ? (userFtp / userWeight).toFixed(2)
      : null

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }
    return `${minutes}m`
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Performance Overview</h2>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="text-sm text-gray-600 mb-1">Total Activities</div>
          <div className="text-2xl font-bold text-blue-600">{stats.totalActivities}</div>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <div className="text-sm text-gray-600 mb-1">Total Distance</div>
          <div className="text-2xl font-bold text-green-600">
            {stats.totalDistance.toFixed(0)} km
          </div>
        </div>
        <div className="bg-purple-50 rounded-lg p-4">
          <div className="text-sm text-gray-600 mb-1">Total Time</div>
          <div className="text-2xl font-bold text-purple-600">
            {formatDuration(stats.totalTime)}
          </div>
        </div>
        <div className="bg-orange-50 rounded-lg p-4">
          <div className="text-sm text-gray-600 mb-1">Last 30 Days</div>
          <div className="text-2xl font-bold text-orange-600">{stats.recentActivities}</div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Performance Metrics</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Avg Power:</span>
              <span className="font-semibold">
                {stats.avgPower > 0 ? `${stats.avgPower}W` : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Avg Heart Rate:</span>
              <span className="font-semibold">
                {stats.avgHeartRate > 0 ? `${stats.avgHeartRate} bpm` : 'N/A'}
              </span>
            </div>
            {userFtp && (
              <div className="flex justify-between">
                <span className="text-gray-600">FTP:</span>
                <span className="font-semibold">{userFtp}W</span>
              </div>
            )}
            {ftpPerKg && (
              <div className="flex justify-between">
                <span className="text-gray-600">FTP/kg:</span>
                <span className="font-semibold text-blue-600">{ftpPerKg} W/kg</span>
              </div>
            )}
            {userVo2Max && (
              <div className="flex justify-between">
                <span className="text-gray-600">VO2 Max:</span>
                <span className="font-semibold">{userVo2Max} ml/kg/min</span>
              </div>
            )}
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Training Context</h3>
          <div className="space-y-2">
            {trainingGoals && (
              <div>
                <div className="text-gray-600 mb-1">Goals:</div>
                <div className="text-sm text-gray-800">{trainingGoals}</div>
              </div>
            )}
            {weeklyHours && (
              <div className="flex justify-between">
                <span className="text-gray-600">Training Time:</span>
                <span className="font-semibold">{weeklyHours} hours/week</span>
              </div>
            )}
            {!trainingGoals && !weeklyHours && (
              <div className="text-sm text-gray-500 italic">
                Set your goals and training availability in Settings to get personalized
                recommendations.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

