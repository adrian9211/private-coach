'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { WorkoutCard } from './workout-card'
import { parseZwoFile, type WorkoutData } from '@/lib/workout-parser'

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

interface ScheduledWorkoutDayProps {
  date: string
  scheduledWorkouts: ScheduledWorkout[]
}

export function ScheduledWorkoutDay({ date, scheduledWorkouts }: ScheduledWorkoutDayProps) {
  const [workoutData, setWorkoutData] = useState<Record<string, WorkoutData>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchWorkoutDetails = async () => {
      const data: Record<string, WorkoutData> = {}
      
      for (const scheduled of scheduledWorkouts) {
        if (scheduled.workout_id) {
          try {
            // Fetch workout from database
            const { data: workout, error } = await supabase
              .from('workouts')
              .select('*')
              .eq('id', scheduled.workout_id)
              .single()

            if (workout && !error) {
              // Convert database workout to WorkoutData format
              const steps = (workout.steps as any[]) || []
              const totalDuration = workout.duration_seconds || 0
              
              // Convert steps to segments format
              const segments = steps.map((step: any) => {
                const segment: any = {
                  type: (step.type || 'steadystate') as 'warmup' | 'steadystate' | 'interval' | 'cooldown' | 'ramp',
                  duration: step.duration || 0,
                }
                
                if (step.power !== null && step.power !== undefined) {
                  segment.power = step.power
                }
                if (step.powerLow !== null && step.powerLow !== undefined) {
                  segment.powerLow = step.powerLow
                }
                if (step.powerHigh !== null && step.powerHigh !== undefined) {
                  segment.powerHigh = step.powerHigh
                }
                
                return segment
              })
              
              data[scheduled.id] = {
                name: workout.name,
                author: workout.author || 'mywhooshinfo.com',
                description: workout.description || '',
                sportType: workout.sport_type || 'bike',
                segments,
                totalDuration,
                estimatedTSS: workout.tss,
                estimatedIF: workout.intensity_factor,
              }
            }
          } catch (err) {
            console.error(`Error fetching workout ${scheduled.workout_id}:`, err)
          }
        }
      }
      
      setWorkoutData(data)
      setLoading(false)
    }

    if (scheduledWorkouts.length > 0) {
      fetchWorkoutDetails()
    } else {
      setLoading(false)
    }
  }, [scheduledWorkouts])

  const dateObj = new Date(date)
  const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' })
  const dayNumber = dateObj.getDate()
  const monthName = dateObj.toLocaleDateString('en-US', { month: 'short' })

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900">{dayName}</h3>
        <p className="text-sm text-gray-600">
          {monthName} {dayNumber}, {dateObj.getFullYear()}
        </p>
      </div>

      {scheduledWorkouts.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p>No workouts scheduled</p>
        </div>
      ) : (
        <div className="space-y-3">
          {scheduledWorkouts.map((scheduled) => {
            const workout = workoutData[scheduled.id]
            if (!workout) {
              return (
                <div key={scheduled.id} className="bg-gray-50 rounded p-3 border border-gray-200">
                  <p className="text-sm font-medium text-gray-700">{scheduled.workout_name}</p>
                  {scheduled.workout_category && (
                    <p className="text-xs text-gray-500 mt-1">{scheduled.workout_category}</p>
                  )}
                </div>
              )
            }

            return (
              <div key={scheduled.id}>
                <WorkoutCard
                  workout={workout}
                  category={scheduled.workout_category || undefined}
                  compact={true}
                />
                {scheduled.scheduled_time && (
                  <p className="text-xs text-gray-500 mt-1">
                    Scheduled: {scheduled.scheduled_time}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

