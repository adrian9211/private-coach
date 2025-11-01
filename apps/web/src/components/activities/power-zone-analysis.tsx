'use client'

import { useMemo } from 'react'
import { Database } from '@/lib/supabase-types'

type Activity = Database['public']['Tables']['activities']['Row']

interface PowerZoneAnalysisProps {
  activity: Activity
  ftp?: number | null
}

interface ZoneTime {
  zone: string
  name: string
  minPercent: number
  maxPercent: number
  minWatts: number
  maxWatts: number
  timeSeconds: number
  percentage: number
  color: string
}

interface ActivityClassification {
  name: string
  z1z2: number // Low intensity (Z1+Z2)
  z3z4: number // Medium intensity (Z3+Z4)
  z5plus: number // High intensity (Z5+)
  match: number // How well this activity matches this classification (0-100)
}

export function PowerZoneAnalysis({ activity, ftp }: PowerZoneAnalysisProps) {
  // Calculate power zones based on FTP
  const powerZones = useMemo(() => {
    if (!ftp) return null
    
    return [
      { key: 'Z1', name: 'Active Recovery', minPercent: 0, maxPercent: 55, color: '#D1FAE5' },
      { key: 'Z2', name: 'Endurance', minPercent: 56, maxPercent: 75, color: '#E0F2FE' },
      { key: 'Z3', name: 'Tempo', minPercent: 76, maxPercent: 90, color: '#FDE68A' },
      { key: 'Z4', name: 'Threshold', minPercent: 91, maxPercent: 105, color: '#FECACA' },
      { key: 'Z5', name: 'VO2max', minPercent: 106, maxPercent: 120, color: '#E9D5FF' },
      { key: 'Z6', name: 'Anaerobic', minPercent: 121, maxPercent: 150, color: '#FBCFE8' },
      { key: 'Z7', name: 'Neuromuscular', minPercent: 151, maxPercent: 300, color: '#FFE4E6' },
      { key: 'SS', name: 'Sweet Spot', minPercent: 84, maxPercent: 97, color: '#FED7AA' }, // Overlaps with Z3-Z4
    ]
  }, [ftp])

  // Calculate time in each zone from GPS track
  const zoneTimes = useMemo(() => {
    if (!ftp || !powerZones) return []

    // Get GPS track data - check multiple locations
    const activityData = activity.data as any
    const activityAny = activity as any
    const gpsTrack = activityAny.gps_track || activityData?.gps_track || activityData?.records || []
    
    if (!Array.isArray(gpsTrack) || gpsTrack.length < 2) {
      return []
    }

    // Initialize zone totals (excluding Sweet Spot - calculated separately)
    const zoneTotals: Record<string, number> = {}
    powerZones.filter(z => z.key !== 'SS').forEach(z => { zoneTotals[z.key] = 0 })
    let sweetSpotTime = 0

    // Sort track by timestamp
    const track = gpsTrack
      .filter((p: any) => p && (p.timestamp || p.time))
      .sort((a: any, b: any) => {
        const timeA = a.timestamp || a.time || 0
        const timeB = b.timestamp || b.time || 0
        return new Date(timeA).getTime() - new Date(timeB).getTime()
      })

    let totalTime = 0

    // Calculate time in each zone
    for (let i = 1; i < track.length; i++) {
      const prev = track[i - 1]
      const curr = track[i]
      const prevTime = prev.timestamp || prev.time
      const currTime = curr.timestamp || curr.time
      
      if (!prevTime || !currTime) continue
      
      const dt = (new Date(currTime).getTime() - new Date(prevTime).getTime()) / 1000
      
      if (!isFinite(dt) || dt <= 0 || dt > 300) continue
      
      const power = typeof prev.power === 'number' && prev.power > 0 ? prev.power : 0
      
      if (power > 0) {
        // Find zone for this power value (exclude Sweet Spot)
        const zone = powerZones
          .filter(z => z.key !== 'SS')
          .find(z => {
            const minWatts = Math.round(ftp * z.minPercent / 100)
            const maxWatts = z.maxPercent >= 300 ? Infinity : Math.round(ftp * z.maxPercent / 100)
            return power >= minWatts && power <= maxWatts
          })
        
        if (zone) {
          zoneTotals[zone.key] += dt
          totalTime += dt
        }

        // Calculate Sweet Spot separately (84-97% FTP, overlaps Z3-Z4)
        const ssMinWatts = Math.round(ftp * 84 / 100)
        const ssMaxWatts = Math.round(ftp * 97 / 100)
        if (power >= ssMinWatts && power <= ssMaxWatts) {
          sweetSpotTime += dt
        }
      }
    }

    // If no power data in GPS track, return empty
    if (totalTime === 0) {
      return []
    }

    // Build zone time array
    const zones: ZoneTime[] = powerZones
      .filter(z => z.key !== 'SS') // Process regular zones first
      .map(zone => {
        const minWatts = Math.round(ftp * zone.minPercent / 100)
        const maxWatts = zone.maxPercent >= 300 ? Infinity : Math.round(ftp * zone.maxPercent / 100)
        const timeSeconds = zoneTotals[zone.key]
        const percentage = (timeSeconds / totalTime) * 100

        return {
          zone: zone.key,
          name: zone.name,
          minPercent: zone.minPercent,
          maxPercent: zone.maxPercent >= 300 ? Infinity : zone.maxPercent,
          minWatts,
          maxWatts,
          timeSeconds,
          percentage,
          color: zone.color
        }
      })
      .filter(z => z.timeSeconds > 0) // Only show zones with time

    // Add Sweet Spot if it has time
    if (sweetSpotTime > 0) {
      const ssPercentage = (sweetSpotTime / totalTime) * 100
      zones.push({
        zone: 'SS',
        name: 'Sweet Spot',
        minPercent: 84,
        maxPercent: 97,
        minWatts: Math.round(ftp * 84 / 100),
        maxWatts: Math.round(ftp * 97 / 100),
        timeSeconds: sweetSpotTime,
        percentage: ssPercentage,
        color: '#FED7AA'
      })
    }

    // Sort zones: Z1-Z7 first, then Sweet Spot
    zones.sort((a, b) => {
      if (a.zone === 'SS') return 1
      if (b.zone === 'SS') return -1
      return a.zone.localeCompare(b.zone)
    })

    return zones
  }, [activity, ftp, powerZones])

  // Calculate aggregated zones (Z1+2, Z3+4, Z5+)
  const aggregatedZones = useMemo(() => {
    const z1z2 = zoneTimes.filter(z => z.zone === 'Z1' || z.zone === 'Z2').reduce((sum, z) => sum + z.percentage, 0)
    const z3z4 = zoneTimes.filter(z => z.zone === 'Z3' || z.zone === 'Z4').reduce((sum, z) => sum + z.percentage, 0)
    const z5plus = zoneTimes.filter(z => ['Z5', 'Z6', 'Z7'].includes(z.zone)).reduce((sum, z) => sum + z.percentage, 0)
    
    // Calculate Base value: (Z1+Z2) / (Z3+Z4+Z5+)
    const base = (z3z4 + z5plus) > 0 ? (z1z2 / (z3z4 + z5plus)) : (z1z2 > 0 ? 999 : 0)
    
    return { z1z2, z3z4, z5plus, base }
  }, [zoneTimes])

  // Define training classifications
  const classifications: Array<{ name: string; z1z2: number; z3z4: number; z5plus: number }> = [
    { name: 'Polarized', z1z2: 80, z3z4: 5, z5plus: 15 }, // 80/5/15
    { name: 'Pyramidal', z1z2: 75, z3z4: 20, z5plus: 5 }, // 75/20/5
    { name: 'Threshold', z1z2: 50, z3z4: 40, z5plus: 10 }, // 50/40/10
    { name: 'HIIT', z1z2: 50, z3z4: 10, z5plus: 40 }, // 50/10/40
    { name: 'Unique', z1z2: aggregatedZones.z1z2, z3z4: aggregatedZones.z3z4, z5plus: aggregatedZones.z5plus }
  ]

  // Calculate match score for each classification
  const classifiedActivities = useMemo(() => {
    return classifications.map(classification => {
      // Calculate Euclidean distance to determine match
      const distance = Math.sqrt(
        Math.pow(aggregatedZones.z1z2 - classification.z1z2, 2) +
        Math.pow(aggregatedZones.z3z4 - classification.z3z4, 2) +
        Math.pow(aggregatedZones.z5plus - classification.z5plus, 2)
      )
      
      // Convert distance to match percentage (inverse, max distance is ~100)
      const match = Math.max(0, 100 - (distance * 2))
      
      return {
        ...classification,
        match: Math.round(match)
      }
    }).sort((a, b) => b.match - a.match) // Sort by best match
  }, [aggregatedZones, classifications])

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}m ${secs}s`
  }

  if (!ftp) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6 text-center">
        <p className="text-gray-600">Set your FTP in Settings to view power zone analysis</p>
      </div>
    )
  }

  if (zoneTimes.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6 text-center">
        <p className="text-gray-600">No power data available for zone analysis</p>
      </div>
    )
  }

  const totalDuration = zoneTimes.reduce((sum, z) => sum + z.timeSeconds, 0)

  return (
    <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">Power Zone Analysis</h2>
        <span className="text-sm text-gray-500">Priority: Power, HR, Pace</span>
      </div>

      {/* Power Zones Table */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-3">Using Power Zones</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-3 text-gray-700 font-semibold">Zone</th>
                <th className="text-left py-2 px-3 text-gray-700 font-semibold">Name</th>
                <th className="text-right py-2 px-3 text-gray-700 font-semibold">% FTP</th>
                <th className="text-right py-2 px-3 text-gray-700 font-semibold">Power (W)</th>
                <th className="text-right py-2 px-3 text-gray-700 font-semibold">Time</th>
                <th className="text-right py-2 px-3 text-gray-700 font-semibold">%</th>
              </tr>
            </thead>
            <tbody>
              {zoneTimes.map((zone) => (
                <tr key={zone.zone} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-3">
                    <span className="font-medium text-gray-900">{zone.zone}</span>
                  </td>
                  <td className="py-3 px-3">
                    <span className="text-gray-700">{zone.name}</span>
                  </td>
                  <td className="py-3 px-3 text-right text-gray-600">
                    {zone.minPercent}% - {zone.maxPercent === Infinity ? '∞' : `${zone.maxPercent}%`}
                  </td>
                  <td className="py-3 px-3 text-right text-gray-600">
                    {zone.minWatts} - {zone.maxWatts === Infinity ? '∞' : `${zone.maxWatts}`}W
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex items-center justify-end gap-2">
                      <div 
                        className="h-4 rounded"
                        style={{ 
                          width: `${Math.max(zone.percentage * 4, 20)}px`,
                          backgroundColor: zone.color,
                          minWidth: '20px'
                        }}
                      />
                      <span className="text-gray-700">{formatDuration(zone.timeSeconds)}</span>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <span className="font-medium text-gray-900">{zone.percentage.toFixed(1)}%</span>
                  </td>
                </tr>
              ))}
              {/* Sweet Spot (if applicable) */}
              {zoneTimes.find(z => z.zone === 'SS') && (
                <tr className="border-t-2 border-gray-300 bg-gray-50">
                  <td colSpan={6} className="py-2 px-3 text-xs text-gray-600">
                    * Sweet Spot overlaps with Z3 and Z4 zones
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Activity Classifications */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-3">Activity Classifications</h3>
        <div className="space-y-4">
          {classifiedActivities.map((classification) => {
            const isUnique = classification.name === 'Unique'
            const total = classification.z1z2 + classification.z3z4 + classification.z5plus
            
            return (
              <div key={classification.name} className="relative">
                <div className="flex items-center gap-4">
                  <div className="w-24 text-sm font-medium text-gray-700">{classification.name}</div>
                  <div className="flex-1 flex gap-0.5 h-6 rounded overflow-hidden">
                    <div 
                      className="bg-green-500"
                      style={{ width: `${(classification.z1z2 / total) * 100}%` }}
                      title={`Z1+2: ${classification.z1z2.toFixed(1)}%`}
                    />
                    <div 
                      className="bg-orange-500"
                      style={{ width: `${(classification.z3z4 / total) * 100}%` }}
                      title={`Z3+4: ${classification.z3z4.toFixed(1)}%`}
                    />
                    <div 
                      className="bg-red-500"
                      style={{ width: `${(classification.z5plus / total) * 100}%` }}
                      title={`Z5+: ${classification.z5plus.toFixed(1)}%`}
                    />
                  </div>
                  {isUnique && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 min-w-[140px]">
                      <div className="text-xs text-blue-700 font-semibold mb-1">
                        Base {aggregatedZones.base.toFixed(2)}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-600">Z1+2:</span>
                          <span className="font-semibold text-green-700">{aggregatedZones.z1z2.toFixed(1)}%</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-600">Z3+4:</span>
                          <span className="font-semibold text-orange-700">{aggregatedZones.z3z4.toFixed(1)}%</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-600">Z5+:</span>
                          <span className="font-semibold text-red-700">{aggregatedZones.z5plus.toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        <p className="text-xs text-gray-500 mt-3">
          Classifications from FastFitness.Tips and Treff et al.
        </p>
      </div>
    </div>
  )
}

