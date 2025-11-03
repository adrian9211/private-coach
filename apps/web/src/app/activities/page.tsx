import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { UserMenu } from '@/components/auth/user-menu'
import { ActivitiesList } from '@/components/activities/activities-list' // New client component
import { Database } from '@/lib/supabase'

export default async function ActivitiesPage() {
  const supabase = createServerComponentClient<Database>({ cookies })
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect('/auth/signin')
  }

  // Optimize query: only select fields needed for list view
  // Note: Still fetch 'data' field for classification badges, but it's smaller than full records
  const { data: activities, error } = await supabase
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
    .order('start_time', { ascending: false, nullsFirst: false })
    .order('upload_date', { ascending: false })

  if (error) {
    console.error('Error fetching activities:', error)
    // You might want to render an error state here
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Navigation */}
      <nav className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
            <div className="flex items-center space-x-2 sm:space-x-4 min-w-0">
              <a href="/dashboard" className="text-blue-600 hover:text-blue-800 font-medium text-sm sm:text-base whitespace-nowrap">
                ← Back
              </a>
              <h1 className="text-lg sm:text-xl font-bold text-gray-900 truncate">My Activities</h1>
            </div>
            <a href="/upload" className="bg-blue-600 text-white px-3 sm:px-4 py-2 rounded-md hover:bg-blue-700 font-medium text-sm sm:text-base text-center whitespace-nowrap">
              <span className="hidden sm:inline">Upload New Activity</span>
              <span className="sm:hidden">Upload</span>
            </a>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        <ActivitiesList initialActivities={activities || []} />
      </div>
    </div>
  )
}

