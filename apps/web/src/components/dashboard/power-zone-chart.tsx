'use client'

interface PowerZoneChartProps {
  activities: any[]
  ftp?: number | null
  maxWidth?: number
  maxHeight?: number
}

interface ZoneDistribution {
  zone: string
  duration: number
  percentage: number
  color: string
}

export function PowerZoneChart({ activities, ftp, maxWidth = 200, maxHeight = 8 }: PowerZoneChartProps) {
  // Always show something if FTP is set - even if it's just a placeholder
  if (!ftp) {
    return null
  }
  
  if (!activities || activities.length === 0) {
    return null
  }

  // Define power zones based on FTP
  const powerZones = [
    { key: 'Z1', label: 'Z1', min: 0, max: Math.round(ftp * 0.55), color: '#D1FAE5' },
    { key: 'Z2', label: 'Z2', min: Math.round(ftp * 0.56), max: Math.round(ftp * 0.75), color: '#E0F2FE' },
    { key: 'Z3', label: 'Z3', min: Math.round(ftp * 0.76), max: Math.round(ftp * 0.90), color: '#FDE68A' },
    { key: 'Z4', label: 'Z4', min: Math.round(ftp * 0.91), max: Math.round(ftp * 1.05), color: '#FECACA' },
    { key: 'Z5', label: 'Z5', min: Math.round(ftp * 1.06), max: Math.round(ftp * 1.20), color: '#E9D5FF' },
    { key: 'Z6', label: 'Z6', min: Math.round(ftp * 1.21), max: Math.round(ftp * 1.50), color: '#FBCFE8' },
    { key: 'Z7', label: 'Z7', min: Math.round(ftp * 1.51), max: Math.round(ftp * 3.00), color: '#FFE4E6' },
  ]

  // Calculate zone distribution from activities
  const calculateZoneDistribution = (): ZoneDistribution[] => {
    const zoneTotals: Record<string, number> = {}
    powerZones.forEach(z => { zoneTotals[z.key] = 0 })

    let totalTime = 0

    activities.forEach((activity) => {
      if (!activity) return
      
      // Try to get GPS track data from various locations
      const gpsTrack = activity.gps_track || activity.data?.gps_track || activity.data?.records || []
      let hasPowerData = false
      
      if (gpsTrack && Array.isArray(gpsTrack) && gpsTrack.length >= 2) {
        // Use GPS track with timestamps
        const track = gpsTrack
          .filter((p: any) => p && (p.timestamp || p.time))
          .sort((a: any, b: any) => {
            const timeA = a.timestamp || a.time || 0
            const timeB = b.timestamp || b.time || 0
            return new Date(timeA).getTime() - new Date(timeB).getTime()
          })

        // Calculate time in each zone based on power data
        for (let i = 1; i < track.length; i++) {
          const prev = track[i - 1]
          const curr = track[i]
          const prevTime = prev.timestamp || prev.time
          const currTime = curr.timestamp || curr.time
          
          if (!prevTime || !currTime) continue
          
          const dt = (new Date(currTime).getTime() - new Date(prevTime).getTime()) / 1000
          
          if (!isFinite(dt) || dt <= 0 || dt > 300) continue // Skip invalid or huge gaps
          
          const power = typeof prev.power === 'number' && prev.power > 0 ? prev.power : 0
          
          if (power > 0) {
            hasPowerData = true
            // Find the zone for this power value
            const zone = powerZones.find(z => power >= z.min && power <= z.max) || powerZones[0]
            zoneTotals[zone.key] += dt
            totalTime += dt
          }
        }
      }
      
      // Fallback: Use summary data if available (for indoor activities without GPS or if no power in GPS track)
      // This should ALWAYS run if we have avg power, even if GPS track exists (as a backup)
      const duration = activity.total_timer_time || activity.data?.summary?.duration || 0
      const avgPower = activity.avg_power || activity.data?.summary?.avgPower || 0
      
      // If we didn't get power data from GPS track, use average power
      if ((!hasPowerData || totalTime === 0) && duration > 0 && avgPower > 0) {
        // Estimate zone distribution based on average power
        // This is a simplified approach - assumes all time is in the zone matching avg power
        const zone = powerZones.find(z => avgPower >= z.min && avgPower <= z.max) || powerZones[0]
        zoneTotals[zone.key] += duration
        totalTime += duration
      }
    })

    // If no power data, return empty
    if (totalTime === 0) {
      return []
    }

    // Convert to percentages and return
    return powerZones.map(zone => ({
      zone: zone.key,
      duration: zoneTotals[zone.key],
      percentage: (zoneTotals[zone.key] / totalTime) * 100,
      color: zone.color
    })).filter(z => z.duration > 0) // Only show zones with time
  }

  const zoneDistribution = calculateZoneDistribution()

  if (zoneDistribution.length === 0) {
    // If no zone distribution calculated, try one more time with just average power
    // This ensures we show something for every activity with power data
    const hasAnyPower = activities.some(act => {
      if (!act) return false
      return act.avg_power || act.data?.summary?.avgPower
    })
    
    if (!hasAnyPower) {
      return null
    }
    
    // Create a simple single-zone chart from average power as last resort
    const avgPower = activities.reduce((sum, act) => {
      const power = act.avg_power || act.data?.summary?.avgPower || 0
      return sum + power
    }, 0) / activities.length
    
    if (avgPower > 0) {
      const zone = powerZones.find(z => avgPower >= z.min && avgPower <= z.max) || powerZones[0]
      return (
        <div 
          className="flex items-center gap-0.5 rounded overflow-hidden"
          style={{ 
            width: `${maxWidth}px`, 
            height: `${maxHeight}px`,
            maxWidth: '100%',
            minHeight: `${maxHeight}px`
          }}
          title={`Average power: ${Math.round(avgPower)}W (${zone.key})`}
        >
          <div
            className="h-full w-full"
            style={{
              backgroundColor: zone.color,
            }}
          />
        </div>
      )
    }
    
    return null
  }

  // Ensure percentages are valid and sum to 100
  const totalPercentage = zoneDistribution.reduce((sum, z) => sum + z.percentage, 0)
  const normalizedDistribution = totalPercentage > 0 
    ? zoneDistribution.map(z => ({ ...z, percentage: (z.percentage / totalPercentage) * 100 }))
    : zoneDistribution

  return (
    <div 
      className="flex items-center gap-0.5 rounded overflow-hidden"
      style={{ 
        width: '100%',
        maxWidth: `${maxWidth}px`, 
        height: `${maxHeight}px`,
        minHeight: `${maxHeight}px`,
        display: 'flex'
      }}
      title={`Power zones: ${normalizedDistribution.map(z => `${z.zone} ${z.percentage.toFixed(0)}%`).join(', ')}`}
    >
      {normalizedDistribution.map((zone) => {
        const widthPercent = Math.max(zone.percentage, 0.1) // Minimum 0.1% to ensure visibility
        return (
          <div
            key={zone.zone}
            className="h-full"
            style={{
              width: `${widthPercent}%`,
              backgroundColor: zone.color,
              minWidth: zone.percentage > 0 ? '1px' : '0',
              flexShrink: 0
            }}
            aria-label={`${zone.zone}: ${zone.percentage.toFixed(1)}%`}
          />
        )
      })}
    </div>
  )
}

