#!/usr/bin/env node

/**
 * Download workouts from MyWhooshInfo.com
 * 
 * This script downloads .zwo workout files from MyWhooshInfo.com
 * and organizes them into category folders.
 * 
 * Usage:
 *   node scripts/download-workouts.js [category]
 * 
 * If no category is specified, it will download all categories.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Category mapping from website to folder names and category IDs
const CATEGORIES = {
  'BEGINNER': { folder: 'BEGINNER', id: 2 },
  'UNDER 35 MIN': { folder: 'UNDER_35_MIN', id: 3 },
  'FAST FITNESS': { folder: 'FAST_FITNESS', id: 4 },
  'TESTING': { folder: 'TESTING', id: 5 },
  'ANAEROBIC': { folder: 'ANAEROBIC', id: 6 },
  'ENDURANCE': { folder: 'ENDURANCE', id: 7 },
  'SPRINT': { folder: 'SPRINT', id: 8 },
  'SWEETSPOT': { folder: 'SWEETSPOT', id: 9 },
  'TAPER': { folder: 'TAPER', id: 10 },
  'TEMPO': { folder: 'TEMPO', id: 11 },
  'THRESHOLD': { folder: 'THRESHOLD', id: 12 },
  'UAE TEAM EMIRATES': { folder: 'UAE_TEAM_EMIRATES', id: 13 },
  'UAE TEAM ADQ': { folder: 'UAE_TEAM_ADQ', id: 14 },
  'VO2MAX': { folder: 'VO2MAX', id: 15 },
  'ALL TRAINING PLAN WORKOUTS': { folder: 'ALL_TRAINING_PLAN_WORKOUTS', id: 1000 }
};

const WORKOUTS_DIR = path.join(__dirname, '..', 'workouts');
const BASE_URL = 'https://mywhooshinfo.com';

/**
 * Create directory if it doesn't exist
 */
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`Created directory: ${dirPath}`);
  }
}

/**
 * Download a file from URL
 * Handles redirects and checks if response is actually a file
 */
function downloadFile(url, filePath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    
    const file = fs.createWriteStream(filePath);
    let isFile = false;
    let contentType = '';
    
    protocol.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 307 || response.statusCode === 308) {
        file.close();
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        const redirectUrl = response.headers.location;
        const absoluteUrl = redirectUrl.startsWith('http') ? redirectUrl : new URL(redirectUrl, url).href;
        return downloadFile(absoluteUrl, filePath)
          .then(resolve)
          .catch(reject);
      }
      
      if (response.statusCode !== 200) {
        file.close();
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        reject(new Error(`Failed to download: HTTP ${response.statusCode}`));
        return;
      }
      
      contentType = response.headers['content-type'] || '';
      const contentDisposition = response.headers['content-disposition'] || '';
      
      // Check if this looks like a file download
      isFile = contentType.includes('application/') || 
               contentType.includes('text/xml') ||
               contentType.includes('application/xml') ||
               contentDisposition.includes('attachment') ||
               contentDisposition.includes('.zwo');
      
      // If it's HTML, it might be a login page or error - we'll still save it but warn
      if (contentType.includes('text/html') && !isFile) {
        // We'll save it anyway and let the user know
        console.log(`      ⚠️  Warning: Response appears to be HTML, not a .zwo file. May require authentication.`);
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        
        // Quick check: if file starts with HTML, it's probably not a valid .zwo
        const stats = fs.statSync(filePath);
        if (stats.size > 0) {
          const firstBytes = fs.readFileSync(filePath, { encoding: 'utf8', start: 0, end: 50 });
          if (firstBytes.trim().startsWith('<!DOCTYPE') || firstBytes.trim().startsWith('<html')) {
            console.log(`      ⚠️  Warning: Downloaded file appears to be HTML. Authentication may be required.`);
          }
        }
        
        resolve();
      });
    }).on('error', (err) => {
      file.close();
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      reject(err);
    });
  });
}

/**
 * Fetch HTML content from URL
 */
function fetchHTML(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    
    protocol.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }
      
      let data = '';
      response.on('data', (chunk) => {
        data += chunk;
      });
      
      response.on('end', () => {
        resolve(data);
      });
    }).on('error', reject);
  });
}

/**
 * Extract workout download links from HTML
 * Pattern: /workouts/workout/{slug} -> convert to /workouts/workout/{slug}?do=exportZwo
 */
function extractWorkoutLinks(html, category) {
  const links = [];
  
  // Look for .zwo file links (direct download links) - these are rare
  const zwoLinkRegex = /href=["']([^"']+\.zwo)["']/gi;
  let match;
  
  while ((match = zwoLinkRegex.exec(html)) !== null) {
    let url = match[1];
    
    // Convert relative URLs to absolute
    if (url.startsWith('/')) {
      url = BASE_URL + url;
    } else if (!url.startsWith('http')) {
      url = BASE_URL + '/' + url;
    }
    
    links.push(url);
  }
  
  // Look for workout detail page links: /workouts/workout/{slug}
  // Pattern: href="/workouts/workout/{slug}" or href='/workouts/workout/{slug}'
  const workoutPageRegex = /href=["']([^"']*\/workouts\/workout\/[^"']+)["']/gi;
  const workoutPages = new Set();
  
  while ((match = workoutPageRegex.exec(html)) !== null) {
    let url = match[1];
    
    // Remove query parameters if present (we'll add our own)
    url = url.split('?')[0];
    
    // Convert relative URLs to absolute
    if (url.startsWith('/')) {
      url = BASE_URL + url;
    } else if (!url.startsWith('http')) {
      url = BASE_URL + '/' + url;
    }
    
    // Only add if it's a workout detail page (not category or list page)
    if (url.includes('/workout/') && !url.includes('/category/')) {
      workoutPages.add(url);
    }
  }
  
  // Convert workout detail pages to download URLs by appending ?do=exportZwo
  for (const workoutPage of workoutPages) {
    const downloadUrl = workoutPage + '?do=exportZwo';
    links.push(downloadUrl);
  }
  
  return [...new Set(links)]; // Remove duplicates
}

/**
 * Sanitize filename
 */
function sanitizeFilename(filename) {
  return filename
    .replace(/[^a-z0-9.-]/gi, '_')
    .replace(/_{2,}/g, '_')
    .toLowerCase();
}

/**
 * Download workouts for a specific category
 */
async function downloadCategory(categoryName) {
  const categoryInfo = CATEGORIES[categoryName.toUpperCase()];
  
  if (!categoryInfo) {
    console.error(`Unknown category: ${categoryName}`);
    return;
  }
  
  const folderName = categoryInfo.folder;
  const categoryId = categoryInfo.id;
  
  const categoryDir = path.join(WORKOUTS_DIR, folderName);
  ensureDir(categoryDir);
  
  console.log(`\n📥 Downloading workouts for category: ${categoryName}`);
  console.log(`   Folder: ${folderName}`);
  
  try {
    // Construct the category URL using the category ID
    const categoryUrl = `${BASE_URL}/workouts/category/${categoryId}`;
    
    console.log(`   Fetching: ${categoryUrl}`);
    
    // Fetch the category page
    const html = await fetchHTML(categoryUrl);
    
    // Extract workout links
    const workoutLinks = extractWorkoutLinks(html, categoryName);
    
    if (workoutLinks.length === 0) {
      console.log(`   ⚠️  No workout links found.`);
      console.log(`   💡 The website may require login or use JavaScript to load workouts.`);
      console.log(`   💡 Manual download: Visit ${categoryUrl} in a browser, log in if needed,`);
      console.log(`      then download .zwo files and place them in: ${categoryDir}`);
      console.log(`   💡 You can also check the network tab in browser DevTools to find API endpoints.`);
      return;
    }
    
    console.log(`   Found ${workoutLinks.length} workout(s)`);
    
    // Download each workout
    for (let i = 0; i < workoutLinks.length; i++) {
      const url = workoutLinks[i];
      const urlObj = new URL(url);
      const urlPath = urlObj.pathname;
      
      // Extract workout slug from path: /workouts/workout/{slug}
      // Use the slug as filename, or fallback to basename
      let filename;
      const workoutMatch = urlPath.match(/\/workout\/([^\/]+)/);
      if (workoutMatch) {
        filename = workoutMatch[1] + '.zwo';
      } else {
        filename = path.basename(urlPath) || `workout-${i + 1}.zwo`;
        // Ensure .zwo extension
        if (!filename.endsWith('.zwo')) {
          filename += '.zwo';
        }
      }
      
      const sanitizedFilename = sanitizeFilename(filename);
      const filePath = path.join(categoryDir, sanitizedFilename);
      
      // Skip if file already exists
      if (fs.existsSync(filePath)) {
        console.log(`   ⏭️  Skipping (already exists): ${sanitizedFilename}`);
        continue;
      }
      
      try {
        console.log(`   📥 Downloading: ${sanitizedFilename}...`);
        console.log(`      URL: ${url}`);
        await downloadFile(url, filePath);
        console.log(`   ✅ Downloaded: ${sanitizedFilename}`);
        
        // Add a small delay to be respectful to the server
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`   ❌ Failed to download ${sanitizedFilename}: ${error.message}`);
      }
    }
    
    console.log(`   ✨ Completed category: ${categoryName}`);
  } catch (error) {
    console.error(`   ❌ Error processing category ${categoryName}: ${error.message}`);
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🚴 Workout Downloader for MyWhooshInfo.com\n');
  
  // Ensure workouts directory exists
  ensureDir(WORKOUTS_DIR);
  
  // Get category from command line argument
  const categoryArg = process.argv[2];
  
  if (categoryArg) {
    // Download specific category
    await downloadCategory(categoryArg);
  } else {
    // Download all categories
    console.log('📋 Downloading all categories...\n');
    
    for (const categoryName of Object.keys(CATEGORIES)) {
      await downloadCategory(categoryName);
    }
    
    console.log('\n✨ All downloads completed!');
  }
}

// Run the script
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

