'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { format, startOfDay } from 'date-fns'

interface PerformanceTrendsProps {
  userId: string
  userFtp: number | null
  userWeight: number | null
}

interface TrendDataPoint {
  date: string
  avgPower: number
  avgPowerPercent: number
  ftpPerKg?: number
  activityCount: number
}

export function PerformanceTrends({ userId, userFtp, userWeight }: PerformanceTrendsProps) {
  const [trendData, setTrendData] = useState<TrendDataPoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchTrends = async () => {
      if (!userId) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        const { data: activities, error } = await supabase
          .from('activities')
          .select('start_time, upload_date, avg_power')
          .eq('user_id', userId)
          .eq('status', 'processed')
          .not('avg_power', 'is', null)
          .gt('avg_power', 0)
          .order('start_time', { ascending: true, nullsFirst: true })
          .order('upload_date', { ascending: true })

        if (error) {
          console.error('Error fetching trends:', error)
          return
        }

        // Group by week
        const weeklyData: Record<string, { powers: number[]; count: number }> = {}

        activities?.forEach((activity) => {
          const date = activity.start_time || activity.upload_date
          if (!date) return

          const activityDate = new Date(date)
          const weekStart = format(startOfDay(activityDate), 'yyyy-MM-dd')
          // Use week of year with literal W, e.g., 2025-W45
          const weekKey = format(activityDate, "yyyy-'W'ww")

          if (!weeklyData[weekKey]) {
            weeklyData[weekKey] = { powers: [], count: 0 }
          }
          weeklyData[weekKey].powers.push(activity.avg_power || 0)
          weeklyData[weekKey].count++
        })

        // Convert to array and calculate averages
        const trends: TrendDataPoint[] = Object.entries(weeklyData)
          .map(([weekKey, data]) => {
            const avgPower = data.powers.reduce((sum, p) => sum + p, 0) / data.powers.length
            const avgPowerPercent =
              userFtp && userFtp > 0 ? (avgPower / userFtp) * 100 : 0

            return {
              date: weekKey,
              avgPower: Math.round(avgPower),
              avgPowerPercent: Math.round(avgPowerPercent * 10) / 10,
              ftpPerKg:
                userFtp && userWeight && userFtp > 0 && userWeight > 0
                  ? Number((userFtp / userWeight).toFixed(2))
                  : undefined,
              activityCount: data.count,
            }
          })
          .sort((a, b) => a.date.localeCompare(b.date))

        setTrendData(trends)
      } catch (err) {
        console.error('Error calculating trends:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchTrends()
  }, [userId, userFtp, userWeight])

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  if (trendData.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Performance Trends</h2>
        <div className="bg-gray-50 rounded-lg p-4 text-center text-gray-500">
          Not enough data to show trends. Complete more activities with power data.
        </div>
      </div>
    )
  }

  const latest = trendData[trendData.length - 1]
  const previous = trendData.length > 1 ? trendData[trendData.length - 2] : null
  const powerTrend = previous
    ? ((latest.avgPower - previous.avgPower) / previous.avgPower) * 100
    : 0

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Performance Trends</h2>

      {/* Current Performance */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-purple-50 rounded-lg p-4">
          <div className="text-sm text-gray-600 mb-1">Current Avg Power</div>
          <div className="text-3xl font-bold text-purple-600">{latest.avgPower}W</div>
          {userFtp && (
            <div className="text-sm text-gray-500 mt-1">
              {latest.avgPowerPercent}% of FTP
            </div>
          )}
        </div>
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="text-sm text-gray-600 mb-1">Trend</div>
          <div
            className={`text-3xl font-bold ${
              powerTrend > 0 ? 'text-green-600' : powerTrend < 0 ? 'text-red-600' : 'text-gray-600'
            }`}
          >
            {powerTrend > 0 ? '↑' : powerTrend < 0 ? '↓' : '→'} {Math.abs(powerTrend).toFixed(1)}%
          </div>
          <div className="text-sm text-gray-500 mt-1">vs previous week</div>
        </div>
        {latest.ftpPerKg && (
          <div className="bg-green-50 rounded-lg p-4">
            <div className="text-sm text-gray-600 mb-1">FTP/kg</div>
            <div className="text-3xl font-bold text-green-600">{latest.ftpPerKg} W/kg</div>
            <div className="text-sm text-gray-500 mt-1">Power-to-weight ratio</div>
          </div>
        )}
      </div>

      {/* Weekly Activity Count */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Weekly Activity Count</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {trendData.slice(-12).map((week) => (
            <div key={week.date} className="text-center">
              <div className="text-xs text-gray-500 mb-1">{week.date}</div>
              <div className="text-lg font-bold text-blue-600">{week.activityCount}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Insights */}
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
        <h3 className="font-semibold text-purple-900 mb-2">Performance Insights:</h3>
        <ul className="text-sm text-purple-800 space-y-1 list-disc list-inside">
          <li>
            Average power is{' '}
            {userFtp
              ? `${latest.avgPowerPercent}% of your FTP`
              : 'tracked over time'}
            .
          </li>
          {powerTrend > 5 && (
            <li className="text-green-700 font-semibold">
              ✓ Strong upward trend! Your power is improving.
            </li>
          )}
          {powerTrend < -5 && (
            <li className="text-yellow-700 font-semibold">
              ⚠ Power is declining. Consider recovery or training adjustments.
            </li>
          )}
          {Math.abs(powerTrend) <= 5 && (
            <li>Power is stable. Consistent training is building your base.</li>
          )}
          {latest.ftpPerKg && (
            <li>
              Your FTP/kg ratio of {latest.ftpPerKg} W/kg indicates{' '}
              {latest.ftpPerKg >= 4.0
                ? 'excellent'
                : latest.ftpPerKg >= 3.5
                  ? 'good'
                  : latest.ftpPerKg >= 3.0
                    ? 'moderate'
                    : 'developing'}{' '}
              power-to-weight performance.
            </li>
          )}
        </ul>
      </div>
    </div>
  )
}

