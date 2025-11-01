'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek } from 'date-fns'
import { Database } from '@/lib/supabase-types'
import { WeeklySummary } from './weekly-summary'

type Activity = Database['public']['Tables']['activities']['Row']

interface ActivityByDate {
  [dateKey: string]: Activity[]
}

interface CalendarViewProps {
  userId: string
}

export function CalendarView({ userId }: CalendarViewProps) {
  const router = useRouter()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [userFtp, setUserFtp] = useState<number | null>(null)

  // Check if mobile view
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Fetch user FTP
  useEffect(() => {
    const fetchFtp = async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('preferences')
          .eq('id', userId)
          .single()

        if (!error && data?.preferences?.ftp) {
          setUserFtp(data.preferences.ftp)
        }
      } catch (err) {
        console.error('Error fetching FTP:', err)
      }
    }

    fetchFtp()
  }, [userId])

  // Fetch activities for the current month view
  useEffect(() => {
    const fetchActivities = async () => {
      try {
        setLoading(true)
        const monthStart = startOfMonth(currentMonth)
        const monthEnd = endOfMonth(currentMonth)
        
        // Extend range slightly to show activities that might be on edges
        const rangeStart = startOfWeek(monthStart, { weekStartsOn: 1 })
        const rangeEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

        // Query activities - try start_time first, fallback to upload_date
        const { data: startTimeData, error: startTimeError } = await supabase
          .from('activities')
          .select('*')
          .eq('user_id', userId)
          .eq('status', 'processed')
          .gte('start_time', rangeStart.toISOString())
          .lte('start_time', rangeEnd.toISOString())

        // Also get activities that might only have upload_date in the range
        const { data: uploadDateData, error: uploadDateError } = await supabase
          .from('activities')
          .select('*')
          .eq('user_id', userId)
          .eq('status', 'processed')
          .is('start_time', null)
          .gte('upload_date', rangeStart.toISOString())
          .lte('upload_date', rangeEnd.toISOString())

        // Combine and deduplicate
        const allActivities = [...(startTimeData || []), ...(uploadDateData || [])]
        const uniqueActivities = Array.from(
          new Map(allActivities.map(act => [act.id, act])).values()
        )

        // Sort by start_time or upload_date
        uniqueActivities.sort((a, b) => {
          const dateA = a.start_time || a.upload_date || ''
          const dateB = b.start_time || b.upload_date || ''
          return dateB.localeCompare(dateA)
        })

        setActivities(uniqueActivities)
      } catch (err) {
        console.error('Error fetching activities for calendar:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchActivities()
  }, [userId, currentMonth])

  // Group activities by date
  const activitiesByDate = useMemo(() => {
    const grouped: ActivityByDate = {}
    activities.forEach((activity) => {
      const dateKey = activity.start_time 
        ? format(new Date(activity.start_time), 'yyyy-MM-dd')
        : activity.upload_date 
          ? format(new Date(activity.upload_date), 'yyyy-MM-dd')
          : null
      
      if (dateKey) {
        if (!grouped[dateKey]) {
          grouped[dateKey] = []
        }
        grouped[dateKey].push(activity)
      }
    })
    return grouped
  }, [activities])

  // Get calendar days for current month
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(currentMonth)
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
    
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd })
  }, [currentMonth])

  const formatDuration = (seconds: number | null | undefined): string => {
    if (!seconds) return '-'
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  const getDayActivities = (date: Date): Activity[] => {
    const dateKey = format(date, 'yyyy-MM-dd')
    return activitiesByDate[dateKey] || []
  }

  // Type guard for data with summary
  const getSummary = (data: any): any => {
    if (data && typeof data === 'object' && 'summary' in data) {
      return data.summary
    }
    return null
  }

  const getTotalDistance = (dayActivities: Activity[]): number => {
    return dayActivities.reduce((sum, act) => {
      const summary = getSummary(act.data)
      const dist = act.total_distance || (summary && typeof summary === 'object' && 'totalDistance' in summary ? summary.totalDistance : null) || 0
      return sum + (typeof dist === 'number' ? dist : 0)
    }, 0)
  }

  const getTotalDuration = (dayActivities: Activity[]): number => {
    return dayActivities.reduce((sum, act) => {
      const summary = getSummary(act.data)
      const dur = act.total_timer_time || (summary && typeof summary === 'object' && 'duration' in summary ? summary.duration : null) || 0
      return sum + (typeof dur === 'number' ? dur : 0)
    }, 0)
  }

  const getAvgPower = (dayActivities: Activity[]): number => {
    const powers = dayActivities
      .map(act => {
        if (act.avg_power) return act.avg_power
        const summary = getSummary(act.data)
        if (summary && typeof summary === 'object' && 'avgPower' in summary) {
          return summary.avgPower
        }
        return null
      })
      .filter((p): p is number => typeof p === 'number' && p > 0)
    
    if (powers.length === 0) return 0
    return Math.round(powers.reduce((sum, p) => sum + p, 0) / powers.length)
  }

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(direction === 'next' ? addMonths(currentMonth, 1) : subMonths(currentMonth, 1))
  }

  const handleDateClick = (date: Date) => {
    const dayActivities = getDayActivities(date)
    if (dayActivities.length > 0) {
      // If there's exactly one activity, go to it
      if (dayActivities.length === 1) {
        router.push(`/activities/${dayActivities[0].id}`)
      } else {
        // If multiple, show them or set selected date for detail view
        setSelectedDate(date)
      }
    }
  }

  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading calendar...</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6">
      {/* Layout: Weekly Summary on left, Calendar on right */}
      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
        {/* Weekly Summary Panel - Hidden on mobile, shown on larger screens */}
        {!isMobile && (
          <WeeklySummary
            activities={activities}
            currentMonth={currentMonth}
            userId={userId}
            userFtp={userFtp}
          />
        )}

        {/* Calendar Section */}
        <div className="flex-1 min-w-0">
          {/* Calendar Header */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => navigateMonth('prev')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Previous month"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
              {format(currentMonth, 'MMMM yyyy')}
            </h2>
            <button
              onClick={() => navigateMonth('next')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Next month"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-4">
        {/* Week day headers */}
        {weekDays.map((day) => (
          <div key={day} className="text-center text-xs sm:text-sm font-semibold text-gray-600 py-2">
            {day}
          </div>
        ))}

        {/* Calendar days */}
        {calendarDays.map((day, idx) => {
          const dayActivities = getDayActivities(day)
          const isCurrentMonth = isSameMonth(day, currentMonth)
          const isToday = isSameDay(day, new Date())
          const isSelected = selectedDate && isSameDay(day, selectedDate)
          const hasActivities = dayActivities.length > 0
          const totalDistance = getTotalDistance(dayActivities)
          const totalDuration = getTotalDuration(dayActivities)
          const avgPower = getAvgPower(dayActivities)

          return (
            <div
              key={idx}
              onClick={() => handleDateClick(day)}
              className={`
                min-h-[60px] sm:min-h-[80px] p-1 sm:p-2 border rounded-lg transition-all cursor-pointer
                ${isCurrentMonth ? 'bg-white' : 'bg-gray-50'}
                ${isToday ? 'ring-2 ring-blue-500' : ''}
                ${isSelected ? 'ring-2 ring-purple-500 bg-purple-50' : ''}
                ${hasActivities ? 'hover:bg-blue-50 hover:shadow-md' : 'hover:bg-gray-100'}
                ${hasActivities ? 'border-blue-200' : 'border-gray-200'}
              `}
            >
              {/* Day number */}
              <div className={`
                text-xs sm:text-sm font-medium mb-1
                ${isCurrentMonth ? 'text-gray-900' : 'text-gray-400'}
                ${isToday ? 'text-blue-600 font-bold' : ''}
              `}>
                {format(day, 'd')}
              </div>

              {/* Activity indicators */}
              {hasActivities && (
                <div className="space-y-1">
                  {/* Activity count badge */}
                  <div className="bg-blue-600 text-white text-[10px] sm:text-xs font-bold px-1 sm:px-1.5 py-0.5 rounded mb-1">
                    {dayActivities.length}
                  </div>
                  
                  {/* Quick stats - only show on larger screens or if selected */}
                  {(isSelected || !isMobile) && hasActivities && (
                    <div className="text-[9px] sm:text-xs space-y-0.5">
                      {totalDistance > 0 && (
                        <div className="text-blue-700 font-medium truncate">
                          {totalDistance.toFixed(1)} km
                        </div>
                      )}
                      {totalDuration > 0 && (
                        <div className="text-green-700 truncate">
                          {formatDuration(totalDuration)}
                        </div>
                      )}
                      {avgPower > 0 && (
                        <div className="text-orange-700 font-medium truncate">
                          {avgPower}W
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Selected Date Details */}
      {selectedDate && getDayActivities(selectedDate).length > 0 && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {format(selectedDate, 'EEEE, MMMM d, yyyy')}
            </h3>
            <button
              onClick={() => setSelectedDate(null)}
              className="text-gray-500 hover:text-gray-700"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="space-y-3">
            {getDayActivities(selectedDate).map((activity) => {
              const summary = getSummary(activity.data)
              const safeSummary = summary && typeof summary === 'object' ? summary : {}
              const totalDistance = (safeSummary as any)?.totalDistance
              const duration = (safeSummary as any)?.duration
              const avgPower = (safeSummary as any)?.avgPower
              
              return (
                <div
                  key={activity.id}
                  onClick={() => router.push(`/activities/${activity.id}`)}
                  className="p-3 bg-white rounded-lg border border-gray-200 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {activity.start_time 
                              ? format(new Date(activity.start_time), 'h:mm a')
                              : 'Activity'}
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="grid grid-cols-3 gap-2 text-xs sm:text-sm">
                          {totalDistance && typeof totalDistance === 'number' && (
                            <div>
                              <span className="text-gray-500">Distance:</span>{' '}
                              <span className="font-semibold text-blue-600">{totalDistance.toFixed(1)} km</span>
                            </div>
                          )}
                          {duration && typeof duration === 'number' && (
                            <div>
                              <span className="text-gray-500">Duration:</span>{' '}
                              <span className="font-semibold text-green-600">{formatDuration(duration)}</span>
                            </div>
                          )}
                          {avgPower && typeof avgPower === 'number' && (
                            <div>
                              <span className="text-gray-500">Avg Power:</span>{' '}
                              <span className="font-semibold text-orange-600">{Math.round(avgPower)}W</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

          {/* Legend */}
          <div className="mt-6 pt-4 border-t border-gray-200">
            <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-blue-600 rounded"></div>
                <span>Has activities</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-blue-500 rounded"></div>
                <span>Today</span>
              </div>
            </div>
          </div>
        </div>

        {/* Weekly Summary for Mobile - Shown below calendar */}
        {isMobile && (
          <div className="mt-4">
            <WeeklySummary
              activities={activities}
              currentMonth={currentMonth}
              userId={userId}
              userFtp={userFtp}
            />
          </div>
        )}
      </div>
    </div>
  )
}

