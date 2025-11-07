#!/usr/bin/env node

/**
 * Extract readable workout information from HTML files
 * 
 * This script processes HTML files that were downloaded instead of .zwo files
 * and extracts all available workout information to create readable summaries.
 * 
 * Usage:
 *   node scripts/extract-workout-from-html.js
 */

const fs = require('fs');
const path = require('path');

const WORKOUTS_DIR = path.resolve(__dirname, '..', 'workouts');
const BASE_URL = 'https://mywhooshinfo.com';

/**
 * Extract workout information from HTML content
 */
function extractWorkoutFromHTML(html, filename) {
  const workout = {
    filename,
    slug: filename.replace('.zwo', ''),
    downloadUrl: null,
    name: null,
    description: null,
    duration: null,
    tss: null,
    intensityFactor: null,
    steps: [],
    isValid: false,
  };

  // Extract download URL
  const downloadUrlMatch = html.match(/href=["']([^"']*\/workouts\/workout\/[^"']*\?do=exportZwo)["']/i);
  if (downloadUrlMatch) {
    let url = downloadUrlMatch[1];
    if (url.startsWith('/')) {
      url = BASE_URL + url;
    }
    workout.downloadUrl = url;
  }

  // Extract name from <h1> tag
  const nameMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (nameMatch) {
    workout.name = nameMatch[1].trim();
  }

  // Extract duration, TSS, IF from badges
  // Pattern: <span class="badge bg-info">Duration 31:00</span>
  const durationMatch = html.match(/<span[^>]*badge[^>]*>Duration\s+([\d:]+)<\/span>/i);
  if (durationMatch) {
    workout.duration = durationMatch[1].trim();
  }

  const tssMatch = html.match(/<span[^>]*badge[^>]*>TSS\s+(\d+)<\/span>/i);
  if (tssMatch) {
    workout.tss = parseInt(tssMatch[1], 10);
  }

  const ifMatch = html.match(/<span[^>]*badge[^>]*>IF\s+([\d.]+)<\/span>/i);
  if (ifMatch) {
    workout.intensityFactor = parseFloat(ifMatch[1]);
  }

  // Extract description (text after the SVG chart, before closing div)
  // Pattern: </svg> ... <div class="mt-2"></div> ... description text ... </div>
  const descMatch = html.match(/<\/svg>[\s\S]*?<div[^>]*mt-2[^>]*><\/div>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/i);
  if (descMatch) {
    workout.description = descMatch[1]
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .trim();
  }

  // Extract workout steps from the workout-step-list
  // The steps are in a div with class "workout-step-list" and each step is a div with class "workout-step"
  const stepsMatch = html.match(/<div[^>]*workout-step-list[^>]*>([\s\S]*?)<\/div>\s*<button/i);
  if (!stepsMatch) {
    // Try alternative pattern - the list might end differently
    const altMatch = html.match(/<div[^>]*workout-step-list[^>]*>([\s\S]*?)<\/div>/i);
    if (altMatch) {
      const stepsHtml = altMatch[1];
      const stepRegex = /<div[^>]*workout-step[^>]*>([\s\S]*?)<\/div>/gi;
      let stepMatch;
      
      while ((stepMatch = stepRegex.exec(stepsHtml)) !== null) {
        const stepHtml = stepMatch[1];
        
        // Extract step type (warmup, cooldown, ramp, or empty for steady state)
        let stepType = 'steadystate';
        if (stepHtml.toLowerCase().includes('warmup')) stepType = 'warmup';
        else if (stepHtml.toLowerCase().includes('cooldown')) stepType = 'cooldown';
        else if (stepHtml.toLowerCase().includes('ramp')) stepType = 'ramp';
        
        // Extract duration (format: MM:SS or HH:MM:SS) - look for pattern like "03:00 @"
        const durationMatch = stepHtml.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*@/);
        let durationSeconds = 0;
        let durationFormatted = null;
        if (durationMatch) {
          durationFormatted = durationMatch[0].replace(/\s*@/, '');
          if (durationMatch[3]) {
            // HH:MM:SS
            durationSeconds = parseInt(durationMatch[1], 10) * 3600 + 
                             parseInt(durationMatch[2], 10) * 60 + 
                             parseInt(durationMatch[3], 10);
          } else {
            // MM:SS
            durationSeconds = parseInt(durationMatch[1], 10) * 60 + 
                             parseInt(durationMatch[2], 10);
          }
        }
        
        // Extract power percentage(s) - patterns like "45% FTP - 60% FTP" or "60%" or "88% FTP - 130% FTP"
        const powerRangeMatch = stepHtml.match(/(\d+(?:\.\d+)?)%\s*FTP\s*-\s*(\d+(?:\.\d+)?)%\s*FTP/i);
        const powerSingleMatch = stepHtml.match(/(\d+(?:\.\d+)?)%\s*FTP/i);
        const powerSimpleMatch = stepHtml.match(/(\d+(?:\.\d+)?)%/);
        
        let powerLow = null;
        let powerHigh = null;
        let powerFormatted = null;
        
        if (powerRangeMatch) {
          powerLow = parseFloat(powerRangeMatch[1]);
          powerHigh = parseFloat(powerRangeMatch[2]);
          powerFormatted = `${powerRangeMatch[1]}% FTP - ${powerRangeMatch[2]}% FTP`;
        } else if (powerSingleMatch) {
          powerLow = parseFloat(powerSingleMatch[1]);
          powerHigh = powerLow;
          powerFormatted = `${powerSingleMatch[1]}% FTP`;
        } else if (powerSimpleMatch) {
          powerLow = parseFloat(powerSimpleMatch[1]);
          powerHigh = powerLow;
          powerFormatted = `${powerSimpleMatch[1]}%`;
        }
        
        if (durationSeconds > 0 || powerLow !== null) {
          workout.steps.push({
            type: stepType,
            duration: durationSeconds,
            durationFormatted,
            powerLow,
            powerHigh,
            powerFormatted,
          });
        }
      }
    }
  } else {
    const stepsHtml = stepsMatch[1];
    const stepRegex = /<div[^>]*workout-step[^>]*>([\s\S]*?)<\/div>/gi;
    let stepMatch;
    
    while ((stepMatch = stepRegex.exec(stepsHtml)) !== null) {
      const stepHtml = stepMatch[1];
      
      // Extract step type (warmup, cooldown, ramp, or empty for steady state)
      let stepType = 'steadystate';
      if (stepHtml.toLowerCase().includes('warmup')) stepType = 'warmup';
      else if (stepHtml.toLowerCase().includes('cooldown')) stepType = 'cooldown';
      else if (stepHtml.toLowerCase().includes('ramp')) stepType = 'ramp';
      
      // Extract duration (format: MM:SS or HH:MM:SS) - look for pattern like "03:00 @"
      const durationMatch = stepHtml.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*@/);
      let durationSeconds = 0;
      let durationFormatted = null;
      if (durationMatch) {
        durationFormatted = durationMatch[0].replace(/\s*@/, '');
        if (durationMatch[3]) {
          // HH:MM:SS
          durationSeconds = parseInt(durationMatch[1], 10) * 3600 + 
                           parseInt(durationMatch[2], 10) * 60 + 
                           parseInt(durationMatch[3], 10);
        } else {
          // MM:SS
          durationSeconds = parseInt(durationMatch[1], 10) * 60 + 
                           parseInt(durationMatch[2], 10);
        }
      }
      
      // Extract power percentage(s) - patterns like "45% FTP - 60% FTP" or "60%" or "88% FTP - 130% FTP"
      const powerRangeMatch = stepHtml.match(/(\d+(?:\.\d+)?)%\s*FTP\s*-\s*(\d+(?:\.\d+)?)%\s*FTP/i);
      const powerSingleMatch = stepHtml.match(/(\d+(?:\.\d+)?)%\s*FTP/i);
      const powerSimpleMatch = stepHtml.match(/(\d+(?:\.\d+)?)%/);
      
      let powerLow = null;
      let powerHigh = null;
      let powerFormatted = null;
      
      if (powerRangeMatch) {
        powerLow = parseFloat(powerRangeMatch[1]);
        powerHigh = parseFloat(powerRangeMatch[2]);
        powerFormatted = `${powerRangeMatch[1]}% FTP - ${powerRangeMatch[2]}% FTP`;
      } else if (powerSingleMatch) {
        powerLow = parseFloat(powerSingleMatch[1]);
        powerHigh = powerLow;
        powerFormatted = `${powerSingleMatch[1]}% FTP`;
      } else if (powerSimpleMatch) {
        powerLow = parseFloat(powerSimpleMatch[1]);
        powerHigh = powerLow;
        powerFormatted = `${powerSimpleMatch[1]}%`;
      }
      
      if (durationSeconds > 0 || powerLow !== null) {
        workout.steps.push({
          type: stepType,
          duration: durationSeconds,
          durationFormatted,
          powerLow,
          powerHigh,
          powerFormatted,
        });
      }
    }
  }

  // Mark as valid if we extracted at least name and steps
  workout.isValid = !!(workout.name && workout.steps.length > 0);

  return workout;
}

/**
 * Process all HTML files in workouts directory
 */
async function processWorkouts() {
  const categories = await fs.promises.readdir(WORKOUTS_DIR, { withFileTypes: true });
  const results = {
    totalProcessed: 0,
    validWorkouts: 0,
    invalidFiles: 0,
    categories: {},
  };

  for (const categoryDirent of categories) {
    if (!categoryDirent.isDirectory() || categoryDirent.name.startsWith('.')) {
      continue;
    }

    const category = categoryDirent.name;
    const categoryPath = path.join(WORKOUTS_DIR, category);
    const files = await fs.promises.readdir(categoryPath);
    const htmlFiles = files.filter(f => f.endsWith('.zwo'));

    const categoryResults = {
      total: htmlFiles.length,
      valid: 0,
      invalid: 0,
      workouts: [],
    };

    for (const file of htmlFiles) {
      const filePath = path.join(categoryPath, file);
      const content = await fs.promises.readFile(filePath, 'utf-8');

      // Skip if it's already valid XML
      if (content.trim().startsWith('<workout_file>')) {
        console.log(`✅ ${category}/${file} - Already valid XML, skipping`);
        continue;
      }

      // Skip if it's not HTML
      if (!content.trim().startsWith('<!DOCTYPE') && !content.trim().startsWith('<html')) {
        console.log(`⚠️  ${category}/${file} - Not HTML or XML, skipping`);
        categoryResults.invalid++;
        continue;
      }

      results.totalProcessed++;
      const workout = extractWorkoutFromHTML(content, file);

      if (workout.isValid) {
        categoryResults.valid++;
        results.validWorkouts++;
        categoryResults.workouts.push(workout);

        // Save as JSON for readable format
        const jsonPath = filePath.replace('.zwo', '.json');
        await fs.promises.writeFile(
          jsonPath,
          JSON.stringify(workout, null, 2),
          'utf-8'
        );

        console.log(`✅ ${category}/${file} - Extracted: ${workout.name}`);
      } else {
        categoryResults.invalid++;
        results.invalidFiles++;
        console.log(`❌ ${category}/${file} - Could not extract workout data`);
      }
    }

    results.categories[category] = categoryResults;
  }

  // Save summary
  const summaryPath = path.join(WORKOUTS_DIR, 'extracted-workouts-summary.json');
  await fs.promises.writeFile(
    summaryPath,
    JSON.stringify(results, null, 2),
    'utf-8'
  );

  console.log('\n📊 Summary:');
  console.log(`Total processed: ${results.totalProcessed}`);
  console.log(`Valid workouts extracted: ${results.validWorkouts}`);
  console.log(`Invalid files: ${results.invalidFiles}`);
  console.log(`\nSummary saved to: ${summaryPath}`);
}

// Run the script
processWorkouts().catch(console.error);

