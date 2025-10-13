'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { format } from 'date-fns'

interface Activity {
  id: string
  file_name: string
  file_size: number
  upload_date: string
  processed_date: string | null
  status: 'uploaded' | 'processing' | 'processed' | 'failed'
  metadata: any
  data: any
}

export function ActivitiesList({ initialActivities }: { initialActivities: Activity[] }) {
  const [activities, setActivities] = useState(initialActivities)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    setActivities(initialActivities)
  }, [initialActivities])

  useEffect(() => {
    const channel = supabase
      .channel('activities-follow-up')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activities' },
        (payload) => {
          router.refresh()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, router])

  const handleDelete = async (activityId: string) => {
    if (window.confirm('Are you sure you want to delete this activity? This action cannot be undone.')) {
      setDeletingId(activityId)
      setError(null)
      try {
        const { error: invokeError } = await supabase.functions.invoke('delete-activity', {
          body: { activityId },
        })

        if (invokeError) {
          throw invokeError
        }

        setActivities((prevActivities) => prevActivities.filter((act) => act.id !== activityId))
      } catch (err: any) {
        console.error('Error deleting activity:', err)
        setError(`Failed to delete activity: ${err.message}`)
      } finally {
        setDeletingId(null)
      }
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (dateString: string): string => {
    return format(new Date(dateString), 'PPp')
  }

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'uploaded': return 'bg-blue-100 text-blue-800';
      case 'processing': return 'bg-yellow-100 text-yellow-800';
      case 'processed': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'uploaded': return (<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>);
      case 'processing': return (<svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>);
      case 'processed': return (<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>);
      case 'failed': return (<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>);
      default: return null;
    }
  }

  return (
    <>
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      {activities.length === 0 ? (
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Activities Yet</h3>
          <p className="text-gray-600 mb-6">Upload your first cycling activity to get started with analysis</p>
          <button onClick={() => router.push('/upload')} className="bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 font-medium">
            Upload Your First Activity
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">{activities.length} {activities.length === 1 ? 'Activity' : 'Activities'}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Activity</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Distance</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Power</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg HR</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {activities.map((activity) => {
                  const summary = activity.data?.summary || {}
                  return (
                    <tr key={activity.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">{activity.file_name}</div>
                            <div className="text-xs text-gray-500">{formatDate(activity.upload_date)}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{summary.totalDistance ? `${summary.totalDistance.toFixed(2)} km` : '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{summary.duration ? formatDuration(summary.duration) : '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{summary.avgPower ? `${Math.round(summary.avgPower)}W` : '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{summary.avgHeartRate ? `${Math.round(summary.avgHeartRate)} bpm` : '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(activity.status)}`}>
                          {getStatusIcon(activity.status)}
                          <span className="ml-1 capitalize">{activity.status}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center space-x-4">
                          {activity.status === 'processed' ? (
                            <button onClick={() => router.push(`/activities/${activity.id}`)} className="text-blue-600 hover:text-blue-900">View Analysis</button>
                          ) : activity.status === 'failed' ? (
                            <button className="text-red-600 hover:text-red-900">Retry</button>
                          ) : null}
                          <button onClick={() => handleDelete(activity.id)} disabled={deletingId === activity.id} className="text-red-600 hover:text-red-900 disabled:opacity-50">
                            {deletingId === activity.id ? 'Deleting...' : 'Delete'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}
