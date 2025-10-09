"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoalType = exports.ExperienceLevel = exports.IntensityLevel = exports.WorkoutType = exports.ActivityStatus = void 0;
// Enums
var ActivityStatus;
(function (ActivityStatus) {
    ActivityStatus["UPLOADED"] = "uploaded";
    ActivityStatus["PROCESSING"] = "processing";
    ActivityStatus["PROCESSED"] = "processed";
    ActivityStatus["FAILED"] = "failed";
})(ActivityStatus || (exports.ActivityStatus = ActivityStatus = {}));
var WorkoutType;
(function (WorkoutType) {
    WorkoutType["ENDURANCE"] = "endurance";
    WorkoutType["TEMPO"] = "tempo";
    WorkoutType["INTERVAL"] = "interval";
    WorkoutType["SPRINT"] = "sprint";
    WorkoutType["RECOVERY"] = "recovery";
    WorkoutType["LONG_RIDE"] = "long_ride";
})(WorkoutType || (exports.WorkoutType = WorkoutType = {}));
var IntensityLevel;
(function (IntensityLevel) {
    IntensityLevel["LOW"] = "low";
    IntensityLevel["MODERATE"] = "moderate";
    IntensityLevel["HIGH"] = "high";
    IntensityLevel["MAXIMAL"] = "maximal";
})(IntensityLevel || (exports.IntensityLevel = IntensityLevel = {}));
var ExperienceLevel;
(function (ExperienceLevel) {
    ExperienceLevel["BEGINNER"] = "beginner";
    ExperienceLevel["INTERMEDIATE"] = "intermediate";
    ExperienceLevel["ADVANCED"] = "advanced";
    ExperienceLevel["EXPERT"] = "expert";
})(ExperienceLevel || (exports.ExperienceLevel = ExperienceLevel = {}));
var GoalType;
(function (GoalType) {
    GoalType["FITNESS"] = "fitness";
    GoalType["PERFORMANCE"] = "performance";
    GoalType["WEIGHT_LOSS"] = "weight_loss";
    GoalType["ENDURANCE"] = "endurance";
    GoalType["SPEED"] = "speed";
    GoalType["POWER"] = "power";
})(GoalType || (exports.GoalType = GoalType = {}));
//# sourceMappingURL=index.js.map