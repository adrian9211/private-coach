'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { WorkoutProfileChart } from '@/components/workouts/workout-profile-chart'
import { formatDuration, type WorkoutData } from '@/lib/workout-parser'
import Link from 'next/link'
import { ArrowLeft, Clock, Zap, Activity } from 'lucide-react'

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
          <Link href="/workouts" className="text-blue-500 hover:underline inline-flex items-center">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Workouts
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Navigation Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => router.back()}
            className="p-2 bg-white dark:bg-gray-800 rounded-full shadow-sm hover:shadow-md transition-all text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <nav className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
            <Link href="/workouts" className="hover:text-blue-500 hover:underline">Workouts</Link>
            <span className="text-gray-300 dark:text-gray-600">/</span>
            <Link href={`/workouts?category=${category}`} className="hover:text-blue-500 hover:underline">
              {category.replace(/_/g, ' ')}
            </Link>
            <span className="text-gray-300 dark:text-gray-600">/</span>
            <span className="text-gray-900 dark:text-white font-medium truncate max-w-[200px]">{workout.name}</span>
          </nav>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Main Content - Left Column (2/3 width) */}
          <div className="lg:col-span-2 space-y-8">

            {/* Main Header Card */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 leading-tight">
                    {workout.name}
                  </h1>
                  <p className="text-gray-500 dark:text-gray-400 flex items-center gap-2">
                    <span className="text-xs font-semibold px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-300 uppercase tracking-wide">
                      {workout.category}
                    </span>
                    <span>by {workout.author || 'Unknown'}</span>
                  </p>
                </div>
              </div>

              {/* Description */}
              {workout.description && (
                <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-700">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 uppercase tracking-wide text-xs">
                    About this workout
                  </h3>
                  <p className="text-gray-700 dark:text-gray-300 whitespace-pre-line leading-relaxed">
                    {workout.description}
                  </p>
                </div>
              )}
            </div>

            {/* Chart Section */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-500" />
                Workout Profile
              </h3>
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 border border-gray-100 dark:border-gray-700">
                <WorkoutProfileChart workout={workout} height={200} compact={false} />
              </div>
            </div>

            {/* Similar Workouts */}
            {similarWorkouts.length > 0 && (
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                  Similar Workouts
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {similarWorkouts.map((similar) => (
                    <Link
                      key={similar.slug}
                      href={`/workouts/${category}/${similar.slug}`}
                      className="bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-shadow p-4 group border border-transparent hover:border-blue-500/20"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-1">
                          {similar.name}
                        </h4>
                        <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                          {formatDuration(similar.totalDuration)}
                        </span>
                      </div>
                      <div className="h-16 mb-2 opacity-60 group-hover:opacity-100 transition-opacity">
                        <WorkoutProfileChart workout={similar} height={60} compact={true} />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar - Right Column (1/3 width) */}
          <div className="space-y-6">

            {/* Key Metrics Card */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
              <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-b border-blue-100 dark:border-blue-800/30">
                <h3 className="font-semibold text-blue-900 dark:text-blue-100">Snapshot</h3>
              </div>
              <div className="p-6 grid grid-cols-2 gap-y-6 gap-x-4">
                <div>
                  <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
                    <Clock className="w-4 h-4" />
                    <span className="text-xs font-medium uppercase">Duration</span>
                  </div>
                  <div className="text-xl font-bold text-gray-900 dark:text-white">
                    {formatDuration(workout.totalDuration)}
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
                    <Activity className="w-4 h-4" />
                    <span className="text-xs font-medium uppercase">TSS</span>
                  </div>
                  <div className="text-xl font-bold text-gray-900 dark:text-white">
                    {workout.estimatedTSS || '-'}
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
                    <Zap className="w-4 h-4" />
                    <span className="text-xs font-medium uppercase">Intensity</span>
                  </div>
                  <div className="text-xl font-bold text-gray-900 dark:text-white">
                    {workout.estimatedIF ? (workout.estimatedIF).toFixed(2) : '-'}
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
                    <span className="text-xs font-medium uppercase">Segments</span>
                  </div>
                  <div className="text-xl font-bold text-gray-900 dark:text-white">
                    {workout.segments.length}
                  </div>
                </div>
              </div>
            </div>

            {/* Structure / Intervals List */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 sticky top-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                Structure
              </h3>
              <div className="space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-700">
                {workout.segments.map((segment, idx) => (
                  <div
                    key={idx}
                    className={`relative pl-4 border-l-2 py-1 ${segment.type.toLowerCase() === 'warmup' ? 'border-gray-300' :
                      segment.type.toLowerCase() === 'cooldown' ? 'border-gray-300' :
                        segment.type.toLowerCase() === 'rest' ? 'border-green-400' :
                          (segment.power || 0) > 1.0 ? 'border-red-500' :
                            (segment.power || 0) > 0.85 ? 'border-orange-400' :
                              'border-blue-400'
                      }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-sm font-medium text-gray-900 dark:text-white capitalize block">
                          {segment.type}
                          {segment.repeat && (
                            <span className="ml-2 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded-full">
                              x{segment.repeat}
                            </span>
                          )}
                        </span>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {formatDuration(segment.duration)}
                        </div>
                      </div>

                      <div className="text-right">
                        {segment.power && (
                          <div className="text-sm font-bold text-gray-900 dark:text-white">
                            {Math.round(segment.power * 100)}%
                            <span className="text-[10px] text-gray-400 font-normal ml-0.5">FTP</span>
                          </div>
                        )}
                        {segment.powerLow && segment.powerHigh && (
                          <div className="text-sm font-bold text-gray-900 dark:text-white">
                            {Math.round(segment.powerLow * 100)}-{Math.round(segment.powerHigh * 100)}%
                          </div>
                        )}
                        {segment.onPower && (
                          <div className="text-xs font-mono text-gray-600 dark:text-gray-400">
                            On: {Math.round(segment.onPower * 100)}%
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>
      </div>
    </div>
  )
}

