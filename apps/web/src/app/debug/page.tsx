'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'

export default function DebugPage() {
  const [activities, setActivities] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()

  useEffect(() => {
    if (user) {
      fetchActivities()
    }
  }, [user])

  const fetchActivities = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('user_id', user.id)
        .order('upload_date', { ascending: false })

      if (error) {
        throw error
      }

      setActivities(data || [])
    } catch (err) {
      console.error('Error fetching activities:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="p-8">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Debug: Raw Activity Data</h1>
        
        {activities.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-600">No activities found</p>
          </div>
        ) : (
          <div className="space-y-6">
            {activities.map((activity) => (
              <div key={activity.id} className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-start mb-4">
                  <h2 className="text-xl font-semibold">{activity.file_name}</h2>
                  <span className={`px-3 py-1 rounded-full text-sm ${
                    activity.status === 'processed' ? 'bg-green-100 text-green-800' :
                    activity.status === 'processing' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {activity.status}
                  </span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-semibold mb-2">Basic Info</h3>
                    <div className="space-y-1 text-sm">
                      <p><strong>ID:</strong> {activity.id}</p>
                      <p><strong>File Size:</strong> {activity.file_size} bytes</p>
                      <p><strong>Upload Date:</strong> {new Date(activity.upload_date).toLocaleString()}</p>
                      <p><strong>Processed Date:</strong> {activity.processed_date ? new Date(activity.processed_date).toLocaleString() : 'Not processed'}</p>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="font-semibold mb-2">Metadata</h3>
                    <pre className="bg-gray-100 p-3 rounded text-xs overflow-auto max-h-40">
                      {JSON.stringify(activity.metadata, null, 2)}
                    </pre>
                  </div>
                </div>
                
                <div className="mt-4">
                  <h3 className="font-semibold mb-2">Processed Data</h3>
                  <pre className="bg-gray-100 p-3 rounded text-xs overflow-auto max-h-96">
                    {JSON.stringify(activity.data, null, 2)}
                  </pre>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
