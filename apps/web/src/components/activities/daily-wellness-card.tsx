'use client'

import { Activity, Heart, Moon, Scale, Droplets, Brain } from "lucide-react"

export interface WellnessData {
  weight?: number
  restingHR?: number
  hrv?: number
  hrvSDNN?: number
  sleepSecs?: number
  sleepScore?: number
  sleepQuality?: number
  vo2max?: number
  bodyFat?: number
  spO2?: number
  systolic?: number
  diastolic?: number
  readiness?: number
  comments?: string
}

interface DailyWellnessCardProps {
  wellness: WellnessData
  date?: string
}

export function DailyWellnessCard({ wellness, date }: DailyWellnessCardProps) {
  const formatSleep = (secs?: number) => {
    if (!secs) return '-'
    const hours = Math.floor(secs / 3600)
    const mins = Math.floor((secs % 3600) / 60)
    return `${hours}h ${mins}m`
  }

  const getReadinessColor = (score?: number) => {
    if (!score) return "text-gray-500"
    if (score >= 80) return "text-green-600"
    if (score >= 60) return "text-yellow-600"
    return "text-red-500"
  }

  const getSleepQualityLabel = (quality?: number) => {
    switch(quality) {
      case 1: return "Poor"
      case 2: return "Fair"
      case 3: return "Good"
      case 4: return "Excellent"
      default: return "-"
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-100 mt-6 relative overflow-hidden">
      {/* Subtle background decoration */}
      <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
        <Heart className="w-48 h-48 rotate-12" />
      </div>

      <div className="p-6 pb-4 border-b border-gray-50">
        <h3 className="flex items-center gap-2 text-xl font-bold text-gray-900 m-0">
          <Activity className="w-5 h-5 text-indigo-500" />
          Daily Wellness & Recovery
          {wellness.readiness && (
            <span className={`ml-auto text-sm px-3 py-1 bg-gray-50 rounded-full font-semibold border ${getReadinessColor(wellness.readiness).replace('text-', 'border-')}`}>
              <span className={getReadinessColor(wellness.readiness)}>
                {Math.round(wellness.readiness)} Readiness
              </span>
            </span>
          )}
        </h3>
        <p className="text-sm text-gray-500 mt-1">Morning readings{date ? ` for ${date}` : ''}</p>
      </div>
      
      <div className="p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          
          {/* Heart/Recovery */}
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-100 flex flex-col items-start hover:shadow-sm transition-shadow">
            <div className="flex items-center gap-2 mb-2 text-rose-700 font-medium">
              <Heart className="w-4 h-4" />
              Recovery
            </div>
            <div className="space-y-1 w-full">
              <div className="flex justify-between items-end">
                <span className="text-sm text-gray-600">HRV (rMSSD)</span>
                <span className="font-bold text-gray-900">{wellness.hrv ? `${Math.round(wellness.hrv)} ms` : '-'}</span>
              </div>
              <div className="flex justify-between items-end">
                <span className="text-sm text-gray-600">Resting HR</span>
                <span className="font-bold text-gray-900">{wellness.restingHR ? `${Math.round(wellness.restingHR)} bpm` : '-'}</span>
              </div>
            </div>
          </div>

          {/* Sleep */}
          <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-100 flex flex-col items-start hover:shadow-sm transition-shadow">
            <div className="flex items-center gap-2 mb-2 text-indigo-700 font-medium">
              <Moon className="w-4 h-4" />
              Sleep
            </div>
            <div className="space-y-1 w-full">
              <div className="flex justify-between items-end">
                <span className="text-sm text-gray-600">Score</span>
                <span className="font-bold text-gray-900">{wellness.sleepScore ? `${Math.round(wellness.sleepScore)}%` : '-'}</span>
              </div>
              <div className="flex justify-between items-end">
                <span className="text-sm text-gray-600">Duration</span>
                <span className="font-bold text-gray-900">{formatSleep(wellness.sleepSecs)}</span>
              </div>
              <div className="flex justify-between items-end">
                <span className="text-sm text-gray-600">Quality</span>
                <span className="font-bold text-gray-900">{getSleepQualityLabel(wellness.sleepQuality)}</span>
              </div>
            </div>
          </div>

          {/* Body Composition */}
          <div className="p-4 rounded-xl bg-teal-50 border border-teal-100 flex flex-col items-start hover:shadow-sm transition-shadow">
            <div className="flex items-center gap-2 mb-2 text-teal-700 font-medium">
              <Scale className="w-4 h-4" />
              Body Measure
            </div>
            <div className="space-y-1 w-full">
              <div className="flex justify-between items-end">
                <span className="text-sm text-gray-600">Weight</span>
                <span className="font-bold text-gray-900">{wellness.weight ? `${wellness.weight.toFixed(1)} kg` : '-'}</span>
              </div>
              <div className="flex justify-between items-end">
                <span className="text-sm text-gray-600">Body Fat</span>
                <span className="font-bold text-gray-900">{wellness.bodyFat ? `${wellness.bodyFat.toFixed(1)}%` : '-'}</span>
              </div>
            </div>
          </div>

          {/* Additional Metrics */}
          <div className="p-4 rounded-xl bg-sky-50 border border-sky-100 flex flex-col items-start hover:shadow-sm transition-shadow">
            <div className="flex items-center gap-2 mb-2 text-sky-700 font-medium">
              <Droplets className="w-4 h-4" />
              Physiology
            </div>
            <div className="space-y-1 w-full">
              <div className="flex justify-between items-end">
                <span className="text-sm text-gray-600">SpO2</span>
                <span className="font-bold text-gray-900">{wellness.spO2 ? `${Math.round(wellness.spO2)}%` : '-'}</span>
              </div>
              <div className="flex justify-between items-end">
                <span className="text-sm text-gray-600">Blood Pressure</span>
                <span className="font-bold text-gray-900">
                  {wellness.systolic && wellness.diastolic ? `${wellness.systolic}/${wellness.diastolic}` : '-'}
                </span>
              </div>
            </div>
          </div>

        </div>

        {wellness.comments && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200 text-sm italic text-gray-700 flex gap-2 shadow-inner">
            <Brain className="w-4 h-4 flex-shrink-0 text-gray-400 mt-0.5" />
            <p>"{wellness.comments}"</p>
          </div>
        )}
      </div>
    </div>
  )
}
