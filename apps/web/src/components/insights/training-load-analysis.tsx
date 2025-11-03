'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { format, subDays, startOfDay } from 'date-fns'

interface TrainingLoadAnalysisProps {
  userId: string
  userFtp: number | null
}

interface FitnessDataPoint {
  date: string
  fitness: number
  fatigue: number
  form: number
}

export function TrainingLoadAnalysis({ userId, userFtp }: TrainingLoadAnalysisProps) {
  const [fitnessData, setFitnessData] = useState<FitnessDataPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [currentMetrics, setCurrentMetrics] = useState({
    fitness: 0,
    fatigue: 0,
    form: 0,
  })

  useEffect(() => {
    const fetchAndCalculate = async () => {
      if (!userId || !userFtp) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        const { data: activities, error } = await supabase
          .from('activities')
          .select('start_time, upload_date, total_timer_time, avg_power')
          .eq('user_id', userId)
          .eq('status', 'processed')
          .order('start_time', { ascending: true, nullsFirst: true })
          .order('upload_date', { ascending: true })

        if (error) {
          console.error('Error fetching activities:', error)
          return
        }

        // Calculate daily TSS
        const dailyTSS: Record<string, number> = {}
        activities?.forEach((activity) => {
          const date = activity.start_time || activity.upload_date
          if (!date) return

          const duration = activity.total_timer_time || 0
          const power = activity.avg_power || 0

          if (duration > 0 && power > 0 && userFtp > 0) {
            const intensityFactor = power / userFtp
            const durationHours = duration / 3600
            const tss = durationHours * intensityFactor * intensityFactor * 100

            const dateKey = format(startOfDay(new Date(date)), 'yyyy-MM-dd')
            dailyTSS[dateKey] = (dailyTSS[dateKey] || 0) + Math.round(tss)
          }
        })

        // Calculate CTL (Fitness) and ATL (Fatigue) over time
        const dataPoints: FitnessDataPoint[] = []
        const startDate = subDays(new Date(), 90)
        const today = new Date()

        for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
          const dateKey = format(startOfDay(d), 'yyyy-MM-dd')
          const tss = dailyTSS[dateKey] || 0

          // Calculate CTL (42-day time constant)
          const ctlDays = 42
          const ctlAlpha = 1 - Math.exp(-1 / ctlDays)
          let ctl = 0

          // Calculate ATL (7-day time constant)
          const atlDays = 7
          const atlAlpha = 1 - Math.exp(-1 / atlDays)
          let atl = 0

          // Get historical TSS for this date
          const historicalTSS: Array<{ date: string; tss: number }> = []
          for (let h = new Date(startDate); h <= d; h.setDate(h.getDate() + 1)) {
            const hKey = format(startOfDay(h), 'yyyy-MM-dd')
            if (dailyTSS[hKey]) {
              historicalTSS.push({ date: hKey, tss: dailyTSS[hKey] })
            }
          }

          // Calculate CTL
          historicalTSS.forEach((day, index) => {
            if (index === 0) {
              ctl = day.tss
            } else {
              ctl = ctl * (1 - ctlAlpha) + day.tss * ctlAlpha
            }
          })

          // Calculate ATL (last 7 days)
          const last7Days = historicalTSS.slice(-7)
          last7Days.forEach((day, index) => {
            if (index === 0) {
              atl = day.tss
            } else {
              atl = atl * (1 - atlAlpha) + day.tss * atlAlpha
            }
          })

          const form = ctl - atl

          dataPoints.push({
            date: dateKey,
            fitness: Math.round(ctl * 10) / 10,
            fatigue: Math.round(atl * 10) / 10,
            form: Math.round(form * 10) / 10,
          })
        }

        setFitnessData(dataPoints)

        // Set current metrics (latest values)
        if (dataPoints.length > 0) {
          const latest = dataPoints[dataPoints.length - 1]
          setCurrentMetrics({
            fitness: latest.fitness,
            fatigue: latest.fatigue,
            form: latest.form,
          })
        }
      } catch (err) {
        console.error('Error calculating training load:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchAndCalculate()
  }, [userId, userFtp])

  const getFormColor = (form: number): string => {
    if (form > 10) return 'text-green-600 bg-green-50'
    if (form > 0) return 'text-blue-600 bg-blue-50'
    if (form > -10) return 'text-yellow-600 bg-yellow-50'
    return 'text-red-600 bg-red-50'
  }

  const getFormLabel = (form: number): string => {
    if (form > 10) return 'Peak'
    if (form > 0) return 'Fresh'
    if (form > -10) return 'Tired'
    return 'Exhausted'
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  if (!userFtp) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Training Load Analysis</h2>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">
            Please set your FTP in Settings to view training load analysis.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Training Load Analysis</h2>

      {/* Current Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="text-sm text-gray-600 mb-1">Fitness (CTL)</div>
          <div className="text-3xl font-bold text-blue-600">
            {currentMetrics.fitness.toFixed(1)}
          </div>
          <div className="text-xs text-gray-500 mt-1">42-day average</div>
        </div>
        <div className="bg-orange-50 rounded-lg p-4">
          <div className="text-sm text-gray-600 mb-1">Fatigue (ATL)</div>
          <div className="text-3xl font-bold text-orange-600">
            {currentMetrics.fatigue.toFixed(1)}
          </div>
          <div className="text-xs text-gray-500 mt-1">7-day average</div>
        </div>
        <div className={`rounded-lg p-4 ${getFormColor(currentMetrics.form)}`}>
          <div className="text-sm text-gray-600 mb-1">Form (TSB)</div>
          <div className="text-3xl font-bold">{currentMetrics.form.toFixed(1)}</div>
          <div className="text-xs text-gray-600 mt-1">
            {getFormLabel(currentMetrics.form)} • CTL - ATL
          </div>
        </div>
      </div>

      {/* Form Zone Legend */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Form Zones</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-green-500 rounded mr-2"></div>
            <span>Peak (+10+)</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-blue-500 rounded mr-2"></div>
            <span>Fresh (0-10)</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-yellow-500 rounded mr-2"></div>
            <span>Tired (-10-0)</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-red-500 rounded mr-2"></div>
            <span>Exhausted (-10-)</span>
          </div>
        </div>
      </div>

      {/* Insights */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">What This Means:</h3>
        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
          <li>
            <strong>Fitness (CTL)</strong>: Your long-term training load. Higher = more fit.
          </li>
          <li>
            <strong>Fatigue (ATL)</strong>: Your short-term training load. Higher = more tired.
          </li>
          <li>
            <strong>Form (TSB)</strong>: Your readiness to perform. Positive = fresh, negative =
            tired.
          </li>
          <li>
            Optimal training: Build fitness when form is positive, recover when form is very
            negative.
          </li>
        </ul>
      </div>
    </div>
  )
}

