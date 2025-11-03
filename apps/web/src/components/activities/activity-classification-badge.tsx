'use client'

import { useMemo } from 'react'
import { Database } from '@/lib/supabase-types'
import { classifyActivity, getClassificationColor, ActivityClassification } from '@/lib/activity-classification'

type Activity = Database['public']['Tables']['activities']['Row']

interface ActivityClassificationBadgeProps {
  activity: Activity
  ftp?: number | null
  compact?: boolean
}

export function ActivityClassificationBadge({ activity, ftp, compact = false }: ActivityClassificationBadgeProps) {
  const classification = useMemo(() => {
    if (!ftp || !activity.data) return null

    // Get GPS track data - check if data exists and has records
    const activityData = activity.data as any
    const activityAny = activity as any
    
    // Skip if no GPS track data available (optimization: don't process if data is too large)
    const gpsTrack = activityAny.gps_track || activityData?.gps_track || activityData?.records || []
    
    // Early exit if no track data or track is empty
    if (!Array.isArray(gpsTrack) || gpsTrack.length < 2) {
      return null
    }
    
    // Performance optimization: for list views, skip classification if track is too large
    // This prevents blocking the UI during list rendering
    if (compact && gpsTrack.length > 5000) {
      // For compact badges in lists, sample aggressively for speed
      const step = Math.max(1, Math.floor(gpsTrack.length / 500))
      const sampledTrack = gpsTrack.filter((_: any, idx: number) => idx % step === 0)
      if (sampledTrack.length < 2) return null
      return calculateClassificationFromTrack(sampledTrack, ftp)
    }
    
    // For non-compact badges, allow larger tracks but still sample if extremely large
    if (!compact && gpsTrack.length > 10000) {
      const step = Math.floor(gpsTrack.length / 1000)
      const sampledTrack = gpsTrack.filter((_: any, idx: number) => idx % step === 0)
      if (sampledTrack.length < 2) return null
      return calculateClassificationFromTrack(sampledTrack, ftp)
    }

    // Use optimized helper function for classification
    return calculateClassificationFromTrack(gpsTrack, ftp)
  }, [activity, ftp])

  if (!classification) {
    return null
  }

  const colorClass = getClassificationColor(classification.name)

  if (compact) {
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${colorClass}`}>
        {classification.name}
      </span>
    )
  }

  return (
    <div className={`inline-flex items-center px-2.5 py-1 rounded-md text-sm font-medium border ${colorClass}`}>
      <span>{classification.name}</span>
      {classification.base !== undefined && (
        <span className="ml-1.5 text-xs opacity-75">
          Base {classification.base.toFixed(2)}
        </span>
      )}
    </div>
  )
}

// Helper function to calculate classification from track (optimized with batching)
function calculateClassificationFromTrack(gpsTrack: any[], ftp: number): ActivityClassification | null {
  const powerZones = [
    { key: 'Z1', minPercent: 0, maxPercent: 55 },
    { key: 'Z2', minPercent: 56, maxPercent: 75 },
    { key: 'Z3', minPercent: 76, maxPercent: 90 },
    { key: 'Z4', minPercent: 91, maxPercent: 105 },
    { key: 'Z5', minPercent: 106, maxPercent: 120 },
    { key: 'Z6', minPercent: 121, maxPercent: 150 },
    { key: 'Z7', minPercent: 151, maxPercent: 300 },
  ]

  const zoneTotals: Record<string, number> = {}
  powerZones.forEach(z => { zoneTotals[z.key] = 0 })

  const track = gpsTrack
    .filter((p: any) => p && (p.timestamp || p.time))
    .sort((a: any, b: any) => {
      const timeA = a.timestamp || a.time || 0
      const timeB = b.timestamp || b.time || 0
      return new Date(timeA).getTime() - new Date(timeB).getTime()
    })

  let totalTime = 0

  // Process in batches for better performance with large datasets
  const batchSize = 500
  for (let batchStart = 1; batchStart < track.length; batchStart += batchSize) {
    const batchEnd = Math.min(batchStart + batchSize, track.length)
    
    for (let i = batchStart; i < batchEnd; i++) {
      const prev = track[i - 1]
      const curr = track[i]
      const prevTime = prev.timestamp || prev.time
      const currTime = curr.timestamp || curr.time
      
      if (!prevTime || !currTime) continue
      
      const dt = (new Date(currTime).getTime() - new Date(prevTime).getTime()) / 1000
      
      if (!isFinite(dt) || dt <= 0 || dt > 300) continue
      
      const power = typeof prev.power === 'number' && prev.power > 0 ? prev.power : 0
      
      if (power > 0) {
        const zone = powerZones.find(z => {
          const minWatts = Math.round(ftp * z.minPercent / 100)
          const maxWatts = z.maxPercent >= 300 ? Infinity : Math.round(ftp * z.maxPercent / 100)
          return power >= minWatts && power <= maxWatts
        })
        
        if (zone) {
          zoneTotals[zone.key] += dt
          totalTime += dt
        }
      }
    }
  }

  if (totalTime === 0) return null

  const zoneTimes = powerZones.map(zone => ({
    zone: zone.key,
    percentage: (zoneTotals[zone.key] / totalTime) * 100
  })).filter(z => z.percentage > 0)

  return classifyActivity(zoneTimes, ftp)
}

