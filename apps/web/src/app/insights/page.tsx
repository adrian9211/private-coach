'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { UserMenu } from '@/components/auth/user-menu'
import { InsightsOverview } from '@/components/insights/insights-overview'
import { TrainingLoadAnalysis } from '@/components/insights/training-load-analysis'
import { PerformanceTrends } from '@/components/insights/performance-trends'
import { AIRecommendations } from '@/components/insights/ai-recommendations'
import { supabase } from '@/lib/supabase'

export default function InsightsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [userFtp, setUserFtp] = useState<number | null>(null)
  const [userWeight, setUserWeight] = useState<number | null>(null)
  const [userVo2Max, setUserVo2Max] = useState<number | null>(null)
  const [trainingGoals, setTrainingGoals] = useState<string | null>(null)
  const [weeklyHours, setWeeklyHours] = useState<number | null>(null)
  const [loadingUserData, setLoadingUserData] = useState(true)

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/signin')
    }
  }, [user, loading, router])

  useEffect(() => {
    // Timeout fallback to prevent infinite loading
    const timeoutId = setTimeout(() => {
      console.warn('InsightsPage: Timeout - forcing loadingUserData to false')
      setLoadingUserData(false)
    }, 10000) // 10 second timeout

    const fetchUserData = async () => {
      if (!user) {
        console.log('InsightsPage: No user, setting loading to false')
        clearTimeout(timeoutId)
        setLoadingUserData(false)
        return
      }

      try {
        console.log('InsightsPage: Fetching user data for', user.id)
        setLoadingUserData(true)
        
        // Fetch user data - don't block page render if slow
        const { data, error } = await supabase
          .from('users')
          .select('preferences, weight_kg, vo2_max, training_goals, weekly_training_hours')
          .eq('id', user.id)
          .maybeSingle()

        console.log('InsightsPage: User data fetched', { hasData: !!data, error: error?.message })

        if (error) {
          console.error('Error fetching user data:', error)
          clearTimeout(timeoutId)
          setLoadingUserData(false)
          return
        }

        if (data) {
          const prefs = data.preferences || {}
          if (prefs.ftp && typeof prefs.ftp === 'number') {
            setUserFtp(prefs.ftp)
          }
          if (data.weight_kg && typeof data.weight_kg === 'number') {
            setUserWeight(data.weight_kg)
          }
          if (data.vo2_max && typeof data.vo2_max === 'number') {
            setUserVo2Max(data.vo2_max)
          }
          if (data.training_goals && typeof data.training_goals === 'string') {
            setTrainingGoals(data.training_goals)
          }
          if (data.weekly_training_hours && typeof data.weekly_training_hours === 'number') {
            setWeeklyHours(data.weekly_training_hours)
          }
        }
      } catch (err: any) {
        console.error('Error loading user data:', err)
        clearTimeout(timeoutId)
        setLoadingUserData(false)
      } finally {
        console.log('InsightsPage: Setting loadingUserData to false')
        clearTimeout(timeoutId)
        setLoadingUserData(false)
      }
    }

    if (user) {
      fetchUserData()
    } else {
      // If no user after loading finishes, set to false
      if (!loading) {
        clearTimeout(timeoutId)
        setLoadingUserData(false)
      }
    }

    return () => {
      clearTimeout(timeoutId)
    }
  }, [user, loading])

  // Don't render if user is not available (after loading)
  if (!loading && !user?.id) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Please sign in to view insights</p>
        </div>
      </div>
    )
  }

  // Only block if we're waiting for auth (user), not user preferences
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading insights...</p>
          <p className="text-xs text-gray-400 mt-2">Loading user data...</p>
        </div>
      </div>
    )
  }

  // Don't render if user is not available (after loading)
  if (!user?.id) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Please sign in to view insights</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Navigation */}
      <nav className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <a href="/dashboard" className="text-blue-600 hover:text-blue-800 font-medium">
              ← Back to Dashboard
            </a>
            <h1 className="text-2xl font-bold text-gray-900">AI Insights</h1>
          </div>
          <UserMenu />
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8">
        {/* Overview Section */}
        <InsightsOverview
          userId={user?.id || ''}
          userFtp={userFtp}
          userWeight={userWeight}
          userVo2Max={userVo2Max}
          trainingGoals={trainingGoals}
          weeklyHours={weeklyHours}
        />

        {/* Training Load Analysis */}
        <div className="mt-8">
          <TrainingLoadAnalysis
            userId={user?.id || ''}
            userFtp={userFtp}
          />
        </div>

        {/* Performance Trends */}
        <div className="mt-8">
          <PerformanceTrends
            userId={user?.id || ''}
            userFtp={userFtp}
            userWeight={userWeight}
          />
        </div>

        {/* AI Recommendations */}
        <div className="mt-8">
          <AIRecommendations
            userId={user.id}
            userFtp={userFtp}
            userWeight={userWeight}
            userVo2Max={userVo2Max}
            trainingGoals={trainingGoals}
            weeklyHours={weeklyHours}
          />
        </div>
      </main>
    </div>
  )
}

