'use client'

import { useMemo } from 'react'
import { startOfWeek, endOfWeek, eachWeekOfInterval, format, isSameWeek, startOfMonth, endOfMonth } from 'date-fns'
import { Database } from '@/lib/supabase-types'

type Activity = Database['public']['Tables']['activities']['Row']

interface WeeklySummaryProps {
  activities: Activity[]
  currentMonth: Date
  userId: string
  userFtp?: number | null
}

interface WeekSummary {
  weekStart: Date
  weekEnd: Date
  weekNumber: number
  totalTime: number // seconds
  totalDistance: number // km
  totalCalories: number
  totalTSS: number
  avgPower: number
  activityCount: number
}

// Calculate TSS (Training Stress Score)
// TSS = (duration in hours) × IF² × 100
// IF (Intensity Factor) = Normalized Power / FTP
// If no normalized power, use average power as fallback
function calculateTSS(duration: number, power: number, ftp: number): number {
  if (!ftp || ftp <= 0 || !power || power <= 0 || !duration || duration <= 0) {
    return 0
  }
  
  const intensityFactor = power / ftp
  const durationHours = duration / 3600
  const tss = durationHours * intensityFactor * intensityFactor * 100
  
  return Math.round(tss)
}

export function WeeklySummary({ activities, currentMonth, userId, userFtp }: WeeklySummaryProps) {
  // Get all weeks in the current month view
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  
  const weeks = useMemo(() => {
    return eachWeekOfInterval(
      { start: calendarStart, end: calendarEnd },
      { weekStartsOn: 1 }
    )
  }, [calendarStart, calendarEnd])

  // Calculate weekly summaries
  const weeklySummaries = useMemo(() => {
    const summaries: WeekSummary[] = []

    weeks.forEach((weekStart, index) => {
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 })
      
      // Find activities in this week
      const weekActivities = activities.filter((activity) => {
        const activityDate = activity.start_time
          ? new Date(activity.start_time)
          : activity.upload_date
            ? new Date(activity.upload_date)
            : null
        
        if (!activityDate) return false
        
        return activityDate >= weekStart && activityDate <= weekEnd
      })

      let totalTime = 0
      let totalDistance = 0
      let totalCalories = 0
      let totalTSS = 0
      let totalPower = 0
      let powerCount = 0

      weekActivities.forEach((activity) => {
        const summary = activity.data?.summary || {}
        
        // Duration
        const duration = activity.total_timer_time || summary.duration || 0
        totalTime += duration

        // Distance
        const distance = activity.total_distance || summary.totalDistance || 0
        totalDistance += distance

        // Calories
        const calories = activity.total_calories || summary.totalCalories || 0
        totalCalories += calories

        // Power and TSS
        const power = activity.avg_power || summary.avgPower || 0
        if (power > 0) {
          totalPower += power
          powerCount++
          
          // Calculate TSS if FTP is available
          if (userFtp && duration > 0) {
            const normalizedPower = summary.normalizedPower || power // Use normalized power if available, else avg power
            totalTSS += calculateTSS(duration, normalizedPower, userFtp)
          }
        }
      })

      const avgPower = powerCount > 0 ? Math.round(totalPower / powerCount) : 0

      summaries.push({
        weekStart,
        weekEnd,
        weekNumber: index + 1,
        totalTime,
        totalDistance,
        totalCalories,
        totalTSS,
        avgPower,
        activityCount: weekActivities.length
      })
    })

    return summaries
  }, [weeks, activities, userFtp])

  const formatDuration = (seconds: number): string => {
    if (seconds === 0) return '0m'
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    
    if (hours > 0) {
      return `${hours}h${minutes > 0 ? `${minutes}m` : ''}`
    }
    return `${minutes}m`
  }

  const formatDistance = (km: number): string => {
    if (km === 0) return '-'
    if (km >= 1000) {
      return `${(km / 1000).toFixed(1)}k km`
    }
    return `${km.toFixed(0)} km`
  }

  // Calculate week number (ISO week)
  const getWeekNumber = (date: Date): number => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
    const dayNum = d.getUTCDay() || 7
    d.setUTCDate(d.getUTCDate() + 4 - dayNum)
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  }

  if (weeklySummaries.length === 0) {
    return null
  }

  return (
    <div className="w-full sm:w-48 lg:w-56 flex-shrink-0">
      {/* Header - Only show on larger screens */}
      <div className="mb-4 hidden sm:block">
        <h3 className="text-sm font-semibold text-gray-700 mb-1">Weekly Summary</h3>
        {userFtp ? (
          <p className="text-xs text-gray-500">TSS based on FTP: {userFtp}W</p>
        ) : (
          <p className="text-xs text-yellow-600">Set FTP in Settings to see TSS</p>
        )}
      </div>

      {/* Week summaries */}
      <div className="space-y-3 sm:space-y-4">
        {weeklySummaries.map((week) => {
          const weekNum = getWeekNumber(week.weekStart)
          const isCurrentWeek = isSameWeek(week.weekStart, new Date(), { weekStartsOn: 1 })

          return (
            <div
              key={week.weekStart.toISOString()}
              className={`
                bg-gray-50 rounded-lg p-2.5 sm:p-3 border
                ${isCurrentWeek ? 'border-blue-400 bg-blue-50 shadow-sm' : 'border-gray-200'}
              `}
            >
              {/* Week header */}
              <div className="mb-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs sm:text-sm font-semibold text-gray-700">
                    Week {weekNum}
                  </span>
                  {isCurrentWeek && (
                    <span className="text-[10px] sm:text-xs text-blue-600 font-medium bg-blue-100 px-1.5 py-0.5 rounded">
                      Current
                    </span>
                  )}
                </div>
                <div className="text-[9px] sm:text-[10px] text-gray-500">
                  {format(week.weekStart, 'MMM d')} - {format(week.weekEnd, 'MMM d')}
                </div>
              </div>

              {/* Metrics */}
              <div className="space-y-1 sm:space-y-1.5">
                {/* Total Time */}
                <div className="flex items-center justify-between text-[10px] sm:text-xs">
                  <span className="text-gray-600">Total:</span>
                  <span className="font-semibold text-gray-900">
                    {formatDuration(week.totalTime)}
                  </span>
                </div>

                {/* Distance */}
                {week.totalDistance > 0 && (
                  <div className="flex items-center justify-between text-[10px] sm:text-xs">
                    <span className="text-gray-600">Dist:</span>
                    <span className="font-medium text-blue-600">
                      {formatDistance(week.totalDistance)}
                    </span>
                  </div>
                )}

                {/* Calories */}
                {week.totalCalories > 0 && (
                  <div className="flex items-center justify-between text-[10px] sm:text-xs">
                    <span className="text-gray-600">kcal:</span>
                    <span className="font-medium text-green-600">
                      {week.totalCalories}
                    </span>
                  </div>
                )}

                {/* TSS - Highlighted */}
                {week.totalTSS > 0 && (
                  <div className="flex items-center justify-between text-[10px] sm:text-xs pt-1.5 mt-1.5 border-t border-gray-200">
                    <span className="text-gray-700 font-semibold">TSS:</span>
                    <span className="font-bold text-orange-600 text-sm">
                      {week.totalTSS}
                    </span>
                  </div>
                )}

                {/* Average Power */}
                {week.avgPower > 0 && (
                  <div className="flex items-center justify-between text-[10px] sm:text-xs">
                    <span className="text-gray-600">Avg Power:</span>
                    <span className="font-medium text-purple-600">
                      {week.avgPower}W
                    </span>
                  </div>
                )}

                {/* Activity Count */}
                <div className="flex items-center justify-between text-[10px] sm:text-xs pt-1 border-t border-gray-200 mt-1">
                  <span className="text-gray-500">Activities:</span>
                  <span className="font-medium text-gray-700">
                    {week.activityCount}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

