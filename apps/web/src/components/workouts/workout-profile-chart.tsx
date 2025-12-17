'use client'

import { useMemo } from 'react'
import type { WorkoutData } from '@/lib/workout-parser'

interface WorkoutProfileChartProps {
  workout: WorkoutData
  height?: number
  compact?: boolean
}

// Get color based on power zone (as decimal: 0.45 = 45% FTP)
function getPowerZoneColor(power: number): string {
  if (power >= 1.50) return '#EF4444' // Z7 Neuromuscular - Red
  if (power >= 1.20) return '#F97316' // Z6 Anaerobic - Orange  
  if (power >= 1.05) return '#F59E0B' // Z5 VO2Max - Amber
  if (power >= 0.90) return '#EAB308' // Z4 Threshold - Yellow
  if (power >= 0.76) return '#84CC16' // Z3 Tempo - Lime
  if (power >= 0.56) return '#3B82F6' // Z2 Endurance - Blue
  return '#9CA3AF' // Z1 Active Recovery - Gray
}

export function WorkoutProfileChart({ workout, height = 60, compact = false }: WorkoutProfileChartProps) {
  // Create bars directly from segments
  const bars = useMemo(() => {
    const result: Array<{ duration: number; power: number; color: string; type: string }> = []

    for (const segment of workout.segments) {
      if (segment.type === 'warmup' || segment.type === 'ramp') {
        // For warmup/ramp, create gradual steps - keep slicing for visual "stairs"
        const powerLow = segment.powerLow || 0.5
        const powerHigh = segment.powerHigh || 0.5
        const steps = Math.ceil(segment.duration / 10) // 10-second slices approximation
        const stepDuration = segment.duration / steps

        for (let i = 0; i < steps; i++) {
          const progress = i / (steps - 1 || 1)
          const power = powerLow + (powerHigh - powerLow) * progress
          result.push({
            duration: stepDuration,
            power,
            color: getPowerZoneColor(power),
            type: segment.type
          })
        }
      } else if (segment.type === 'steadystate') {
        const power = segment.power || segment.powerLow || 0.5
        // Single bar for steady state to ensure correct width scaling
        result.push({
          duration: segment.duration,
          power,
          color: getPowerZoneColor(power),
          type: segment.type
        })
      } else if (segment.type === 'interval' && segment.repeat) {
        // For intervals, one bar for ON and one bar for OFF
        for (let r = 0; r < segment.repeat; r++) {
          // On interval
          if (segment.onDuration && segment.onPower) {
            result.push({
              duration: segment.onDuration,
              power: segment.onPower,
              color: getPowerZoneColor(segment.onPower),
              type: 'interval-on'
            })
          }

          // Off interval
          if (segment.offDuration && segment.offPower !== undefined) {
            result.push({
              duration: segment.offDuration,
              power: segment.offPower,
              color: getPowerZoneColor(segment.offPower),
              type: 'interval-off'
            })
          }
        }
      } else if (segment.type === 'cooldown') {
        // Stairs for cooldown
        const powerLow = segment.powerLow || 0.5
        const powerHigh = segment.powerHigh || powerLow
        const steps = Math.ceil(segment.duration / 10)
        const stepDuration = segment.duration / steps

        for (let i = 0; i < steps; i++) {
          const progress = i / (steps - 1 || 1)
          const power = powerLow + (powerHigh - powerLow) * progress
          result.push({
            duration: stepDuration,
            power,
            color: getPowerZoneColor(power),
            type: segment.type
          })
        }
      }
    }

    return result
  }, [workout.segments])

  if (bars.length === 0) {
    return (
      <div
        className="w-full bg-gray-800 rounded"
        style={{ height: `${height}px` }}
      />
    )
  }

  const totalDuration = bars.reduce((sum, bar) => sum + bar.duration, 0)

  return (
    <div
      className="w-full bg-gray-100 dark:bg-gray-800 rounded overflow-hidden flex items-end relative"
      style={{ height: `${height}px` }}
    >
      {bars.map((bar, idx) => {
        const widthPercent = (bar.duration / totalDuration) * 100
        const heightPercent = Math.max(bar.power * 100, 10) // Min 10% height for visibility

        return (
          <div
            key={idx}
            className="flex-shrink-0 transition-none"
            style={{
              width: `${widthPercent}%`,
              height: `${Math.min(heightPercent, 100)}%`,
              backgroundColor: bar.color,
              // Optional: Add a tiny border to separate blocks if they are same color, 
              // but purely distinct blocks is usually better for "profile" view
              boxShadow: compact ? 'none' : 'inset -1px 0 0 0 rgba(0,0,0,0.1)'
            }}
            title={`${formatDuration(bar.duration)} @ ${Math.round(bar.power * 100)}% FTP`}
          />
        )
      })}
    </div>
  )
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

