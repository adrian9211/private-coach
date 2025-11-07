import { NextResponse } from 'next/server'
import { readdir, readFile } from 'fs/promises'
import { join } from 'path'
import { parseZwoFile } from '@/lib/workout-parser'

const WORKOUTS_DIR = join(process.cwd(), 'workouts')

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')

    if (!category) {
      // List all categories
      const categories = await readdir(WORKOUTS_DIR, { withFileTypes: true })
      const categoryList = categories
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name)
        .filter(name => !name.startsWith('.'))

      return NextResponse.json({ categories: categoryList })
    }

    // List workouts in category
    const categoryPath = join(WORKOUTS_DIR, category)
    const files = await readdir(categoryPath)
    const zwoFiles = files.filter(f => f.endsWith('.zwo'))

    const workouts = await Promise.all(
      zwoFiles.map(async (file) => {
        try {
          const filePath = join(categoryPath, file)
          const content = await readFile(filePath, 'utf-8')
          
          // Check if it's HTML (from failed download) or actual XML
          if (content.trim().startsWith('<!DOCTYPE') || content.trim().startsWith('<html')) {
            return null // Skip HTML files
          }

          const workout = parseZwoFile(content)
          return {
            ...workout,
            slug: file.replace('.zwo', ''),
            category,
            filename: file,
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
    })
  } catch (error) {
    console.error('Error fetching workouts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch workouts' },
      { status: 500 }
    )
  }
}

