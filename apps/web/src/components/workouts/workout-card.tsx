'use client'

import { WorkoutProfileChart } from './workout-profile-chart'
import { formatDuration, type WorkoutData } from '@/lib/workout-parser'
import Link from 'next/link'

interface WorkoutCardProps {
  workout: WorkoutData
  category?: string
  slug?: string
  compact?: boolean
}

export function WorkoutCard({ workout, category, slug, compact = false }: WorkoutCardProps) {
  const workoutUrl = slug && category ? `/workouts/${category}/${slug}` : '#'
  const isLink = workoutUrl !== '#'
  const CardContent = (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow p-4 h-full flex flex-col ${isLink ? 'cursor-pointer' : ''}`}>
        {/* Title */}
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 line-clamp-2">
          {workout.name}
        </h3>

        {/* Workout Profile Chart */}
        <div className="mb-3 flex-shrink-0">
          <WorkoutProfileChart workout={workout} height={compact ? 40 : 60} compact={compact} />
        </div>

        {/* Metrics */}
        <div className="flex justify-between items-center text-xs text-gray-600 dark:text-gray-400 mt-auto">
          <span className="font-medium">{formatDuration(workout.totalDuration)}</span>
          {workout.estimatedTSS && (
            <span className="font-medium">{workout.estimatedTSS} TSS</span>
          )}
          {workout.estimatedIF && (
            <span className="font-medium">IF: {workout.estimatedIF}</span>
          )}
        </div>
      </div>
  )

  if (workoutUrl !== '#') {
    return (
      <Link href={workoutUrl}>
        {CardContent}
      </Link>
    )
  }

  return CardContent
}

