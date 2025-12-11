import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join, resolve } from 'path'
import { parseZwoFile } from '@/lib/workout-parser'

// Workouts directory is at project root
const getWorkoutsDir = () => {
  const cwd = process.cwd()
  if (cwd.endsWith('apps/web')) {
    return resolve(cwd, '..', '..', 'workouts')
  }
  return resolve(cwd, 'workouts')
}

export async function GET(
  request: Request,
  props: { params: Promise<{ category: string; slug: string }> }
) {
  try {
    const params = await props.params;
    const { category, slug } = params
    const workoutsDir = getWorkoutsDir()
    const filePath = join(workoutsDir, category, `${slug}.zwo`)

    const content = await readFile(filePath, 'utf-8')

    // Check if it's HTML (from failed download) or actual XML
    if (content.trim().startsWith('<!DOCTYPE') || content.trim().startsWith('<html')) {
      // Try to load the corresponding JSON file if it exists
      const jsonPath = filePath.replace('.zwo', '.json')
      try {
        const jsonContent = await readFile(jsonPath, 'utf-8')
        const jsonWorkout = JSON.parse(jsonContent)

        // Convert JSON format to WorkoutData format
        const segments = jsonWorkout.steps?.map((step: any) => ({
          type: step.type === 'warmup' ? 'warmup' :
            step.type === 'cooldown' ? 'cooldown' :
              step.type === 'ramp' ? 'ramp' : 'steadystate',
          duration: step.duration || 0,
          power: step.powerLow === step.powerHigh ? step.powerLow / 100 : undefined,
          powerLow: step.powerLow ? step.powerLow / 100 : undefined,
          powerHigh: step.powerHigh ? step.powerHigh / 100 : undefined,
        })) || []

        const totalDuration = segments.reduce((sum: number, seg: any) => sum + (seg.duration || 0), 0)

        return NextResponse.json({
          name: jsonWorkout.name || 'Unknown Workout',
          author: 'mywhooshinfo.com',
          description: jsonWorkout.description || '',
          sportType: 'bike',
          segments,
          totalDuration,
          estimatedTSS: jsonWorkout.tss,
          estimatedIF: jsonWorkout.intensityFactor,
          slug,
          category,
          filename: `${slug}.zwo`,
          source: 'json',
          duration: jsonWorkout.duration,
          tss: jsonWorkout.tss,
          intensityFactor: jsonWorkout.intensityFactor,
        })
      } catch (jsonError) {
        return NextResponse.json(
          { error: 'Workout file is not available (authentication required)' },
          { status: 404 }
        )
      }
    }

    const workout = parseZwoFile(content)

    return NextResponse.json({
      ...workout,
      slug,
      category,
      filename: `${slug}.zwo`,
      source: 'xml',
    })
  } catch (error) {
    console.error('Error fetching workout:', error)
    return NextResponse.json(
      { error: 'Workout not found' },
      { status: 404 }
    )
  }
}

