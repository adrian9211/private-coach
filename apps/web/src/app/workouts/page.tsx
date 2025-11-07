'use client'

import { useState, useEffect } from 'react'
import { WorkoutCard } from '@/components/workouts/workout-card'
import type { WorkoutData } from '@/lib/workout-parser'
import Link from 'next/link'

interface WorkoutWithMeta extends WorkoutData {
  slug: string
  category: string
  filename: string
}

const CATEGORIES = [
  { id: 'BEGINNER', name: 'Beginner', description: 'Begin your exercise journey' },
  { id: 'UNDER_35_MIN', name: 'Under 35 Min', description: 'Maximize your training time' },
  { id: 'FAST_FITNESS', name: 'Fast Fitness', description: 'High-intensity interval training (HIIT)' },
  { id: 'TESTING', name: 'Testing', description: 'Explore your limits' },
  { id: 'ANAEROBIC', name: 'Anaerobic', description: 'High-powered glycolytic intervals' },
  { id: 'ENDURANCE', name: 'Endurance', description: 'Enhance your aerobic fitness' },
  { id: 'SPRINT', name: 'Sprint', description: 'High power and fast legs' },
  { id: 'SWEETSPOT', name: 'Sweetspot', description: 'Build your aerobic engine' },
  { id: 'TAPER', name: 'Taper', description: 'Prepare for peak performance' },
  { id: 'TEMPO', name: 'Tempo', description: 'Optimize your endurance training' },
  { id: 'THRESHOLD', name: 'Threshold', description: 'Maximize your race pace' },
  { id: 'UAE_TEAM_EMIRATES', name: 'UAE Team Emirates', description: 'Experience world tour training' },
  { id: 'UAE_TEAM_ADQ', name: 'UAE Team ADQ', description: 'Experience world tour training' },
  { id: 'VO2MAX', name: 'VO2max', description: 'Maximize the utilization of oxygen' },
  { id: 'ALL_TRAINING_PLAN_WORKOUTS', name: 'All Training Plan Workouts', description: 'All workouts from all training plans' },
]

export default function WorkoutsPage() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [workouts, setWorkouts] = useState<WorkoutWithMeta[]>([])
  const [loading, setLoading] = useState(false)
  const [categories, setCategories] = useState<string[]>([])
  const [workoutInfo, setWorkoutInfo] = useState<{ totalFiles?: number; htmlFiles?: number; needsAuthentication?: boolean } | null>(null)

  useEffect(() => {
    // Load categories
    fetch('/api/workouts')
      .then(res => res.json())
      .then(data => {
        if (data.categories) {
          setCategories(data.categories)
        }
      })
      .catch(console.error)
  }, [])

  useEffect(() => {
    if (!selectedCategory) {
      setWorkouts([])
      setWorkoutInfo(null)
      return
    }

    setLoading(true)
    setWorkoutInfo(null)
    fetch(`/api/workouts?category=${selectedCategory}`)
      .then(res => res.json())
      .then(data => {
        if (data.workouts) {
          setWorkouts(data.workouts)
        }
        if (data.totalFiles !== undefined) {
          setWorkoutInfo({
            totalFiles: data.totalFiles,
            htmlFiles: data.htmlFiles,
            needsAuthentication: data.needsAuthentication,
          })
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [selectedCategory])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Workouts
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Browse and discover structured training workouts
          </p>
        </div>

        {/* Category Selection */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Workout Categories
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {CATEGORIES.map((cat) => {
              const isAvailable = categories.length === 0 || categories.includes(cat.id)
              const isSelected = selectedCategory === cat.id
              
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(isSelected ? null : cat.id)}
                  className={`
                    p-4 rounded-lg border-2 text-left transition-all
                    ${isSelected 
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 hover:shadow-md'
                    }
                    cursor-pointer
                  `}
                >
                  <h3 className="font-semibold text-sm text-gray-900 dark:text-white mb-1">
                    {cat.name}
                  </h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {cat.description}
                  </p>
                </button>
              )
            })}
          </div>
        </div>

        {/* Workouts Grid */}
        {selectedCategory && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {CATEGORIES.find(c => c.id === selectedCategory)?.name || selectedCategory}
              </h2>
              {workouts.length > 0 && (
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {workouts.length} workout{workouts.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {loading ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              </div>
            ) : workouts.length === 0 ? (
              <div className="text-center py-12">
                {workoutInfo?.needsAuthentication ? (
                  <div className="max-w-md mx-auto">
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
                      <h3 className="text-lg font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
                        Workouts Require Authentication
                      </h3>
                      <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-4">
                        Found {workoutInfo.totalFiles} workout file{workoutInfo.totalFiles !== 1 ? 's' : ''} in this category, but they need to be downloaded while logged in to MyWhooshInfo.com.
                      </p>
                      <p className="text-xs text-yellow-600 dark:text-yellow-400">
                        To use these workouts, please visit{' '}
                        <a 
                          href="https://mywhooshinfo.com/workouts/" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="underline hover:text-yellow-800 dark:hover:text-yellow-200"
                        >
                          MyWhooshInfo.com
                        </a>
                        {' '}and download the .zwo files manually, then place them in the{' '}
                        <code className="bg-yellow-100 dark:bg-yellow-900/30 px-1 rounded">
                          workouts/{selectedCategory}/
                        </code>
                        {' '}directory.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-gray-500 dark:text-gray-400">
                    No workouts available in this category.
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {workouts.map((workout) => (
                  <WorkoutCard
                    key={workout.slug}
                    workout={workout}
                    category={selectedCategory}
                    slug={workout.slug}
                    compact={false}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {!selectedCategory && (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            Select a category above to browse workouts
          </div>
        )}
      </div>
    </div>
  )
}

