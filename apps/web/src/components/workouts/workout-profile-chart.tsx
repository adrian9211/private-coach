'use client'

import { useMemo } from 'react'
import { generateWorkoutProfile, getZoneColor, type WorkoutData } from '@/lib/workout-parser'

interface WorkoutProfileChartProps {
  workout: WorkoutData
  height?: number
  compact?: boolean
}

export function WorkoutProfileChart({ workout, height = 60, compact = false }: WorkoutProfileChartProps) {
  const profileData = useMemo(() => {
    // Use lower resolution for compact view, higher for detailed
    const resolution = compact ? 2 : 1
    return generateWorkoutProfile(workout, resolution)
  }, [workout, compact])

  if (profileData.length === 0) {
    return (
      <div 
        className="w-full bg-gray-200 rounded"
        style={{ height: `${height}px` }}
      />
    )
  }

  const maxTime = Math.max(...profileData.map(d => d.time))
  const maxPower = Math.max(...profileData.map(d => d.power))

  // Group consecutive points with same zone for better rendering
  const groupedData: Array<{ start: number; end: number; zone: number; color: string; power: number }> = []
  let currentGroup = { start: profileData[0].time, end: profileData[0].time, zone: profileData[0].zone, color: profileData[0].color, power: profileData[0].power }

  for (let i = 1; i < profileData.length; i++) {
    const point = profileData[i]
    if (point.zone === currentGroup.zone && Math.abs(point.power - currentGroup.power) < 0.05) {
      currentGroup.end = point.time
    } else {
      groupedData.push(currentGroup)
      currentGroup = { start: point.time, end: point.time, zone: point.zone, color: point.color, power: point.power }
    }
  }
  groupedData.push(currentGroup)

  return (
    <div className="w-full relative" style={{ height: `${height}px` }}>
      <svg width="100%" height={height} className="rounded overflow-hidden">
        {groupedData.map((group, idx) => {
          const x1 = (group.start / maxTime) * 100
          const x2 = (group.end / maxTime) * 100
          const width = x2 - x1
          
          // Height based on power (normalized to chart height)
          const powerHeight = (group.power / maxPower) * height
          const y = height - powerHeight

          return (
            <rect
              key={idx}
              x={`${x1}%`}
              y={y}
              width={`${width}%`}
              height={powerHeight}
              fill={group.color}
              className="transition-all"
            />
          )
        })}
      </svg>
    </div>
  )
}

