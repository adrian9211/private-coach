#!/usr/bin/env node

/**
 * Import workouts from JSON files into the database
 * 
 * This script reads all workout JSON files and imports them into the Supabase database.
 * 
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/import-workouts-to-db.js
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const WORKOUTS_DIR = path.resolve(__dirname, '..', 'workouts');

// Get Supabase credentials from environment
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  console.error('Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/import-workouts-to-db.js');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Extract power zones from workout steps
 */
function extractPowerZones(steps) {
  if (!Array.isArray(steps)) return [];
  
  const zones = new Set();
  
  steps.forEach(step => {
    if (step.powerLow !== null && step.powerLow !== undefined) {
      const power = step.powerLow;
      if (power < 55) zones.add('Z1');
      else if (power < 76) zones.add('Z2');
      else if (power < 91) zones.add('Z3');
      else if (power < 106) zones.add('Z4');
      else if (power < 121) zones.add('Z5');
      else if (power < 151) zones.add('Z6');
      else zones.add('Z7');
    }
    if (step.powerHigh !== null && step.powerHigh !== undefined && step.powerHigh !== step.powerLow) {
      const power = step.powerHigh;
      if (power < 55) zones.add('Z1');
      else if (power < 76) zones.add('Z2');
      else if (power < 91) zones.add('Z3');
      else if (power < 106) zones.add('Z4');
      else if (power < 121) zones.add('Z5');
      else if (power < 151) zones.add('Z6');
      else zones.add('Z7');
    }
  });
  
  return Array.from(zones).sort();
}

/**
 * Process all workout JSON files
 */
async function importWorkouts() {
  const categories = await fs.promises.readdir(WORKOUTS_DIR, { withFileTypes: true });
  const results = {
    total: 0,
    imported: 0,
    updated: 0,
    errors: 0,
    categories: {},
  };

  for (const categoryDirent of categories) {
    if (!categoryDirent.isDirectory() || categoryDirent.name.startsWith('.')) {
      continue;
    }

    const category = categoryDirent.name;
    const categoryPath = path.join(WORKOUTS_DIR, category);
    const files = await fs.promises.readdir(categoryPath);
    const jsonFiles = files.filter(f => f.endsWith('.json'));

    const categoryResults = {
      total: jsonFiles.length,
      imported: 0,
      updated: 0,
      errors: 0,
    };

    console.log(`\n📁 Processing category: ${category} (${jsonFiles.length} workouts)`);

    for (const file of jsonFiles) {
      try {
        const filePath = path.join(categoryPath, file);
        const content = await fs.promises.readFile(filePath, 'utf-8');
        const workout = JSON.parse(content);

        if (!workout.isValid || !workout.name || !workout.steps || workout.steps.length === 0) {
          console.log(`⚠️  Skipping ${category}/${file} - Invalid workout data`);
          categoryResults.errors++;
          continue;
        }

        results.total++;

        // Extract power zones
        const powerZones = extractPowerZones(workout.steps);

        // Prepare workout data for database
        const workoutData = {
          slug: workout.slug,
          category: category,
          name: workout.name,
          author: workout.author || 'mywhooshinfo.com',
          description: workout.description || null,
          sport_type: workout.sportType || 'bike',
          duration: workout.duration || null,
          duration_seconds: workout.steps.reduce((sum, step) => sum + (step.duration || 0), 0),
          tss: workout.tss || null,
          intensity_factor: workout.intensityFactor || null,
          download_url: workout.downloadUrl || null,
          steps: workout.steps,
          power_zones: powerZones.length > 0 ? powerZones : null,
          source: workout.source || 'json',
        };

        // Upsert workout (insert or update if exists)
        const { data, error } = await supabase
          .from('workouts')
          .upsert(workoutData, {
            onConflict: 'category,slug',
            ignoreDuplicates: false,
          })
          .select()
          .single();

        if (error) {
          console.error(`❌ Error importing ${category}/${file}:`, error.message);
          categoryResults.errors++;
          results.errors++;
        } else {
          // Check if it was an insert or update
          const { data: existing } = await supabase
            .from('workouts')
            .select('created_at')
            .eq('category', category)
            .eq('slug', workout.slug)
            .single();

          if (existing && new Date(existing.created_at).getTime() < Date.now() - 1000) {
            categoryResults.updated++;
            results.updated++;
            console.log(`  ✅ Updated: ${workout.name}`);
          } else {
            categoryResults.imported++;
            results.imported++;
            console.log(`  ✅ Imported: ${workout.name}`);
          }
        }
      } catch (error) {
        console.error(`❌ Error processing ${category}/${file}:`, error.message);
        categoryResults.errors++;
        results.errors++;
      }
    }

    results.categories[category] = categoryResults;
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 IMPORT SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total workouts processed: ${results.total}`);
  console.log(`✅ Successfully imported: ${results.imported}`);
  console.log(`🔄 Updated: ${results.updated}`);
  console.log(`❌ Errors: ${results.errors}`);
  console.log('\n📁 By Category:');
  Object.entries(results.categories).forEach(([category, stats]) => {
    console.log(`  ${category}: ${stats.imported} imported, ${stats.updated} updated, ${stats.errors} errors`);
  });
  console.log('='.repeat(60));

  return results;
}

// Run the import
importWorkouts()
  .then(() => {
    console.log('\n✅ Import completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Import failed:', error);
    process.exit(1);
  });

