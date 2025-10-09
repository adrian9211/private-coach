// Utility functions for data processing and validation

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(2)} km`;
  }
  return `${meters.toFixed(0)} m`;
}

export function formatSpeed(mps: number): string {
  const kmh = mps * 3.6;
  return `${kmh.toFixed(1)} km/h`;
}

export function formatPower(watts: number): string {
  return `${watts.toFixed(0)} W`;
}

export function formatHeartRate(bpm: number): string {
  return `${bpm} bpm`;
}

export function calculatePace(mps: number): string {
  if (mps === 0) return '0:00';
  const secondsPerKm = 1000 / mps;
  const minutes = Math.floor(secondsPerKm / 60);
  const seconds = Math.floor(secondsPerKm % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function validateFileType(file: File): boolean {
  const allowedTypes = ['.fit', '.gpx', '.tcx'];
  const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
  return allowedTypes.includes(extension);
}

export function validateFileSize(file: File, maxSizeMB: number = 50): boolean {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  return file.size <= maxSizeBytes;
}

export function calculateTrainingStressScore(
  normalizedPower: number,
  duration: number,
  functionalThresholdPower: number
): number {
  const intensityFactor = normalizedPower / functionalThresholdPower;
  const trainingStressScore = (duration / 3600) * intensityFactor * intensityFactor * 100;
  return Math.round(trainingStressScore);
}

export function calculateIntensityFactor(
  normalizedPower: number,
  functionalThresholdPower: number
): number {
  return normalizedPower / functionalThresholdPower;
}

export function calculateVariabilityIndex(
  normalizedPower: number,
  averagePower: number
): number {
  return normalizedPower / averagePower;
}

export function getHeartRateZone(
  heartRate: number,
  zones: Array<{ min: number; max: number }>
): number {
  for (let i = 0; i < zones.length; i++) {
    if (heartRate >= zones[i].min && heartRate <= zones[i].max) {
      return i + 1;
    }
  }
  return zones.length; // Above all zones
}

export function getPowerZone(
  power: number,
  zones: Array<{ min: number; max: number }>
): number {
  for (let i = 0; i < zones.length; i++) {
    if (power >= zones[i].min && power <= zones[i].max) {
      return i + 1;
    }
  }
  return zones.length; // Above all zones
}

export function calculateCalories(
  duration: number,
  avgPower: number,
  weight: number
): number {
  // Rough estimation: 1 watt = 0.24 calories per hour
  const wattsToCaloriesPerHour = 0.24;
  const caloriesPerHour = avgPower * wattsToCaloriesPerHour;
  return Math.round((caloriesPerHour * duration) / 3600);
}

export function generateActivityId(): string {
  return `act_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function generateAnalysisId(): string {
  return `ana_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}


