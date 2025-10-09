export interface Activity {
    id: string;
    userId: string;
    fileName: string;
    fileSize: number;
    uploadDate: Date;
    processedDate?: Date;
    status: ActivityStatus;
    metadata: ActivityMetadata;
    data: ActivityData;
    analysis?: ActivityAnalysis;
}
export interface ActivityMetadata {
    device: string;
    sport: string;
    startTime: Date;
    totalTime: number;
    totalDistance: number;
    avgSpeed: number;
    maxSpeed: number;
    avgHeartRate?: number;
    maxHeartRate?: number;
    avgPower?: number;
    maxPower?: number;
    calories?: number;
    elevationGain?: number;
    temperature?: number;
}
export interface ActivityData {
    records: ActivityRecord[];
    laps: ActivityLap[];
    sessions: ActivitySession[];
}
export interface ActivityRecord {
    timestamp: Date;
    position?: {
        lat: number;
        lng: number;
    };
    altitude?: number;
    speed?: number;
    heartRate?: number;
    power?: number;
    cadence?: number;
    temperature?: number;
}
export interface ActivityLap {
    startTime: Date;
    endTime: Date;
    totalTime: number;
    totalDistance: number;
    avgSpeed: number;
    maxSpeed: number;
    avgHeartRate?: number;
    maxHeartRate?: number;
    avgPower?: number;
    maxPower?: number;
    calories?: number;
}
export interface ActivitySession {
    sport: string;
    subSport?: string;
    startTime: Date;
    endTime: Date;
    totalTime: number;
    totalDistance: number;
    avgSpeed: number;
    maxSpeed: number;
    avgHeartRate?: number;
    maxHeartRate?: number;
    avgPower?: number;
    maxPower?: number;
    calories?: number;
    trainingEffect?: number;
    normalizedPower?: number;
    intensityFactor?: number;
    variabilityIndex?: number;
}
export interface ActivityAnalysis {
    id: string;
    activityId: string;
    generatedAt: Date;
    summary: string;
    insights: string[];
    recommendations: WorkoutRecommendation[];
    trends: ActivityTrend[];
    performanceMetrics: PerformanceMetrics;
}
export interface WorkoutRecommendation {
    type: WorkoutType;
    duration: number;
    intensity: IntensityLevel;
    description: string;
    targetMetrics: {
        heartRate?: {
            min: number;
            max: number;
        };
        power?: {
            min: number;
            max: number;
        };
    };
    rationale: string;
}
export interface ActivityTrend {
    metric: string;
    period: string;
    direction: 'up' | 'down' | 'stable';
    change: number;
    significance: 'low' | 'medium' | 'high';
}
export interface PerformanceMetrics {
    fitnessScore?: number;
    fatigueScore?: number;
    formScore?: number;
    powerCurve?: PowerCurvePoint[];
    heartRateZones?: HeartRateZone[];
    powerZones?: PowerZone[];
}
export interface PowerCurvePoint {
    duration: number;
    power: number;
}
export interface HeartRateZone {
    zone: number;
    min: number;
    max: number;
    description: string;
}
export interface PowerZone {
    zone: number;
    min: number;
    max: number;
    description: string;
}
export declare enum ActivityStatus {
    UPLOADED = "uploaded",
    PROCESSING = "processing",
    PROCESSED = "processed",
    FAILED = "failed"
}
export declare enum WorkoutType {
    ENDURANCE = "endurance",
    TEMPO = "tempo",
    INTERVAL = "interval",
    SPRINT = "sprint",
    RECOVERY = "recovery",
    LONG_RIDE = "long_ride"
}
export declare enum IntensityLevel {
    LOW = "low",
    MODERATE = "moderate",
    HIGH = "high",
    MAXIMAL = "maximal"
}
export interface User {
    id: string;
    email: string;
    name?: string;
    preferences: UserPreferences;
    createdAt: Date;
    updatedAt: Date;
}
export interface UserPreferences {
    goals: FitnessGoal[];
    availableTime: {
        weekdays: number;
        weekends: number;
    };
    experienceLevel: ExperienceLevel;
    preferredWorkoutTypes: WorkoutType[];
    heartRateZones?: HeartRateZone[];
    powerZones?: PowerZone[];
    notifications: NotificationSettings;
}
export interface FitnessGoal {
    type: GoalType;
    target: string;
    timeframe: string;
    priority: 'low' | 'medium' | 'high';
}
export interface NotificationSettings {
    weeklySummary: boolean;
    workoutReminders: boolean;
    achievementAlerts: boolean;
    email: boolean;
    push: boolean;
}
export declare enum ExperienceLevel {
    BEGINNER = "beginner",
    INTERMEDIATE = "intermediate",
    ADVANCED = "advanced",
    EXPERT = "expert"
}
export declare enum GoalType {
    FITNESS = "fitness",
    PERFORMANCE = "performance",
    WEIGHT_LOSS = "weight_loss",
    ENDURANCE = "endurance",
    SPEED = "speed",
    POWER = "power"
}
export interface ApiResponse<T> {
    data?: T;
    error?: string;
    message?: string;
}
export interface PaginatedResponse<T> {
    data: T[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}
export interface FileUpload {
    file: File;
    progress: number;
    status: 'pending' | 'uploading' | 'success' | 'error';
    error?: string;
}
export interface ProcessingJob {
    id: string;
    activityId: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progress: number;
    startedAt?: Date;
    completedAt?: Date;
    error?: string;
}
//# sourceMappingURL=index.d.ts.map