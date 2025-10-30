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

  const { data: activities, error } = await supabase
    .from('activities')
    .select('*')
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
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <a href="/dashboard" className="text-blue-600 hover:text-blue-800 font-medium">
              ← Back to Dashboard
            </a>
            <h1 className="text-xl font-bold text-gray-900">My Activities</h1>
          </div>
          <a href="/upload" className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 font-medium">
            Upload New Activity
          </a>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        <ActivitiesList initialActivities={activities || []} />
      </div>
    </div>
  )
}

