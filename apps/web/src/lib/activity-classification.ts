/**
 * Utility functions for calculating activity classification
 * Based on FastFitness.Tips and Treff et al. research
 */

export interface ZoneDistribution {
  z1z2: number // Low intensity (Z1+Z2)
  z3z4: number // Medium intensity (Z3+Z4)
  z5plus: number // High intensity (Z5+)
}

export interface ActivityClassification {
  name: 'Polarized' | 'Pyramidal' | 'Threshold' | 'HIIT' | 'Mixed'
  match: number // 0-100, how well it matches the classification
  distribution: ZoneDistribution
  base?: number // Base value: (Z1+Z2) / (Z3+Z4+Z5+)
}

// Standard training classifications
const CLASSIFICATIONS: Array<{ name: ActivityClassification['name']; distribution: ZoneDistribution }> = [
  { name: 'Polarized', distribution: { z1z2: 80, z3z4: 5, z5plus: 15 } },
  { name: 'Pyramidal', distribution: { z1z2: 75, z3z4: 20, z5plus: 5 } },
  { name: 'Threshold', distribution: { z1z2: 50, z3z4: 40, z5plus: 10 } },
  { name: 'HIIT', distribution: { z1z2: 50, z3z4: 10, z5plus: 40 } },
]

/**
 * Calculate zone distribution from power zone times
 */
export function calculateZoneDistribution(zoneTimes: Array<{ zone: string; percentage: number }>): ZoneDistribution {
  const z1z2 = zoneTimes
    .filter(z => z.zone === 'Z1' || z.zone === 'Z2')
    .reduce((sum, z) => sum + z.percentage, 0)
  
  const z3z4 = zoneTimes
    .filter(z => z.zone === 'Z3' || z.zone === 'Z4')
    .reduce((sum, z) => sum + z.percentage, 0)
  
  const z5plus = zoneTimes
    .filter(z => ['Z5', 'Z6', 'Z7'].includes(z.zone))
    .reduce((sum, z) => sum + z.percentage, 0)
  
  return { z1z2, z3z4, z5plus }
}

/**
 * Calculate Base value: (Z1+Z2) / (Z3+Z4+Z5+)
 */
export function calculateBase(distribution: ZoneDistribution): number {
  const denominator = distribution.z3z4 + distribution.z5plus
  if (denominator === 0) {
    return distribution.z1z2 > 0 ? 999 : 0
  }
  return distribution.z1z2 / denominator
}

/**
 * Classify an activity based on zone distribution
 */
export function classifyActivity(
  zoneTimes: Array<{ zone: string; percentage: number }>,
  ftp?: number | null
): ActivityClassification | null {
  if (!ftp || zoneTimes.length === 0) {
    return null
  }

  const distribution = calculateZoneDistribution(zoneTimes)
  const base = calculateBase(distribution)

  // Find best matching classification
  let bestMatch: ActivityClassification = {
    name: 'Mixed',
    match: 0,
    distribution,
    base
  }

  CLASSIFICATIONS.forEach(classification => {
    // Calculate Euclidean distance to determine match
    const distance = Math.sqrt(
      Math.pow(distribution.z1z2 - classification.distribution.z1z2, 2) +
      Math.pow(distribution.z3z4 - classification.distribution.z3z4, 2) +
      Math.pow(distribution.z5plus - classification.distribution.z5plus, 2)
    )
    
    // Convert distance to match percentage (inverse, max distance is ~100)
    const match = Math.max(0, 100 - (distance * 2))
    
    if (match > bestMatch.match) {
      bestMatch = {
        name: classification.name,
        match: Math.round(match),
        distribution,
        base
      }
    }
  })

  // If match is below 50%, consider it "Mixed"
  if (bestMatch.match < 50) {
    bestMatch.name = 'Mixed'
  }

  return bestMatch
}

/**
 * Get color for classification badge
 */
export function getClassificationColor(classification: ActivityClassification['name']): string {
  switch (classification) {
    case 'Polarized':
      return 'bg-purple-100 text-purple-800 border-purple-300'
    case 'Pyramidal':
      return 'bg-green-100 text-green-800 border-green-300'
    case 'Threshold':
      return 'bg-orange-100 text-orange-800 border-orange-300'
    case 'HIIT':
      return 'bg-red-100 text-red-800 border-red-300'
    case 'Mixed':
    default:
      return 'bg-gray-100 text-gray-800 border-gray-300'
  }
}

