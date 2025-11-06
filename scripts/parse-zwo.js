#!/usr/bin/env node

/**
 * Parse .zwo workout files and extract metadata
 * 
 * This script parses .zwo files and extracts useful metadata like:
 * - Workout name and description
 * - Total duration
 * - Power zones used
 * - Estimated TSS
 * - Workout structure
 * 
 * Usage:
 *   node scripts/parse-zwo.js <path-to-zwo-file>
 */

const fs = require('fs');
const path = require('path');

/**
 * Extract text content from XML using regex (simple parser)
 */
function getTextContent(xmlContent, tagName) {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = xmlContent.match(regex);
  return match ? match[1].trim() : '';
}

/**
 * Extract attribute value from XML tag
 */
function getAttribute(xmlContent, tagName, attributeName) {
  const regex = new RegExp(`<${tagName}[^>]+${attributeName}=["']([^"']+)["']`, 'i');
  const match = xmlContent.match(regex);
  return match ? match[1] : null;
}


/**
 * Get all tags (both self-closing and with closing tags)
 */
function getAllTags(xmlContent, tagName) {
  // Match both self-closing tags and tags with closing tags
  const regex = new RegExp(`<${tagName}[^>]*(?:\\/>|>([\\s\\S]*?)<\\/${tagName}>)`, 'gi');
  const matches = [];
  let match;
  while ((match = regex.exec(xmlContent)) !== null) {
    matches.push(match[0]);
  }
  return matches;
}

/**
 * Extract attribute from XML tag string
 */
function extractAttribute(tagString, attributeName) {
  const regex = new RegExp(`${attributeName}=["']([^"']+)["']`, 'i');
  const match = tagString.match(regex);
  return match ? match[1] : null;
}

/**
 * Calculate total workout duration in seconds
 */
function calculateDuration(xmlContent) {
  let totalDuration = 0;
  
  // Warmup
  const warmups = getAllTags(xmlContent, 'Warmup');
  for (const warmup of warmups) {
    const duration = parseInt(extractAttribute(warmup, 'Duration') || '0', 10);
    totalDuration += duration;
  }
  
  // SteadyState
  const steadyStates = getAllTags(xmlContent, 'SteadyState');
  for (const steadyState of steadyStates) {
    const duration = parseInt(extractAttribute(steadyState, 'Duration') || '0', 10);
    totalDuration += duration;
  }
  
  // IntervalsT (time-based intervals)
  const intervalsT = getAllTags(xmlContent, 'IntervalsT');
  for (const interval of intervalsT) {
    const repeat = parseInt(extractAttribute(interval, 'Repeat') || '1', 10);
    const onDuration = parseInt(extractAttribute(interval, 'OnDuration') || '0', 10);
    const offDuration = parseInt(extractAttribute(interval, 'OffDuration') || '0', 10);
    totalDuration += repeat * (onDuration + offDuration);
  }
  
  // IntervalsD (distance-based intervals)
  const intervalsD = getAllTags(xmlContent, 'IntervalsD');
  for (const interval of intervalsD) {
    const repeat = parseInt(extractAttribute(interval, 'Repeat') || '1', 10);
    const onDuration = parseInt(extractAttribute(interval, 'OnDuration') || '0', 10);
    const offDuration = parseInt(extractAttribute(interval, 'OffDuration') || '0', 10);
    totalDuration += repeat * (onDuration + offDuration);
  }
  
  // Cooldown
  const cooldowns = getAllTags(xmlContent, 'Cooldown');
  for (const cooldown of cooldowns) {
    const duration = parseInt(extractAttribute(cooldown, 'Duration') || '0', 10);
    totalDuration += duration;
  }
  
  return totalDuration;
}

/**
 * Extract power zones used in workout
 */
function extractPowerZones(xmlContent) {
  const zones = new Set();
  
  // Helper to categorize power percentage
  const categorizePower = (power) => {
    if (power < 0.55) return 'Z1';
    if (power < 0.75) return 'Z2';
    if (power < 0.90) return 'Z3';
    if (power < 1.05) return 'Z4';
    if (power < 1.20) return 'Z5';
    if (power < 1.50) return 'Z6';
    return 'Z7';
  };
  
  // Warmup
  const warmups = getAllTags(xmlContent, 'Warmup');
  for (const warmup of warmups) {
    const powerLow = parseFloat(extractAttribute(warmup, 'PowerLow') || '0');
    const powerHigh = parseFloat(extractAttribute(warmup, 'PowerHigh') || '0');
    if (powerLow > 0) zones.add(categorizePower(powerLow));
    if (powerHigh > 0) zones.add(categorizePower(powerHigh));
  }
  
  // SteadyState
  const steadyStates = getAllTags(xmlContent, 'SteadyState');
  for (const steadyState of steadyStates) {
    const power = parseFloat(extractAttribute(steadyState, 'Power') || '0');
    if (power > 0) zones.add(categorizePower(power));
  }
  
  // IntervalsT
  const intervalsT = getAllTags(xmlContent, 'IntervalsT');
  for (const interval of intervalsT) {
    const onPower = parseFloat(extractAttribute(interval, 'OnPower') || '0');
    const offPower = parseFloat(extractAttribute(interval, 'OffPower') || '0');
    if (onPower > 0) zones.add(categorizePower(onPower));
    if (offPower > 0) zones.add(categorizePower(offPower));
  }
  
  return Array.from(zones).sort();
}

/**
 * Estimate TSS (Training Stress Score)
 * This is a simplified estimation - actual TSS requires normalized power calculation
 */
function estimateTSS(durationSeconds, avgPowerPercent, ftp = 250) {
  // Simplified TSS calculation
  // Actual TSS = (duration in hours) * IF^2 * 100
  // where IF = Normalized Power / FTP
  // For estimation, we'll use average power percentage as IF
  const durationHours = durationSeconds / 3600;
  const intensityFactor = avgPowerPercent; // Assuming avgPowerPercent is close to IF
  return Math.round(durationHours * intensityFactor * intensityFactor * 100);
}

/**
 * Parse a .zwo file and extract metadata
 */
function parseZwoFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  
  // Check if workout element exists
  if (!content.includes('<workout')) {
    throw new Error('Invalid .zwo file: no workout element found');
  }
  
  const name = getTextContent(content, 'name');
  const author = getTextContent(content, 'author');
  const description = getTextContent(content, 'description');
  const sportType = getTextContent(content, 'sportType');
  
  const duration = calculateDuration(content);
  const powerZones = extractPowerZones(content);
  
  // Estimate average power (simplified - would need actual calculation)
  const avgPowerPercent = 0.70; // Default estimate, would need actual calculation
  
  return {
    name,
    author,
    description,
    sportType,
    duration: {
      seconds: duration,
      minutes: Math.round(duration / 60),
      formatted: `${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')}`
    },
    powerZones,
    estimatedTSS: estimateTSS(duration, avgPowerPercent),
    filePath
  };
}

/**
 * Main function
 */
function main() {
  const filePath = process.argv[2];
  
  if (!filePath) {
    console.error('Usage: node scripts/parse-zwo.js <path-to-zwo-file>');
    process.exit(1);
  }
  
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }
  
  try {
    const metadata = parseZwoFile(filePath);
    
    console.log('\n📋 Workout Metadata\n');
    console.log(`Name: ${metadata.name}`);
    console.log(`Author: ${metadata.author}`);
    console.log(`Sport: ${metadata.sportType}`);
    console.log(`Duration: ${metadata.duration.formatted} (${metadata.duration.seconds}s)`);
    console.log(`Power Zones: ${metadata.powerZones.join(', ')}`);
    console.log(`Estimated TSS: ${metadata.estimatedTSS}`);
    console.log(`\nDescription:\n${metadata.description}\n`);
    
    // Output as JSON for programmatic use
    console.log('\n📄 JSON Output:\n');
    console.log(JSON.stringify(metadata, null, 2));
  } catch (error) {
    console.error(`Error parsing file: ${error.message}`);
    process.exit(1);
  }
}

main();

