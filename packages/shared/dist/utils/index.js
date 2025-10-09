"use strict";
// Utility functions for data processing and validation
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatDuration = formatDuration;
exports.formatDistance = formatDistance;
exports.formatSpeed = formatSpeed;
exports.formatPower = formatPower;
exports.formatHeartRate = formatHeartRate;
exports.calculatePace = calculatePace;
exports.validateFileType = validateFileType;
exports.validateFileSize = validateFileSize;
exports.calculateTrainingStressScore = calculateTrainingStressScore;
exports.calculateIntensityFactor = calculateIntensityFactor;
exports.calculateVariabilityIndex = calculateVariabilityIndex;
exports.getHeartRateZone = getHeartRateZone;
exports.getPowerZone = getPowerZone;
exports.calculateCalories = calculateCalories;
exports.generateActivityId = generateActivityId;
exports.generateAnalysisId = generateAnalysisId;
function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}
function formatDistance(meters) {
    if (meters >= 1000) {
        return `${(meters / 1000).toFixed(2)} km`;
    }
    return `${meters.toFixed(0)} m`;
}
function formatSpeed(mps) {
    const kmh = mps * 3.6;
    return `${kmh.toFixed(1)} km/h`;
}
function formatPower(watts) {
    return `${watts.toFixed(0)} W`;
}
function formatHeartRate(bpm) {
    return `${bpm} bpm`;
}
function calculatePace(mps) {
    if (mps === 0)
        return '0:00';
    const secondsPerKm = 1000 / mps;
    const minutes = Math.floor(secondsPerKm / 60);
    const seconds = Math.floor(secondsPerKm % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
function validateFileType(file) {
    const allowedTypes = ['.fit', '.gpx', '.tcx'];
    const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    return allowedTypes.includes(extension);
}
function validateFileSize(file, maxSizeMB = 50) {
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    return file.size <= maxSizeBytes;
}
function calculateTrainingStressScore(normalizedPower, duration, functionalThresholdPower) {
    const intensityFactor = normalizedPower / functionalThresholdPower;
    const trainingStressScore = (duration / 3600) * intensityFactor * intensityFactor * 100;
    return Math.round(trainingStressScore);
}
function calculateIntensityFactor(normalizedPower, functionalThresholdPower) {
    return normalizedPower / functionalThresholdPower;
}
function calculateVariabilityIndex(normalizedPower, averagePower) {
    return normalizedPower / averagePower;
}
function getHeartRateZone(heartRate, zones) {
    for (let i = 0; i < zones.length; i++) {
        if (heartRate >= zones[i].min && heartRate <= zones[i].max) {
            return i + 1;
        }
    }
    return zones.length; // Above all zones
}
function getPowerZone(power, zones) {
    for (let i = 0; i < zones.length; i++) {
        if (power >= zones[i].min && power <= zones[i].max) {
            return i + 1;
        }
    }
    return zones.length; // Above all zones
}
function calculateCalories(duration, avgPower, weight) {
    // Rough estimation: 1 watt = 0.24 calories per hour
    const wattsToCaloriesPerHour = 0.24;
    const caloriesPerHour = avgPower * wattsToCaloriesPerHour;
    return Math.round((caloriesPerHour * duration) / 3600);
}
function generateActivityId() {
    return `act_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
function generateAnalysisId() {
    return `ana_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
//# sourceMappingURL=index.js.map