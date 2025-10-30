'use client'

import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { UserMenu } from '@/components/auth/user-menu'
import { ChangePasswordForm } from '@/components/auth/change-password-form'
import { supabase } from '@/lib/supabase'

export default function SettingsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [ftp, setFtp] = useState<string>('')
  const [savingFtp, setSavingFtp] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [preferences, setPreferences] = useState<any | null>(null)

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/signin')
    }
  }, [user, loading, router])

  useEffect(() => {
    const loadPreferences = async () => {
      if (!user) return
      try {
        const { data, error } = await supabase
          .from('users')
          .select('preferences')
          .eq('id', user.id)
          .maybeSingle()
        if (error) throw error
        const prefs = data?.preferences || {}
        setPreferences(prefs)
        if (prefs.ftp) setFtp(String(prefs.ftp))
      } catch (err: any) {
        setLoadError(err.message || 'Failed to load preferences')
      }
    }
    loadPreferences()
  }, [user])

  const handleSaveFtp = async () => {
    if (!user) return
    setSavingFtp(true)
    setSaveError(null)
    setSuccessMsg(null)
    try {
      const ftpNum = parseInt(ftp, 10)
      if (isNaN(ftpNum) || ftpNum <= 0) {
        setSaveError('Please enter a valid FTP in watts')
        setSavingFtp(false)
        return
      }
      const nextPrefs = { ...(preferences || {}), ftp: ftpNum }
      const { error } = await supabase
        .from('users')
        .update({ preferences: nextPrefs })
        .eq('id', user.id)
      if (error) throw error
      setPreferences(nextPrefs)
      setSuccessMsg('FTP saved')
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save FTP')
    } finally {
      setSavingFtp(false)
      setTimeout(() => setSuccessMsg(null), 2000)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Navigation */}
      <nav className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              ← Back to Dashboard
            </button>
            <h1 className="text-xl font-bold text-gray-900">Settings</h1>
          </div>
          <UserMenu />
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Account Information */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Account Information</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <p className="text-gray-900">{user.email}</p>
              </div>
              {user.user_metadata?.name && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Name</label>
                  <p className="text-gray-900">{user.user_metadata.name}</p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700">Member Since</label>
                <p className="text-gray-900">
                  {new Date(user.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>
            </div>
          </div>

          {/* Change Password */}
          <ChangePasswordForm />

          {/* Security Options */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Security</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Forgot Password?</h4>
                  <p className="text-sm text-gray-500">Reset your password via email</p>
                </div>
                <button
                  onClick={() => router.push('/auth/forgot-password')}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm"
                >
                  Reset Password
                </button>
              </div>
            </div>
          </div>

          {/* Preferences */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Preferences</h3>
            <div className="space-y-4">
              {/* FTP */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Functional Threshold Power (FTP)</label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={ftp}
                    onChange={(e) => setFtp(e.target.value)}
                    placeholder="e.g. 250"
                    className="w-40 border rounded-md px-3 py-2 text-sm"
                    min={1}
                  />
                  <span className="text-sm text-gray-600">watts</span>
                  <button
                    onClick={handleSaveFtp}
                    disabled={savingFtp}
                    className="bg-blue-600 text-white px-3 py-2 rounded-md hover:bg-blue-700 text-sm disabled:opacity-50"
                  >
                    {savingFtp ? 'Saving...' : 'Save'}
                  </button>
                </div>
                {loadError && <div className="text-sm text-red-600 mt-1">{loadError}</div>}
                {saveError && <div className="text-sm text-red-600 mt-1">{saveError}</div>}
                {successMsg && <div className="text-sm text-green-600 mt-1">{successMsg}</div>}
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Email Notifications</h4>
                  <p className="text-sm text-gray-500">Receive weekly summaries and updates</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" defaultChecked />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Workout Reminders</h4>
                  <p className="text-sm text-gray-500">Get reminded about training sessions</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" defaultChecked />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

