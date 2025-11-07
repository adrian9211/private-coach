import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { parseZwoFile } from '@/lib/workout-parser'

const WORKOUTS_DIR = join(process.cwd(), 'workouts')

export async function GET(
  request: Request,
  { params }: { params: { category: string; slug: string } }
) {
  try {
    const { category, slug } = params
    const filePath = join(WORKOUTS_DIR, category, `${slug}.zwo`)

    const content = await readFile(filePath, 'utf-8')
    
    // Check if it's HTML (from failed download) or actual XML
    if (content.trim().startsWith('<!DOCTYPE') || content.trim().startsWith('<html')) {
      return NextResponse.json(
        { error: 'Workout file is not available (authentication required)' },
        { status: 404 }
      )
    }

    const workout = parseZwoFile(content)

    return NextResponse.json({
      ...workout,
      slug,
      category,
      filename: `${slug}.zwo`,
    })
  } catch (error) {
    console.error('Error fetching workout:', error)
    return NextResponse.json(
      { error: 'Workout not found' },
      { status: 404 }
    )
  }
}

