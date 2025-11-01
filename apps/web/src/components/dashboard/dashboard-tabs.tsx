'use client'

import { useState, useEffect } from 'react'
import { DashboardOverview } from './dashboard-overview'
import { CalendarView } from './calendar-view'
import { FitnessView } from './fitness-view'
import { Database } from '@/lib/supabase-types'
import { supabase } from '@/lib/supabase'

type ActivitySummary = Database['public']['Views']['activity_summaries']['Row']
type Activity = Database['public']['Tables']['activities']['Row']

interface DashboardTabsProps {
  summary: ActivitySummary
  recentActivities: Activity[]
  userId: string
}

type Tab = 'overview' | 'calendar' | 'fitness'

export function DashboardTabs({ summary, recentActivities, userId }: DashboardTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [userFtp, setUserFtp] = useState<number | null>(null)
  const [userWeight, setUserWeight] = useState<number | null>(null)

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('preferences, weight_kg')
          .eq('id', userId)
          .single()

        if (!error && data) {
          if (data.preferences?.ftp) {
            setUserFtp(data.preferences.ftp)
          }
          if (data.weight_kg) {
            setUserWeight(data.weight_kg)
          }
        }
      } catch (err) {
        console.error('Error fetching user data:', err)
      }
    }

    fetchUserData()
  }, [userId])

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow-lg p-1">
        <div className="flex space-x-1">
          <button
            onClick={() => setActiveTab('overview')}
            className={`
              flex-1 px-3 py-3 text-sm font-medium rounded-md transition-all
              ${activeTab === 'overview'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }
            `}
          >
            <div className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span className="hidden sm:inline">Overview</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('calendar')}
            className={`
              flex-1 px-3 py-3 text-sm font-medium rounded-md transition-all
              ${activeTab === 'calendar'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }
            `}
          >
            <div className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="hidden sm:inline">Calendar</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('fitness')}
            className={`
              flex-1 px-3 py-3 text-sm font-medium rounded-md transition-all
              ${activeTab === 'fitness'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }
            `}
          >
            <div className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span className="hidden sm:inline">Fitness</span>
            </div>
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'overview' && (
          <DashboardOverview
            summary={summary}
            recentActivities={recentActivities}
          />
        )}
        {activeTab === 'calendar' && (
          <CalendarView userId={userId} />
        )}
        {activeTab === 'fitness' && (
          <FitnessView 
            userId={userId}
            userFtp={userFtp}
            userWeight={userWeight}
          />
        )}
      </div>
    </div>
  )
}

