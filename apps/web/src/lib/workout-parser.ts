/**
 * Workout Parser - Parses .zwo XML files and extracts workout structure
 */

export interface WorkoutSegment {
  type: 'warmup' | 'steadystate' | 'interval' | 'cooldown' | 'ramp'
  duration: number // in seconds
  power?: number // as percentage of FTP (0.45 = 45%)
  powerLow?: number
  powerHigh?: number
  repeat?: number // for intervals
  onDuration?: number // for intervals
  onPower?: number // for intervals
  offDuration?: number // for intervals
  offPower?: number // for intervals
}

export interface WorkoutData {
  name: string
  author: string
  description: string
  sportType: string
  segments: WorkoutSegment[]
  totalDuration: number // in seconds
  estimatedTSS?: number
  estimatedIF?: number
}

/**
 * Get power zone from power percentage
 */
export function getPowerZone(power: number): number {
  if (power < 0.55) return 1 // Z1 - Recovery
  if (power < 0.75) return 2 // Z2 - Endurance
  if (power < 0.90) return 3 // Z3 - Tempo
  if (power < 1.05) return 4 // Z4 - Threshold
  if (power < 1.20) return 5 // Z5 - VO2max
  if (power < 1.50) return 6 // Z6 - Anaerobic
  return 7 // Z7 - Neuromuscular
}

/**
 * Get color for power zone
 */
export function getZoneColor(zone: number): string {
  const colors: Record<number, string> = {
    1: '#9CA3AF', // Grey - Recovery
    2: '#3B82F6', // Blue - Endurance
    3: '#10B981', // Green - Tempo
    4: '#F59E0B', // Yellow - Threshold
    5: '#F97316', // Orange - VO2max
    6: '#EF4444', // Red - Anaerobic
    7: '#DC2626', // Dark Red - Neuromuscular
  }
  return colors[zone] || '#9CA3AF'
}

/**
 * Parse .zwo XML content and extract workout structure
 */
export function parseZwoFile(content: string): WorkoutData {
  // Extract basic info
  const nameMatch = content.match(/<name>([\s\S]*?)<\/name>/i)
  const authorMatch = content.match(/<author>([\s\S]*?)<\/author>/i)
  const descMatch = content.match(/<description>([\s\S]*?)<\/description>/i)
  const sportMatch = content.match(/<sportType>([\s\S]*?)<\/sportType>/i)

  const name = nameMatch ? nameMatch[1].trim() : 'Unknown Workout'
  const author = authorMatch ? authorMatch[1].trim() : 'Unknown'
  const description = descMatch ? descMatch[1].trim() : ''
  const sportType = sportMatch ? sportMatch[1].trim() : 'bike'

  const segments: WorkoutSegment[] = []
  let totalDuration = 0

  // Extract attribute helper
  const getAttr = (tag: string, attr: string): string | null => {
    const regex = new RegExp(`${attr}=["']([^"']+)["']`, 'i')
    const match = tag.match(regex)
    return match ? match[1] : null
  }

  // Parse Warmup
  const warmupRegex = /<Warmup[^>]*>[\s\S]*?<\/Warmup>/gi
  let match
  while ((match = warmupRegex.exec(content)) !== null) {
    const tag = match[0].split('>')[0] + '>'
    const duration = parseInt(getAttr(tag, 'Duration') || '0', 10)
    const powerLow = parseFloat(getAttr(tag, 'PowerLow') || '0')
    const powerHigh = parseFloat(getAttr(tag, 'PowerHigh') || '0')
    
    if (duration > 0) {
      segments.push({
        type: 'warmup',
        duration,
        powerLow,
        powerHigh,
      })
      totalDuration += duration
    }
  }

  // Parse SteadyState
  const steadyStateRegex = /<SteadyState[^>]*\/?>[\s\S]*?(?:<\/SteadyState>|$)/gi
  while ((match = steadyStateRegex.exec(content)) !== null) {
    const tag = match[0].split('>')[0] + (match[0].includes('/>') ? '/>' : '>')
    const duration = parseInt(getAttr(tag, 'Duration') || '0', 10)
    const power = parseFloat(getAttr(tag, 'Power') || '0')
    
    if (duration > 0 && power > 0) {
      segments.push({
        type: 'steadystate',
        duration,
        power,
      })
      totalDuration += duration
    }
  }

  // Parse IntervalsT (time-based intervals)
  const intervalsTRegex = /<IntervalsT[^>]*>[\s\S]*?<\/IntervalsT>/gi
  while ((match = intervalsTRegex.exec(content)) !== null) {
    const tag = match[0].split('>')[0] + '>'
    const repeat = parseInt(getAttr(tag, 'Repeat') || '1', 10)
    const onDuration = parseInt(getAttr(tag, 'OnDuration') || '0', 10)
    const onPower = parseFloat(getAttr(tag, 'OnPower') || '0')
    const offDuration = parseInt(getAttr(tag, 'OffDuration') || '0', 10)
    const offPower = parseFloat(getAttr(tag, 'OffPower') || '0')
    
    if (repeat > 0 && onDuration > 0) {
      segments.push({
        type: 'interval',
        duration: repeat * (onDuration + offDuration),
        repeat,
        onDuration,
        onPower,
        offDuration,
        offPower,
      })
      totalDuration += repeat * (onDuration + offDuration)
    }
  }

  // Parse IntervalsD (distance-based intervals) - similar to IntervalsT
  const intervalsDRegex = /<IntervalsD[^>]*>[\s\S]*?<\/IntervalsD>/gi
  while ((match = intervalsDRegex.exec(content)) !== null) {
    const tag = match[0].split('>')[0] + '>'
    const repeat = parseInt(getAttr(tag, 'Repeat') || '1', 10)
    const onDuration = parseInt(getAttr(tag, 'OnDuration') || '0', 10)
    const onPower = parseFloat(getAttr(tag, 'OnPower') || '0')
    const offDuration = parseInt(getAttr(tag, 'OffDuration') || '0', 10)
    const offPower = parseFloat(getAttr(tag, 'OffPower') || '0')
    
    if (repeat > 0 && onDuration > 0) {
      segments.push({
        type: 'interval',
        duration: repeat * (onDuration + offDuration),
        repeat,
        onDuration,
        onPower,
        offDuration,
        offPower,
      })
      totalDuration += repeat * (onDuration + offDuration)
    }
  }

  // Parse Ramp segments
  const rampRegex = /<Ramp[^>]*\/?>[\s\S]*?(?:<\/Ramp>|$)/gi
  while ((match = rampRegex.exec(content)) !== null) {
    const tag = match[0].split('>')[0] + (match[0].includes('/>') ? '/>' : '>')
    const duration = parseInt(getAttr(tag, 'Duration') || '0', 10)
    const powerLow = parseFloat(getAttr(tag, 'PowerLow') || '0')
    const powerHigh = parseFloat(getAttr(tag, 'PowerHigh') || '0')
    
    if (duration > 0) {
      segments.push({
        type: 'ramp',
        duration,
        powerLow,
        powerHigh,
      })
      totalDuration += duration
    }
  }

  // Estimate TSS and IF (simplified)
  const avgPower = segments.reduce((sum, seg) => {
    if (seg.power) return sum + seg.power * seg.duration
    if (seg.powerLow && seg.powerHigh) return sum + ((seg.powerLow + seg.powerHigh) / 2) * seg.duration
    if (seg.onPower) return sum + (seg.onPower * (seg.onDuration || 0) + (seg.offPower || 0) * (seg.offDuration || 0)) * (seg.repeat || 1)
    return sum
  }, 0) / totalDuration

  const estimatedIF = avgPower
  const estimatedTSS = Math.round((totalDuration / 3600) * estimatedIF * estimatedIF * 100)

  return {
    name,
    author,
    description,
    sportType,
    segments,
    totalDuration,
    estimatedTSS,
    estimatedIF: Math.round(estimatedIF * 100) / 100,
  }
}

/**
 * Generate time-series data for visualization
 * Returns array of { time, power, zone, color } points
 */
export function generateWorkoutProfile(workout: WorkoutData, resolution: number = 1): Array<{
  time: number
  power: number
  zone: number
  color: string
}> {
  const data: Array<{ time: number; power: number; zone: number; color: string }> = []
  let currentTime = 0

  for (const segment of workout.segments) {
    if (segment.type === 'warmup' && segment.powerLow && segment.powerHigh) {
      // Linear ramp from powerLow to powerHigh
      const steps = Math.ceil(segment.duration / resolution)
      for (let i = 0; i < steps; i++) {
        const progress = i / steps
        const power = segment.powerLow + (segment.powerHigh - segment.powerLow) * progress
        const zone = getPowerZone(power)
        data.push({
          time: currentTime + i * resolution,
          power,
          zone,
          color: getZoneColor(zone),
        })
      }
      currentTime += segment.duration
    } else if (segment.type === 'steadystate' && segment.power) {
      const steps = Math.ceil(segment.duration / resolution)
      const zone = getPowerZone(segment.power)
      for (let i = 0; i < steps; i++) {
        data.push({
          time: currentTime + i * resolution,
          power: segment.power,
          zone,
          color: getZoneColor(zone),
        })
      }
      currentTime += segment.duration
    } else if (segment.type === 'interval' && segment.repeat && segment.onDuration && segment.onPower) {
      // Generate intervals
      for (let rep = 0; rep < segment.repeat; rep++) {
        // On interval
        const onSteps = Math.ceil(segment.onDuration / resolution)
        const onZone = getPowerZone(segment.onPower)
        for (let i = 0; i < onSteps; i++) {
          data.push({
            time: currentTime + i * resolution,
            power: segment.onPower,
            zone: onZone,
            color: getZoneColor(onZone),
          })
        }
        currentTime += segment.onDuration

        // Off interval (recovery)
        if (segment.offDuration && segment.offPower) {
          const offSteps = Math.ceil(segment.offDuration / resolution)
          const offZone = getPowerZone(segment.offPower)
          for (let i = 0; i < offSteps; i++) {
            data.push({
              time: currentTime + i * resolution,
              power: segment.offPower,
              zone: offZone,
              color: getZoneColor(offZone),
            })
          }
          currentTime += segment.offDuration
        }
      }
    } else if (segment.type === 'ramp' && segment.powerLow && segment.powerHigh) {
      // Linear ramp
      const steps = Math.ceil(segment.duration / resolution)
      for (let i = 0; i < steps; i++) {
        const progress = i / steps
        const power = segment.powerLow + (segment.powerHigh - segment.powerLow) * progress
        const zone = getPowerZone(power)
        data.push({
          time: currentTime + i * resolution,
          power,
          zone,
          color: getZoneColor(zone),
        })
      }
      currentTime += segment.duration
    }
  }

  return data
}

/**
 * Format duration in seconds to MM:SS or HH:MM:SS
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }
  return `${minutes}:${String(secs).padStart(2, '0')}`
}

