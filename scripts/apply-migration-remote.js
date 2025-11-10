#!/usr/bin/env node

/**
 * Apply migration directly to remote Supabase database
 * 
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/apply-migration-remote.js <migration-file>
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  process.exit(1);
}

const migrationFile = process.argv[2];

if (!migrationFile) {
  console.error('❌ Error: Migration file path required');
  console.error('Usage: node scripts/apply-migration-remote.js <migration-file>');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  try {
    // Read migration file
    const migrationPath = path.resolve(migrationFile);
    if (!fs.existsSync(migrationPath)) {
      console.error(`❌ Error: Migration file not found: ${migrationPath}`);
      process.exit(1);
    }

    const sql = fs.readFileSync(migrationPath, 'utf-8');
    console.log(`📄 Reading migration: ${migrationPath}`);
    console.log(`📝 SQL length: ${sql.length} characters\n`);

    // Apply migration using Supabase RPC (if available) or direct SQL
    // Note: Supabase JS client doesn't have direct SQL execution
    // We'll use the REST API instead
    
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({ sql }),
    });

    if (response.ok) {
      console.log('✅ Migration applied successfully!');
    } else {
      // Fallback: Print SQL for manual execution
      console.log('⚠️  Could not apply via API. Please run this SQL in Supabase SQL Editor:');
      console.log('\n' + '='.repeat(60));
      console.log(sql);
      console.log('='.repeat(60) + '\n');
      console.log('Or use Supabase CLI:');
      console.log(`  supabase db push --db-url "postgresql://postgres:[PASSWORD]@db.${supabaseUrl.replace('https://', '').replace('.supabase.co', '')}.supabase.co:5432/postgres"`);
    }
  } catch (error) {
    console.error('❌ Error applying migration:', error.message);
    console.log('\n📋 Please apply this migration manually in Supabase SQL Editor:');
    console.log('\n' + '='.repeat(60));
    const sql = fs.readFileSync(path.resolve(migrationFile), 'utf-8');
    console.log(sql);
    console.log('='.repeat(60) + '\n');
    process.exit(1);
  }
}

applyMigration();

