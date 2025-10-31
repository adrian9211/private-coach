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
  const [weight, setWeight] = useState<string>('')
  const [vo2Max, setVo2Max] = useState<string>('')
  const [trainingGoals, setTrainingGoals] = useState<string>('')
  const [weeklyHours, setWeeklyHours] = useState<string>('')
  const [savingFtp, setSavingFtp] = useState(false)
  const [savingWeight, setSavingWeight] = useState(false)
  const [savingVo2Max, setSavingVo2Max] = useState(false)
  const [savingGoals, setSavingGoals] = useState(false)
  const [savingHours, setSavingHours] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveErrorField, setSaveErrorField] = useState<'ftp' | 'weight' | 'vo2' | null>(null)
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
        // Try to select all performance and goal fields, but fallback to basic query if columns don't exist
        const { data, error } = await supabase
          .from('users')
          .select('preferences, weight_kg, vo2_max, training_goals, weekly_training_hours')
          .eq('id', user.id)
          .maybeSingle()
        
        if (error) {
          // If error mentions missing columns, try without them
          if (error.message.includes('weight_kg') || error.message.includes('vo2_max') || error.code === '42703') {
            const { data: basicData, error: basicError } = await supabase
              .from('users')
              .select('preferences')
              .eq('id', user.id)
              .maybeSingle()
            if (basicError) throw basicError
            const prefs = basicData?.preferences || {}
            setPreferences(prefs)
            if (prefs.ftp) setFtp(String(prefs.ftp))
            // Columns don't exist yet - migration not applied
            console.warn('weight_kg and vo2_max columns not found. Please apply migration.')
            return
          }
          throw error
        }
        
        const prefs = data?.preferences || {}
        setPreferences(prefs)
        if (prefs.ftp) setFtp(String(prefs.ftp))
        // Safely access weight_kg, vo2_max, goals, and hours (they might not exist in the response)
        if (data && 'weight_kg' in data && data.weight_kg) setWeight(String(data.weight_kg))
        if (data && 'vo2_max' in data && data.vo2_max) setVo2Max(String(data.vo2_max))
        if (data && 'training_goals' in data && data.training_goals) setTrainingGoals(data.training_goals)
        if (data && 'weekly_training_hours' in data && data.weekly_training_hours) setWeeklyHours(String(data.weekly_training_hours))
      } catch (err: any) {
        console.error('Error loading preferences:', err)
        setLoadError(err.message || 'Failed to load preferences')
      }
    }
    loadPreferences()
  }, [user])

  const handleSaveFtp = async () => {
    if (!user) {
      console.error('Cannot save FTP: user not available')
      return
    }
    setSavingFtp(true)
    setSaveError(null)
    setSaveErrorField(null)
    setSuccessMsg(null)
    try {
      const ftpNum = parseInt(ftp, 10)
      console.log('Saving FTP:', ftpNum, 'for user:', user.id)
      if (isNaN(ftpNum) || ftpNum <= 0) {
        setSaveError('Please enter a valid FTP in watts')
        setSaveErrorField('ftp')
        setSavingFtp(false)
        return
      }
      const nextPrefs = { ...(preferences || {}), ftp: ftpNum }
      console.log('Updating preferences:', nextPrefs)
      const { error } = await supabase
        .from('users')
        .update({ preferences: nextPrefs })
        .eq('id', user.id)
      
      console.log('Update response - error:', error)
      if (error) {
        console.error('Error saving FTP:', error)
        throw error
      }
      // Update was successful - update local state
      setPreferences(nextPrefs)
      setSuccessMsg('FTP saved')
      console.log('FTP saved successfully')
    } catch (err: any) {
      console.error('Exception saving FTP:', err)
      setSaveError(err.message || 'Failed to save FTP')
      setSaveErrorField('ftp')
    } finally {
      setSavingFtp(false)
      setTimeout(() => {
        setSuccessMsg(null)
        setSaveError(null)
        setSaveErrorField(null)
      }, 3000)
    }
  }

  const handleSaveWeight = async () => {
    if (!user) {
      console.error('Cannot save weight: user not available')
      return
    }
    setSavingWeight(true)
    setSaveError(null)
    setSaveErrorField(null)
    setSuccessMsg(null)
    try {
      const weightNum = parseFloat(weight)
      console.log('Saving weight:', weightNum, 'for user:', user.id)
      if (isNaN(weightNum) || weightNum <= 0 || weightNum >= 300) {
        setSaveError('Please enter a valid weight between 1-300 kg')
        setSaveErrorField('weight')
        setSavingWeight(false)
        return
      }
      console.log('Updating weight_kg:', weightNum)
      const { error } = await supabase
        .from('users')
        .update({ weight_kg: weightNum })
        .eq('id', user.id)
      
      console.log('Update response - error:', error)
      if (error) {
        console.error('Error saving weight:', error)
        // If column doesn't exist, guide user to apply migration
        if (error.message?.includes('weight_kg') || error.code === '42703') {
          setSaveError('Weight column not found. Please apply the database migration first.')
          setSaveErrorField('weight')
        } else {
          throw error
        }
      } else {
        // Update was successful
        setSuccessMsg('Weight saved')
        console.log('Weight saved successfully')
      }
    } catch (err: any) {
      console.error('Exception saving weight:', err)
      setSaveError(err.message || 'Failed to save weight')
      setSaveErrorField('weight')
    } finally {
      setSavingWeight(false)
      setTimeout(() => {
        setSuccessMsg(null)
        setSaveError(null)
        setSaveErrorField(null)
      }, 3000)
    }
  }

  const handleSaveVo2Max = async () => {
    if (!user) {
      console.error('Cannot save VO2 max: user not available')
      return
    }
    setSavingVo2Max(true)
    setSaveError(null)
    setSaveErrorField(null)
    setSuccessMsg(null)
    try {
      const vo2Num = parseFloat(vo2Max)
      console.log('Saving VO2 max:', vo2Num, 'for user:', user.id)
      if (isNaN(vo2Num) || vo2Num <= 0 || vo2Num >= 100) {
        setSaveError('Please enter a valid VO2 max between 1-100 ml/kg/min')
        setSaveErrorField('vo2')
        setSavingVo2Max(false)
        return
      }
      console.log('Updating vo2_max:', vo2Num)
      const { error } = await supabase
        .from('users')
        .update({ vo2_max: vo2Num })
        .eq('id', user.id)
      
      console.log('Update response - error:', error)
      if (error) {
        console.error('Error saving VO2 max:', error)
        // If column doesn't exist, guide user to apply migration
        if (error.message?.includes('vo2_max') || error.code === '42703') {
          setSaveError('VO2 max column not found. Please apply the database migration first.')
          setSaveErrorField('vo2')
        } else {
          throw error
        }
      } else {
        // Update was successful
        setSuccessMsg('VO2 max saved')
        console.log('VO2 max saved successfully')
      }
    } catch (err: any) {
      console.error('Exception saving VO2 max:', err)
      setSaveError(err.message || 'Failed to save VO2 max')
      setSaveErrorField('vo2')
    } finally {
      setSavingVo2Max(false)
      setTimeout(() => {
        setSuccessMsg(null)
        setSaveError(null)
        setSaveErrorField(null)
      }, 3000)
    }
  }

  const handleSaveGoals = async () => {
    if (!user) {
      console.error('Cannot save goals: user not available')
      return
    }
    setSavingGoals(true)
    setSaveError(null)
    setSaveErrorField(null)
    setSuccessMsg(null)
    try {
      console.log('Saving training goals:', trainingGoals, 'for user:', user.id)
      const { error } = await supabase
        .from('users')
        .update({ training_goals: trainingGoals || null })
        .eq('id', user.id)
      
      console.log('Update response - error:', error)
      if (error) {
        console.error('Error saving goals:', error)
        if (error.message?.includes('training_goals') || error.code === '42703') {
          setSaveError('Training goals column not found. Please apply the database migration first.')
          setSaveErrorField(null)
        } else {
          throw error
        }
      } else {
        setSuccessMsg('Training goals saved')
        console.log('Training goals saved successfully')
      }
    } catch (err: any) {
      console.error('Exception saving goals:', err)
      setSaveError(err.message || 'Failed to save training goals')
    } finally {
      setSavingGoals(false)
      setTimeout(() => {
        setSuccessMsg(null)
        setSaveError(null)
        setSaveErrorField(null)
      }, 3000)
    }
  }

  const handleSaveHours = async () => {
    if (!user) {
      console.error('Cannot save weekly hours: user not available')
      return
    }
    setSavingHours(true)
    setSaveError(null)
    setSaveErrorField(null)
    setSuccessMsg(null)
    try {
      const hoursNum = parseFloat(weeklyHours)
      console.log('Saving weekly hours:', hoursNum, 'for user:', user.id)
      if (weeklyHours && (isNaN(hoursNum) || hoursNum < 0 || hoursNum > 40)) {
        setSaveError('Please enter a valid number of hours between 0-40')
        setSavingHours(false)
        return
      }
      console.log('Updating weekly_training_hours:', hoursNum || null)
      const { error } = await supabase
        .from('users')
        .update({ weekly_training_hours: hoursNum || null })
        .eq('id', user.id)
      
      console.log('Update response - error:', error)
      if (error) {
        console.error('Error saving weekly hours:', error)
        if (error.message?.includes('weekly_training_hours') || error.code === '42703') {
          setSaveError('Weekly hours column not found. Please apply the database migration first.')
          setSaveErrorField(null)
        } else {
          throw error
        }
      } else {
        setSuccessMsg('Weekly training hours saved')
        console.log('Weekly training hours saved successfully')
      }
    } catch (err: any) {
      console.error('Exception saving weekly hours:', err)
      setSaveError(err.message || 'Failed to save weekly training hours')
    } finally {
      setSavingHours(false)
      setTimeout(() => {
        setSuccessMsg(null)
        setSaveError(null)
        setSaveErrorField(null)
      }, 3000)
    }
  }

  // Calculate FTP/kg if both values are available
  const ftpPerKg = ftp && weight && parseFloat(ftp) > 0 && parseFloat(weight) > 0
    ? (parseFloat(ftp) / parseFloat(weight)).toFixed(2)
    : null

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

          {/* Performance Settings */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Performance Settings</h3>
            <p className="text-sm text-gray-600 mb-4">
              These metrics are crucial for power-to-weight analysis and AI coaching recommendations.
            </p>
            <div className="space-y-4">
              {/* FTP */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Functional Threshold Power (FTP)
                </label>
                <div className="flex items-center gap-3 flex-wrap">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={ftp}
                    onChange={(e) => setFtp(e.target.value)}
                    placeholder="e.g. 250"
                    className="w-32 border rounded-md px-3 py-2 text-sm"
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
                  {ftpPerKg && (
                    <span className="text-sm font-semibold text-blue-700 ml-2">
                      FTP/kg: {ftpPerKg} W/kg
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Power-to-weight ratio: {ftpPerKg ? `${ftpPerKg} W/kg` : 'Enter weight to calculate'}
                </p>
                {saveErrorField === 'ftp' && saveError && (
                  <div className="text-sm text-red-600 mt-1">{saveError}</div>
                )}
                {saveErrorField === 'ftp' && successMsg && (
                  <div className="text-sm text-green-600 mt-1">{successMsg}</div>
                )}
              </div>

              {/* Weight */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Weight (kg)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    inputMode="decimal"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    placeholder="e.g. 70.5"
                    className="w-32 border rounded-md px-3 py-2 text-sm"
                    min={1}
                    max={300}
                    step="0.1"
                  />
                  <span className="text-sm text-gray-600">kg</span>
                  <button
                    onClick={handleSaveWeight}
                    disabled={savingWeight}
                    className="bg-blue-600 text-white px-3 py-2 rounded-md hover:bg-blue-700 text-sm disabled:opacity-50"
                  >
                    {savingWeight ? 'Saving...' : 'Save'}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Used to calculate FTP/kg (power-to-weight ratio) - critical cycling performance metric
                </p>
                {saveErrorField === 'weight' && saveError && (
                  <div className="text-sm text-red-600 mt-1">{saveError}</div>
                )}
                {saveErrorField === 'weight' && successMsg && (
                  <div className="text-sm text-green-600 mt-1">{successMsg}</div>
                )}
              </div>

              {/* VO2 Max */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  VO2 Max (ml/kg/min)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    inputMode="decimal"
                    value={vo2Max}
                    onChange={(e) => setVo2Max(e.target.value)}
                    placeholder="e.g. 52.5"
                    className="w-32 border rounded-md px-3 py-2 text-sm"
                    min={1}
                    max={100}
                    step="0.1"
                  />
                  <span className="text-sm text-gray-600">ml/kg/min</span>
                  <button
                    onClick={handleSaveVo2Max}
                    disabled={savingVo2Max}
                    className="bg-blue-600 text-white px-3 py-2 rounded-md hover:bg-blue-700 text-sm disabled:opacity-50"
                  >
                    {savingVo2Max ? 'Saving...' : 'Save'}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Maximum oxygen uptake - can be read from Garmin Connect. Used for aerobic capacity analysis.
                </p>
                {saveErrorField === 'vo2' && saveError && (
                  <div className="text-sm text-red-600 mt-1">{saveError}</div>
                )}
                {saveErrorField === 'vo2' && successMsg && (
                  <div className="text-sm text-green-600 mt-1">{successMsg}</div>
                )}
              </div>

              {loadError && <div className="text-sm text-red-600 mt-1">{loadError}</div>}
            </div>
          </div>

          {/* Training Goals & Availability */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Training Goals & Availability</h3>
            <p className="text-sm text-gray-600 mb-4">
              Help your AI coach understand your objectives and time constraints for personalized recommendations.
            </p>
            <div className="space-y-4">
              {/* Training Goals */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Your Training Goals
                </label>
                <textarea
                  value={trainingGoals}
                  onChange={(e) => setTrainingGoals(e.target.value)}
                  placeholder="e.g., Improve FTP/kg to 4.0 W/kg, complete a century ride, prepare for upcoming race..."
                  className="w-full border rounded-md px-3 py-2 text-sm min-h-[100px]"
                  rows={4}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Describe your cycling goals, aspirations, and what you want to achieve. This helps the AI coach tailor recommendations.
                </p>
                <button
                  onClick={handleSaveGoals}
                  disabled={savingGoals}
                  className="mt-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm disabled:opacity-50"
                >
                  {savingGoals ? 'Saving...' : 'Save Goals'}
                </button>
                {saveError && !saveErrorField && successMsg && (
                  <div className="text-sm text-green-600 mt-1">{successMsg}</div>
                )}
                {saveError && !saveErrorField && !successMsg && (
                  <div className="text-sm text-red-600 mt-1">{saveError}</div>
                )}
              </div>

              {/* Weekly Training Hours */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Achievable Training Hours Per Week
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    inputMode="decimal"
                    value={weeklyHours}
                    onChange={(e) => setWeeklyHours(e.target.value)}
                    placeholder="e.g. 8"
                    className="w-32 border rounded-md px-3 py-2 text-sm"
                    min={0}
                    max={40}
                    step="0.5"
                  />
                  <span className="text-sm text-gray-600">hours/week</span>
                  <button
                    onClick={handleSaveHours}
                    disabled={savingHours}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm disabled:opacity-50"
                  >
                    {savingHours ? 'Saving...' : 'Save'}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Realistic number of hours you can dedicate to training each week. Critical for time-optimized workout recommendations.
                </p>
                {saveError && !saveErrorField && (
                  <div className="text-sm text-red-600 mt-1">{saveError}</div>
                )}
                {successMsg && !saveErrorField && (
                  <div className="text-sm text-green-600 mt-1">{successMsg}</div>
                )}
              </div>
            </div>
          </div>

          {/* Preferences */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Preferences</h3>
            <div className="space-y-4">

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

