'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { WorkoutProfileChart } from '@/components/workouts/workout-profile-chart'
import { formatDuration, type WorkoutData } from '@/lib/workout-parser'
import Link from 'next/link'

interface WorkoutWithMeta extends WorkoutData {
  slug: string
  category: string
  filename: string
}

export default function WorkoutDetailPage() {
  const params = useParams()
  const router = useRouter()
  const category = params.category as string
  const slug = params.slug as string

  const [workout, setWorkout] = useState<WorkoutWithMeta | null>(null)
  const [loading, setLoading] = useState(true)
  const [similarWorkouts, setSimilarWorkouts] = useState<WorkoutWithMeta[]>([])

  useEffect(() => {
    if (!category || !slug) return

    setLoading(true)
    fetch(`/api/workouts/${category}/${slug}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          console.error(data.error)
          return
        }
        setWorkout(data)
      })
      .catch(console.error)
      .finally(() => setLoading(false))

    // Load similar workouts from same category
    fetch(`/api/workouts?category=${category}`)
      .then(res => res.json())
      .then(data => {
        if (data.workouts) {
          // Get up to 8 similar workouts (excluding current)
          const similar = data.workouts
            .filter((w: WorkoutWithMeta) => w.slug !== slug)
            .slice(0, 8)
          setSimilarWorkouts(similar)
        }
      })
      .catch(console.error)
  }, [category, slug])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (!workout) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Workout Not Found
          </h1>
          <Link href="/workouts" className="text-blue-500 hover:underline">
            ← Back to Workouts
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <nav className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          <Link href="/workouts" className="hover:text-blue-500">Workouts</Link>
          {' / '}
          <Link href={`/workouts?category=${category}`} className="hover:text-blue-500">
            {category.replace(/_/g, ' ')}
          </Link>
          {' / '}
          <span className="text-gray-900 dark:text-white">{workout.name}</span>
        </nav>

        {/* Main Workout Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                {workout.name}
              </h1>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                by {workout.author}
              </p>
            </div>
            <div className="flex gap-2">
              <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded text-sm font-medium">
                {formatDuration(workout.totalDuration)}
              </span>
              {workout.estimatedTSS && (
                <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded text-sm font-medium">
                  {workout.estimatedTSS} TSS
                </span>
              )}
              {workout.estimatedIF && (
                <span className="px-3 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 rounded text-sm font-medium">
                  IF: {workout.estimatedIF}
                </span>
              )}
            </div>
          </div>

          {/* Workout Profile Chart */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Workout Profile
            </h2>
            <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4">
              <WorkoutProfileChart workout={workout} height={120} compact={false} />
            </div>
          </div>

          {/* Description */}
          {workout.description && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Description
              </h2>
              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-line">
                {workout.description}
              </p>
            </div>
          )}

          {/* Workout Structure */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Workout Structure
            </h2>
            <div className="space-y-2">
              {workout.segments.map((segment, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                        {segment.type}
                      </span>
                      {segment.repeat && (
                        <span className="text-xs text-gray-600 dark:text-gray-400">
                          {segment.repeat}x
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      {formatDuration(segment.duration)}
                      {segment.power && ` @ ${Math.round(segment.power * 100)}% FTP`}
                      {segment.powerLow && segment.powerHigh && (
                        ` @ ${Math.round(segment.powerLow * 100)}% - ${Math.round(segment.powerHigh * 100)}% FTP`
                      )}
                      {segment.onPower && segment.onDuration && (
                        <>
                          {' | '}
                          {formatDuration(segment.onDuration)} @ {Math.round(segment.onPower * 100)}%
                          {segment.offDuration && segment.offPower && (
                            <> / {formatDuration(segment.offDuration)} @ {Math.round(segment.offPower * 100)}%</>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Similar Workouts */}
        {similarWorkouts.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Similar Workouts
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {similarWorkouts.map((similar) => (
                <Link
                  key={similar.slug}
                  href={`/workouts/${category}/${similar.slug}`}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow p-4 cursor-pointer"
                >
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 line-clamp-2">
                    {similar.name}
                  </h3>
                  <div className="mb-2">
                    <WorkoutProfileChart workout={similar} height={40} compact={true} />
                  </div>
                  <div className="flex justify-between items-center text-xs text-gray-600 dark:text-gray-400">
                    <span>{formatDuration(similar.totalDuration)}</span>
                    {similar.estimatedTSS && <span>{similar.estimatedTSS} TSS</span>}
                    {similar.estimatedIF && <span>IF: {similar.estimatedIF}</span>}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

