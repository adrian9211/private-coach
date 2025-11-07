import { NextResponse } from 'next/server'
import { readdir, readFile } from 'fs/promises'
import { join, resolve } from 'path'
import { parseZwoFile } from '@/lib/workout-parser'

// Workouts directory is at project root
// In Next.js, process.cwd() is the app directory (apps/web), so we need to go up two levels
// Use resolve to get absolute path
const getWorkoutsDir = () => {
  const cwd = process.cwd()
  // Check if we're in apps/web or the project root
  if (cwd.endsWith('apps/web')) {
    return resolve(cwd, '..', '..', 'workouts')
  }
  // If running from project root
  return resolve(cwd, 'workouts')
}

const WORKOUTS_DIR = getWorkoutsDir()

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')

    // Recalculate path in case cwd changed
    const workoutsDir = getWorkoutsDir()

    if (!category) {
      // List all categories
      const categories = await readdir(workoutsDir, { withFileTypes: true })
      const categoryList = categories
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name)
        .filter(name => !name.startsWith('.'))

      return NextResponse.json({ categories: categoryList })
    }

    // List workouts in category
    const categoryPath = join(workoutsDir, category)
    const files = await readdir(categoryPath)
    const zwoFiles = files.filter(f => f.endsWith('.zwo'))
    const jsonFiles = files.filter(f => f.endsWith('.json'))

    let htmlFileCount = 0
    const workouts = await Promise.all(
      zwoFiles.map(async (file) => {
        try {
          const filePath = join(categoryPath, file)
          const content = await readFile(filePath, 'utf-8')
          
          // Check if it's HTML (from failed download) or actual XML
          if (content.trim().startsWith('<!DOCTYPE') || content.trim().startsWith('<html')) {
            htmlFileCount++
            
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
              
              return {
                name: jsonWorkout.name || 'Unknown Workout',
                author: 'mywhooshinfo.com',
                description: jsonWorkout.description || '',
                sportType: 'bike',
                segments,
                totalDuration,
                estimatedTSS: jsonWorkout.tss,
                estimatedIF: jsonWorkout.intensityFactor,
                slug: file.replace('.zwo', ''),
                category,
                filename: file,
                source: 'json', // Mark as extracted from HTML
                duration: jsonWorkout.duration,
                tss: jsonWorkout.tss,
                intensityFactor: jsonWorkout.intensityFactor,
              }
            } catch (jsonError) {
              // No JSON file available, skip this HTML file
              return null
            }
          }

          const workout = parseZwoFile(content)
          return {
            ...workout,
            slug: file.replace('.zwo', ''),
            category,
            filename: file,
            source: 'xml', // Mark as valid XML
          }
        } catch (error) {
          console.error(`Error parsing ${file}:`, error)
          return null
        }
      })
    )

    const validWorkouts = workouts.filter(w => w !== null)

    return NextResponse.json({ 
      category,
      workouts: validWorkouts,
      count: validWorkouts.length,
      totalFiles: zwoFiles.length,
      htmlFiles: htmlFileCount,
      needsAuthentication: htmlFileCount > 0 && validWorkouts.length === 0,
    })
  } catch (error) {
    console.error('Error fetching workouts:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { 
        error: 'Failed to fetch workouts',
        details: errorMessage,
        workoutsDir: getWorkoutsDir(),
        cwd: process.cwd(),
      },
      { status: 500 }
    )
  }
}

