#!/usr/bin/env node

/**
 * Check workout files and identify which are valid XML vs HTML
 */

const fs = require('fs')
const path = require('path')

const WORKOUTS_DIR = path.join(__dirname, '..', 'workouts')

function checkCategory(categoryName) {
  const categoryPath = path.join(WORKOUTS_DIR, categoryName)
  
  if (!fs.existsSync(categoryPath)) {
    console.log(`Category ${categoryName} does not exist`)
    return
  }

  const files = fs.readdirSync(categoryPath)
  const zwoFiles = files.filter(f => f.endsWith('.zwo'))

  let validCount = 0
  let htmlCount = 0

  console.log(`\n📁 Category: ${categoryName}`)
  console.log(`   Total .zwo files: ${zwoFiles.length}`)

  zwoFiles.forEach(file => {
    const filePath = path.join(categoryPath, file)
    const content = fs.readFileSync(filePath, 'utf-8').trim()
    
    if (content.startsWith('<!DOCTYPE') || content.startsWith('<html')) {
      htmlCount++
    } else if (content.startsWith('<workout_file>')) {
      validCount++
    }
  })

  console.log(`   ✅ Valid XML files: ${validCount}`)
  console.log(`   ❌ HTML files (need re-download): ${htmlCount}`)

  if (htmlCount > 0 && validCount === 0) {
    console.log(`   ⚠️  All files in this category are HTML and need to be downloaded manually`)
  }
}

function main() {
  const categoryArg = process.argv[2]

  if (categoryArg) {
    checkCategory(categoryArg)
  } else {
    // Check all categories
    const categories = fs.readdirSync(WORKOUTS_DIR, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name)
      .filter(name => !name.startsWith('.'))

    console.log('🔍 Checking all workout categories...\n')
    
    categories.forEach(cat => {
      checkCategory(cat)
    })

    console.log('\n✨ Summary:')
    console.log('   Files marked as ❌ need to be downloaded manually from MyWhooshInfo.com')
    console.log('   while logged in. The download script cannot access them without authentication.')
  }
}

main()

