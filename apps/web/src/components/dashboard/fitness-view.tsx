'use client'

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { format, subDays, startOfDay, parseISO } from 'date-fns'
import { Database } from '@/lib/supabase-types'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart, ReferenceLine, ComposedChart } from 'recharts'

type Activity = Database['public']['Tables']['activities']['Row']

interface FitnessViewProps {
  userId: string
  userFtp?: number | null
  userWeight?: number | null
}

interface FitnessDataPoint {
  date: string
  fitness: number
  fatigue: number
  form: number
  tss: number
  weight?: number
}

type TimeRange = '7d' | '1m' | '3m' | '6m' | '1y' | 'all'

// Calculate CTL (Chronic Training Load) - Fitness
// Uses exponential moving average with 42-day time constant
function calculateFitness(tssHistory: Array<{ date: string; tss: number }>, days: number = 42): number {
  if (tssHistory.length === 0) return 0
  
  const cutoffDate = subDays(new Date(), days)
  const filtered = tssHistory.filter(d => new Date(d.date) >= cutoffDate)
  
  if (filtered.length === 0) return 0
  
  // Exponential moving average calculation
  const alpha = 1 - Math.exp(-1 / days)
  let ctl = 0
  
  filtered.forEach((day, index) => {
    if (index === 0) {
      ctl = day.tss
    } else {
      ctl = ctl * (1 - alpha) + day.tss * alpha
    }
  })
  
  return Math.round(ctl * 10) / 10
}

// Calculate ATL (Acute Training Load) - Fatigue
// Uses exponential moving average with 7-day time constant
function calculateFatigue(tssHistory: Array<{ date: string; tss: number }>, days: number = 7): number {
  if (tssHistory.length === 0) return 0
  
  const cutoffDate = subDays(new Date(), days)
  const filtered = tssHistory.filter(d => new Date(d.date) >= cutoffDate)
  
  if (filtered.length === 0) return 0
  
  // Exponential moving average calculation
  const alpha = 1 - Math.exp(-1 / days)
  let atl = 0
  
  filtered.forEach((day, index) => {
    if (index === 0) {
      atl = day.tss
    } else {
      atl = atl * (1 - alpha) + day.tss * alpha
    }
  })
  
  return Math.round(atl * 10) / 10
}

// Calculate TSS for an activity
function calculateActivityTSS(duration: number, power: number, ftp: number): number {
  if (!ftp || ftp <= 0 || !power || power <= 0 || !duration || duration <= 0) {
    return 0
  }
  const intensityFactor = power / ftp
  const durationHours = duration / 3600
  const tss = durationHours * intensityFactor * intensityFactor * 100
  return Math.round(tss)
}

export function FitnessView({ userId, userFtp, userWeight }: FitnessViewProps) {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState<TimeRange>('3m')
  const [fitnessData, setFitnessData] = useState<FitnessDataPoint[]>([])

  // Get date range based on selection
  const getDateRange = (range: TimeRange) => {
    const now = new Date()
    switch (range) {
      case '7d': return subDays(now, 7)
      case '1m': return subDays(now, 30)
      case '3m': return subDays(now, 90)
      case '6m': return subDays(now, 180)
      case '1y': return subDays(now, 365)
      case 'all': return subDays(now, 730) // 2 years max
      default: return subDays(now, 90)
    }
  }

  // Fetch activities
  useEffect(() => {
    const fetchActivities = async () => {
      if (!userId) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        const startDate = getDateRange(timeRange)
        
        // Get all processed activities for the user (simpler approach)
        const { data: allData, error } = await supabase
          .from('activities')
          .select('*')
          .eq('user_id', userId)
          .eq('status', 'processed')
          .order('start_time', { ascending: true, nullsFirst: true })
          .order('upload_date', { ascending: true })

        if (error) {
          console.error('Error fetching activities:', error)
          setActivities([])
          setLoading(false)
          return
        }

        // Filter by date range
        const filtered = (allData || []).filter(activity => {
          const date = activity.start_time || activity.upload_date
          if (!date) return false
          
          try {
            const activityDate = new Date(date)
            return activityDate >= startDate
          } catch {
            return false
          }
        })

        // Sort by start_time or upload_date
        filtered.sort((a, b) => {
          const dateA = a.start_time || a.upload_date || ''
          const dateB = b.start_time || b.upload_date || ''
          return dateA.localeCompare(dateB)
        })

        setActivities(filtered)
      } catch (err) {
        console.error('Error fetching activities:', err)
        setActivities([])
      } finally {
        setLoading(false)
      }
    }

    fetchActivities()
  }, [userId, timeRange])

  // Calculate fitness data
  useEffect(() => {
    if (!userFtp || activities.length === 0) {
      setFitnessData([])
      return
    }

    // Group activities by date and calculate daily TSS
    const dailyTSS: Record<string, number> = {}
    
    // Type guard for data with summary
    const getSummary = (data: any): any => {
      if (data && typeof data === 'object' && 'summary' in data) {
        return data.summary
      }
      return null
    }

    activities.forEach((activity) => {
      const date = activity.start_time || activity.upload_date
      if (!date) return
      
      try {
        const dateKey = format(startOfDay(parseISO(date)), 'yyyy-MM-dd')
        const summary = getSummary(activity.data)
        const summaryDuration = summary && typeof summary === 'object' && 'duration' in summary ? summary.duration : null
        const summaryAvgPower = summary && typeof summary === 'object' && 'avgPower' in summary ? summary.avgPower : null
        
        const duration = activity.total_timer_time || (typeof summaryDuration === 'number' ? summaryDuration : 0) || 0
        const avgPower = activity.avg_power || (typeof summaryAvgPower === 'number' ? summaryAvgPower : 0) || 0
        
        if (duration > 0 && avgPower > 0) {
          const tss = calculateActivityTSS(duration, avgPower, userFtp)
          dailyTSS[dateKey] = (dailyTSS[dateKey] || 0) + tss
        }
      } catch (err) {
        console.warn('Error processing activity date:', err)
      }
    })

    // Create date range
    const startDate = getDateRange(timeRange)
    const dates: Date[] = []
    for (let d = new Date(startDate); d <= new Date(); d.setDate(d.getDate() + 1)) {
      dates.push(new Date(d))
    }

    // Calculate rolling Fitness and Fatigue for each day
    const data: FitnessDataPoint[] = []
    
    dates.forEach(date => {
      const dateKey = format(date, 'yyyy-MM-dd')
      const dateStr = dateKey
      
      // Get TSS history up to this date
      const historyUpToDate = Object.entries(dailyTSS)
        .filter(([d]) => d <= dateKey)
        .map(([d, tss]) => ({ date: d, tss }))
        .sort((a, b) => a.date.localeCompare(b.date))

      const fitness = calculateFitness(historyUpToDate)
      const fatigue = calculateFatigue(historyUpToDate)
      const form = Math.round((fitness - fatigue) * 10) / 10
      const tss = dailyTSS[dateKey] || 0

      data.push({
        date: dateStr,
        fitness,
        fatigue,
        form,
        tss,
        weight: userWeight || undefined
      })
    })

    setFitnessData(data)
  }, [activities, userFtp, userWeight, timeRange])

  // Get current metrics (most recent non-zero values)
  const currentMetrics = useMemo(() => {
    const recent = [...fitnessData].reverse().find(d => d.fitness > 0 || d.fatigue > 0)
    return recent || { fitness: 0, fatigue: 0, form: 0, weight: userWeight || undefined }
  }, [fitnessData, userWeight])

  // Get form zone color
  const getFormColor = (form: number): string => {
    if (form >= 15) return '#10B981' // Optimal - Green
    if (form >= 5) return '#60A5FA' // Fresh - Light Blue
    if (form >= -5) return '#6B7280' // Grey Zone - Grey
    if (form >= -15) return '#F59E0B' // Transition - Yellow/Orange
    return '#EF4444' // High Risk - Red
  }

  const getFormLabel = (form: number): string => {
    if (form >= 15) return 'Optimal'
    if (form >= 5) return 'Fresh'
    if (form >= -5) return 'Grey Zone'
    if (form >= -15) return 'Transition'
    return 'High Risk'
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading fitness data...</p>
      </div>
    )
  }

  if (!userFtp) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-8 text-center">
        <p className="text-gray-600 mb-4">Set your FTP in Settings to view fitness metrics</p>
        <a 
          href="/settings" 
          className="text-blue-600 hover:text-blue-800 underline"
        >
          Go to Settings
        </a>
      </div>
    )
  }

  if (fitnessData.length === 0 && !loading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-8 text-center">
        <p className="text-gray-600 mb-4">
          No fitness data available. Upload and process activities to see your fitness metrics.
        </p>
        {activities.length === 0 && (
          <p className="text-sm text-gray-500">
            Make sure your activities are processed and have power data.
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6">
      {/* Time Range Selector */}
      <div className="flex flex-wrap items-center justify-between mb-6 gap-3">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Fitness & Fatigue</h2>
        <div className="flex gap-2">
          {(['7d', '1m', '3m', '6m', '1y', 'all'] as TimeRange[]).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`
                px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors
                ${timeRange === range
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }
              `}
            >
              {range === '7d' ? '7 days' :
               range === '1m' ? '1 month' :
               range === '3m' ? '3 months' :
               range === '6m' ? '6 months' :
               range === '1y' ? '1 year' : 'All'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Combined Chart Section */}
        <div className="lg:col-span-3">
          {/* Combined Fitness, Fatigue, Form, and Weight Chart */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Fitness Overview</h3>
            <ResponsiveContainer width="100%" height={500}>
              <ComposedChart data={fitnessData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="fitnessGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="fatigueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#9333EA" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#9333EA" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="formGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#EF4444" stopOpacity={0.2} />
                    <stop offset="25%" stopColor="#F59E0B" stopOpacity={0.2} />
                    <stop offset="50%" stopColor="#6B7280" stopOpacity={0.2} />
                    <stop offset="75%" stopColor="#60A5FA" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#10B981" stopOpacity={0.2} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(value) => format(parseISO(value), 'MMM d')}
                  stroke="#6B7280"
                  fontSize={11}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis 
                  yAxisId="left"
                  label={{ value: 'Training Load / Form', angle: -90, position: 'insideLeft' }}
                  stroke="#6B7280"
                  fontSize={11}
                />
                {userWeight && (
                  <YAxis 
                    yAxisId="right"
                    orientation="right"
                    label={{ value: 'Weight (kg)', angle: 90, position: 'insideRight' }}
                    stroke="#059669"
                    fontSize={11}
                    domain={['dataMin - 2', 'dataMax + 2']}
                  />
                )}
                <Tooltip 
                  labelFormatter={(value) => format(parseISO(value), 'PP')}
                  formatter={(value: number, name: string) => {
                    if (name === 'Form') {
                      const formValue = typeof value === 'number' ? value : 0
                      return [`${formValue.toFixed(1)} (${getFormLabel(formValue)})`, 'Form']
                    }
                    if (name === 'Weight') {
                      return [`${value} kg`, 'Weight']
                    }
                    return [value.toFixed(1), name]
                  }}
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #E5E7EB', borderRadius: '6px' }}
                />
                <Legend />
                {/* Form zone reference areas */}
                <ReferenceLine yAxisId="left" y={0} stroke="#6B7280" strokeDasharray="2 2" strokeOpacity={0.4} />
                <ReferenceLine yAxisId="left" y={15} stroke="#10B981" strokeDasharray="2 2" strokeOpacity={0.3} />
                <ReferenceLine yAxisId="left" y={5} stroke="#60A5FA" strokeDasharray="2 2" strokeOpacity={0.3} />
                <ReferenceLine yAxisId="left" y={-5} stroke="#6B7280" strokeDasharray="2 2" strokeOpacity={0.3} />
                <ReferenceLine yAxisId="left" y={-15} stroke="#F59E0B" strokeDasharray="2 2" strokeOpacity={0.3} />
                {/* Fitness Area */}
                <Area 
                  type="monotone" 
                  yAxisId="left"
                  dataKey="fitness" 
                  name="Fitness" 
                  stroke="#3B82F6" 
                  fill="url(#fitnessGradient)"
                  strokeWidth={2}
                  dot={false}
                />
                {/* Fatigue Area */}
                <Area 
                  type="monotone" 
                  yAxisId="left"
                  dataKey="fatigue" 
                  name="Fatigue" 
                  stroke="#9333EA" 
                  fill="url(#fatigueGradient)"
                  strokeWidth={2}
                  dot={false}
                />
                {/* Form Line */}
                <Line 
                  type="monotone" 
                  yAxisId="left"
                  dataKey="form" 
                  name="Form"
                  stroke="#6B7280"
                  strokeWidth={2}
                  dot={{ r: 0 }}
                  activeDot={{ r: 4, fill: '#6B7280' }}
                  connectNulls
                />
                {/* Weight Line (if available) */}
                {userWeight && (
                  <Line 
                    type="monotone" 
                    yAxisId="right"
                    dataKey="weight" 
                    name="Weight"
                    stroke="#059669" 
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Current Metrics Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-gray-50 rounded-lg p-4 space-y-4 sticky top-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Current Metrics</h3>
            
            <div>
              <div className="text-xs text-gray-500 mb-1">Fitness</div>
              <div className="text-2xl font-bold text-blue-600">{currentMetrics.fitness.toFixed(1)}</div>
            </div>

            <div>
              <div className="text-xs text-gray-500 mb-1">Fatigue</div>
              <div className="text-2xl font-bold text-purple-600">{currentMetrics.fatigue.toFixed(1)}</div>
            </div>

            <div>
              <div className="text-xs text-gray-500 mb-1">Form</div>
              <div 
                className="text-2xl font-bold"
                style={{ color: getFormColor(currentMetrics.form) }}
              >
                {currentMetrics.form.toFixed(1)}
              </div>
              <div className="text-xs text-gray-600 mt-1">{getFormLabel(currentMetrics.form)}</div>
            </div>

            {currentMetrics.weight && (
              <div>
                <div className="text-xs text-gray-500 mb-1">Weight</div>
                <div className="text-2xl font-bold text-green-600">{currentMetrics.weight.toFixed(1)} kg</div>
              </div>
            )}

            {/* Form Zone Legend */}
            <div className="pt-4 border-t border-gray-200">
              <div className="text-xs font-semibold text-gray-700 mb-2">Form Zones</div>
              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded"></div>
                  <span className="text-gray-600">Optimal (≥15)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-400 rounded"></div>
                  <span className="text-gray-600">Fresh (≥5)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-gray-400 rounded"></div>
                  <span className="text-gray-600">Grey Zone (≥-5)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-yellow-500 rounded"></div>
                  <span className="text-gray-600">Transition (≥-15)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded"></div>
                  <span className="text-gray-600">High Risk (&lt;-15)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

