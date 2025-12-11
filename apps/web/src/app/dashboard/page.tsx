import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { UserMenu } from '@/components/auth/user-menu'
import { DashboardTabs } from '@/components/dashboard/dashboard-tabs'
import { WeekPlanGenerator } from '@/components/workouts/week-plan-generator'
import { Database } from '@/lib/supabase' // Corrected import path

export default async function DashboardPage() {
  const cookieStore = await cookies()
  const supabase = createServerComponentClient<Database>({ cookies: () => cookieStore as any })

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect('/auth/signin')
  }

  // Fetch user data for weekly hours
  const { data: user } = await supabase
    .from('users')
    .select('weekly_training_hours')
    .eq('id', session.user.id)
    .maybeSingle()

  // Fetch summary data (snake_case) - handle case where view doesn't exist or has no data
  const { data: summaryData, error: summaryError } = await supabase
    .from('activity_summaries')
    .select('*')
    .eq('user_id', session.user.id)
    .maybeSingle() // Use maybeSingle() instead of single() to handle 0 rows gracefully

  // Fetch recent activities (snake_case) - optimized: exclude large JSONB fields
  const { data: recentActivities, error: activitiesError } = await supabase
    .from('activities')
    .select(`
      id,
      file_name,
      file_size,
      upload_date,
      start_time,
      processed_date,
      status,
      metadata,
      total_distance,
      total_timer_time,
      avg_power,
      avg_heart_rate,
      avg_speed,
      rpe,
      data
    `)
    .eq('user_id', session.user.id)
    .eq('status', 'processed')
    .order('start_time', { ascending: false, nullsFirst: false })
    .order('upload_date', { ascending: false })
    .limit(5)

  if (summaryError || activitiesError) {
    console.error('Error fetching dashboard data:', summaryError || activitiesError)
  }

  // If summaryData is null (e.g., new user), provide a default object
  // Ensure the default object matches the snake_case structure of the database view
  const summary = summaryData || {
    user_id: session.user.id,
    total_activities: 0,
    total_distance: 0,
    total_duration: 0,
    total_calories: 0,
    avg_power: 0,
    avg_heart_rate: 0,
    avg_speed: 0,
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Navigation */}
      <nav className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <UserMenu />
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome back!
          </h1>
          <p className="text-gray-600">Here's your cycling performance overview</p>
        </div>

        <DashboardTabs
          summary={summary}
          recentActivities={(recentActivities || []) as any}
          userId={session.user.id}
        />

        {/* Week Plan Generator */}
        <div className="mt-8">
          <WeekPlanGenerator
            userId={session.user.id}
            defaultWeeklyHours={(user as any)?.weekly_training_hours || null}
          />
        </div>

        {/* Quick Actions */}
        <div className="mt-8 grid md:grid-cols-2 lg:grid-cols-5 gap-6">
          <div className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mr-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Upload Activity</h3>
                <p className="text-sm text-gray-600">Add new FIT files</p>
              </div>
            </div>
            <a href="/upload" className="w-full text-center block bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 font-medium">
              Upload File
            </a>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mr-4">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">View Activities</h3>
                <p className="text-sm text-gray-600">Browse all activities</p>
              </div>
            </div>
            <a href="/activities" className="w-full text-center block bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 font-medium">
              View Activities
            </a>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mr-4">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">AI Insights</h3>
                <p className="text-sm text-gray-600">Get recommendations</p>
              </div>
            </div>
            <a href="/insights" className="w-full text-center block bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 font-medium">
              View Insights
            </a>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mr-4">
                <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Workouts</h3>
                <p className="text-sm text-gray-600">Browse training plans</p>
              </div>
            </div>
            <a href="/workouts" className="w-full text-center block bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 font-medium">
              View Workouts
            </a>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mr-4">
                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Settings</h3>
                <p className="text-sm text-gray-600">Manage account</p>
              </div>
            </div>
            <a href="/settings" className="w-full text-center block bg-orange-600 text-white px-4 py-2 rounded-md hover:bg-orange-700 font-medium">
              Settings
            </a>
          </div>
        </div>
      </main>
    </div>
  )
}