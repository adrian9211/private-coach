'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { WeekPlanConfigModal } from './week-plan-config-modal'
import { ScheduledWorkoutDay } from './scheduled-workout-day'

interface WeekPlanGeneratorProps {
  userId: string
  defaultWeeklyHours?: number | null
}

interface ScheduledWorkout {
  id: string
  workout_id: string | null
  workout_name: string
  workout_category: string | null
  scheduled_date: string
  scheduled_time: string | null
  status: string
  notes: string | null
}

export function WeekPlanGenerator({ userId, defaultWeeklyHours }: WeekPlanGeneratorProps) {
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scheduledWorkouts, setScheduledWorkouts] = useState<Record<string, ScheduledWorkout[]>>({})
  const [weekStartDate, setWeekStartDate] = useState<string | null>(null)
  const [scheduledCount, setScheduledCount] = useState<number | null>(null)

  const fetchScheduledWorkouts = async (startDate: string) => {
    try {
      const start = new Date(startDate)
      const end = new Date(start)
      end.setDate(end.getDate() + 7)

      const { data, error } = await supabase
        .from('scheduled_workouts')
        .select('*')
        .eq('user_id', userId)
        .eq('source', 'week_plan')
        .gte('scheduled_date', start.toISOString().split('T')[0])
        .lte('scheduled_date', end.toISOString().split('T')[0])
        .order('scheduled_date')
        .order('scheduled_time')

      if (error) {
        // Handle table not found (404) gracefully
        if (error.code === '42P01' || error.message?.includes('does not exist') || error.message?.includes('404')) {
          console.warn('scheduled_workouts table does not exist yet. Please apply migration 20250101000018_create_scheduled_workouts.sql')
          setScheduledWorkouts({})
          return
        }
        throw error
      }

      // Group by date
      const grouped: Record<string, ScheduledWorkout[]> = {}
      if (data) {
        data.forEach((workout) => {
          const date = workout.scheduled_date
          if (!grouped[date]) {
            grouped[date] = []
          }
          grouped[date].push(workout as ScheduledWorkout)
        })
      }

      setScheduledWorkouts(grouped)
    } catch (err) {
      console.error('Error fetching scheduled workouts:', err)
      // Set empty state on error to prevent UI issues
      setScheduledWorkouts({})
    }
  }

  // Load existing scheduled workouts on mount
  useEffect(() => {
    const loadExistingWorkouts = async () => {
      try {
        // Get the most recent week plan start date
        const { data: recentPlan } = await supabase
          .from('scheduled_workouts')
          .select('scheduled_date')
          .eq('user_id', userId)
          .eq('source', 'week_plan')
          .order('scheduled_date', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (recentPlan) {
          const startDate = recentPlan.scheduled_date
          setWeekStartDate(startDate)
          await fetchScheduledWorkouts(startDate)
        }
      } catch (err) {
        console.error('Error loading existing workouts:', err)
      }
    }

    if (userId) {
      loadExistingWorkouts()
    }
  }, [userId])

  const generateWeekPlan = async (config: {
    startDate: string
    availableHours: number
    availableDays: number[]
  }) => {
    if (!userId) {
      setError('User ID is required')
      setShowConfigModal(false)
      return
    }

    // Close modal immediately and show loading
    setShowConfigModal(false)
    setLoading(true)
    setError(null)
    setScheduledWorkouts({})
    setScheduledCount(null)
    setWeekStartDate(config.startDate)

    try {
      console.log('Invoking generate-week-plan with:', {
        userId,
        startDate: config.startDate,
        availableHours: config.availableHours,
        availableDays: config.availableDays,
      })

      const { data, error: invokeError } = await supabase.functions.invoke('generate-week-plan', {
        body: {
          userId,
          startDate: config.startDate,
          availableHours: config.availableHours,
          availableDays: config.availableDays,
        },
      })

      console.log('Function response:', { data, invokeError })

      if (invokeError) {
        console.error('Function invoke error:', invokeError)
        // Check if function doesn't exist
        if (invokeError.message?.includes('404') || invokeError.message?.includes('not found')) {
          throw new Error('Week plan generation function is not deployed. Please contact support or check Supabase functions.')
        }
        throw new Error(invokeError.message || 'Failed to invoke week plan function')
      }

      if (!data) {
        throw new Error('No response from week plan function. The function may not be deployed.')
      }

      if (data.error) {
        // Provide more helpful error messages
        const errorMsg = data.error || 'Failed to generate week plan'
        if (errorMsg.includes('scheduled_workouts') || errorMsg.includes('does not exist')) {
          throw new Error('Database table missing. Please apply the scheduled_workouts migration to your database.')
        }
        throw new Error(errorMsg)
      }

      setScheduledCount(data.scheduledWorkouts || 0)
      
      // Fetch scheduled workouts for the week
      await fetchScheduledWorkouts(config.startDate)
    } catch (err: any) {
      console.error('Error generating week plan:', err)
      setError(err.message || 'Failed to generate week plan')
    } finally {
      setLoading(false)
    }
  }

  // Generate array of 7 days starting from weekStartDate
  const getWeekDays = (): string[] => {
    if (!weekStartDate) return []
    const days: string[] = []
    const start = new Date(weekStartDate)
    for (let i = 0; i < 7; i++) {
      const date = new Date(start)
      date.setDate(start.getDate() + i)
      days.push(date.toISOString().split('T')[0])
    }
    return days
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center mr-4">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Weekly Training Plan</h2>
              <p className="text-sm text-gray-600">Get AI-generated 7-day workout schedule</p>
            </div>
          </div>
          <button
            onClick={() => setShowConfigModal(true)}
            disabled={loading}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-medium py-2 px-4 rounded-md transition-all shadow-md hover:shadow-lg disabled:cursor-not-allowed"
          >
            {loading ? 'Generating...' : 'Generate New Plan'}
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-red-600 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <p className="text-red-800">{error}</p>
            </div>
          </div>
        )}

        {scheduledCount !== null && scheduledCount > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-md p-4 mb-6">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-green-600 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="text-green-800 font-medium">
                  Successfully scheduled {scheduledCount} workout{scheduledCount !== 1 ? 's' : ''} for the week!
                </p>
              </div>
            </div>
          </div>
        )}

        {weekStartDate && Object.keys(scheduledWorkouts).length > 0 && (
          <div className="mt-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Your Weekly Schedule</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-4">
              {getWeekDays().map((date) => (
                <ScheduledWorkoutDay
                  key={date}
                  date={date}
                  scheduledWorkouts={scheduledWorkouts[date] || []}
                />
              ))}
            </div>
          </div>
        )}

        {weekStartDate && Object.keys(scheduledWorkouts).length === 0 && !loading && (
          <div className="mt-6 text-center py-8 text-gray-400">
            <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p>No workouts scheduled for this week yet.</p>
            <p className="text-sm mt-2">Click "Generate New Plan" to create your training schedule.</p>
          </div>
        )}
      </div>

      <WeekPlanConfigModal
        isOpen={showConfigModal}
        onClose={() => setShowConfigModal(false)}
        onGenerate={generateWeekPlan}
        defaultHours={defaultWeeklyHours}
        loading={loading}
      />
    </>
  )
}

