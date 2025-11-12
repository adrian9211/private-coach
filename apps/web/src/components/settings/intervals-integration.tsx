'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface IntervalsConnection {
  id: string
  athlete_id: string
  connected_at: string
  last_sync_at: string | null
  sync_enabled: boolean
}

interface IntervalsIntegrationProps {
  userId: string
}

export function IntervalsIntegration({ userId }: IntervalsIntegrationProps) {
  const [connection, setConnection] = useState<IntervalsConnection | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    loadConnection()
    
    // Check for OAuth callback success
    const params = new URLSearchParams(window.location.search)
    if (params.get('intervals') === 'connected') {
      setSuccess('Successfully connected to Intervals.icu!')
      // Clear URL parameter
      window.history.replaceState({}, '', '/settings')
      // Reload connection
      setTimeout(() => loadConnection(), 1000)
    }
  }, [userId])

  const loadConnection = async () => {
    try {
      const { data, error } = await supabase
        .from('intervals_connections')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()

      if (error && error.code !== 'PGRST116') {
        throw error
      }

      setConnection(data)
    } catch (err: any) {
      console.error('Error loading Intervals.icu connection:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleConnect = () => {
    const clientId = process.env.NEXT_PUBLIC_INTERVALS_CLIENT_ID
    const redirectUri = process.env.NEXT_PUBLIC_INTERVALS_REDIRECT_URI

    if (!clientId || !redirectUri) {
      setError('Intervals.icu OAuth is not configured. Please contact support.')
      return
    }

    // Build OAuth URL
    const authUrl = new URL('https://intervals.icu/oauth/authorize')
    authUrl.searchParams.set('client_id', clientId)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('scope', 'ACTIVITY:READ,ATHLETE:READ') // Request necessary permissions
    authUrl.searchParams.set('state', userId) // Pass user ID for callback

    // Redirect to Intervals.icu OAuth
    window.location.href = authUrl.toString()
  }

  const handleSync = async () => {
    setSyncing(true)
    setError(null)
    setSuccess(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('Not authenticated')
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/intervals-sync-activities`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Sync failed')
      }

      const result = await response.json()
      setSuccess(`Synced ${result.synced} of ${result.total} activities`)
      
      // Reload connection to update last_sync_at
      await loadConnection()
    } catch (err: any) {
      console.error('Sync error:', err)
      setError(err.message || 'Failed to sync activities')
    } finally {
      setSyncing(false)
    }
  }

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect from Intervals.icu? Your existing activities will not be deleted.')) {
      return
    }

    setDisconnecting(true)
    setError(null)
    setSuccess(null)

    try {
      const { error } = await supabase
        .from('intervals_connections')
        .delete()
        .eq('user_id', userId)

      if (error) throw error

      setConnection(null)
      setSuccess('Disconnected from Intervals.icu')
    } catch (err: any) {
      console.error('Disconnect error:', err)
      setError(err.message || 'Failed to disconnect')
    } finally {
      setDisconnecting(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Intervals.icu Integration</h3>
          <p className="text-sm text-gray-600 mt-1">
            Automatically sync your activities and training data
          </p>
        </div>
        <img 
          src="https://intervals.icu/logo192.png" 
          alt="Intervals.icu" 
          className="w-12 h-12"
        />
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
          <p className="text-sm text-green-600">{success}</p>
        </div>
      )}

      {!connection ? (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
          <svg className="w-12 h-12 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <h4 className="text-lg font-medium text-gray-900 mb-2">Connect Intervals.icu</h4>
          <p className="text-sm text-gray-600 mb-4 max-w-md mx-auto">
            Automatically import activities, wellness data, and training metrics from Intervals.icu.
            No more manual uploads!
          </p>
          <button
            onClick={handleConnect}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            Connect to Intervals.icu
          </button>
        </div>
      ) : (
        <div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-green-600 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-medium text-green-900">Connected</p>
                <p className="text-xs text-green-700 mt-0.5">
                  Athlete ID: {connection.athlete_id}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3 mb-4">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Connected:</span>
              <span className="font-medium text-gray-900">
                {new Date(connection.connected_at).toLocaleDateString()}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Last Sync:</span>
              <span className="font-medium text-gray-900">
                {connection.last_sync_at 
                  ? new Date(connection.last_sync_at).toLocaleString()
                  : 'Never'}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Auto-sync:</span>
              <span className={`font-medium ${connection.sync_enabled ? 'text-green-600' : 'text-gray-600'}`}>
                {connection.sync_enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {syncing ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Syncing...
                </span>
              ) : (
                'Sync Now'
              )}
            </button>
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {disconnecting ? 'Disconnecting...' : 'Disconnect'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

