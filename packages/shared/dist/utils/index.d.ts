export declare function formatDuration(seconds: number): string;
export declare function formatDistance(meters: number): string;
export declare function formatSpeed(mps: number): string;
export declare function formatPower(watts: number): string;
export declare function formatHeartRate(bpm: number): string;
export declare function calculatePace(mps: number): string;
export declare function validateFileType(file: File): boolean;
export declare function validateFileSize(file: File, maxSizeMB?: number): boolean;
export declare function calculateTrainingStressScore(normalizedPower: number, duration: number, functionalThresholdPower: number): number;
export declare function calculateIntensityFactor(normalizedPower: number, functionalThresholdPower: number): number;
export declare function calculateVariabilityIndex(normalizedPower: number, averagePower: number): number;
export declare function getHeartRateZone(heartRate: number, zones: Array<{
    min: number;
    max: number;
}>): number;
export declare function getPowerZone(power: number, zones: Array<{
    min: number;
    max: number;
}>): number;
export declare function calculateCalories(duration: number, avgPower: number, weight: number): number;
export declare function generateActivityId(): string;
export declare function generateAnalysisId(): string;
//# sourceMappingURL=index.d.ts.map