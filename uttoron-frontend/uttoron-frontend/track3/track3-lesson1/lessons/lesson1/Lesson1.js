// Lesson 1: Finding & Identifying Errors
// Orchestrates all 6 modules

import { Module1 } from './module1.js';
import { Module2 } from './module2.js';
import { Module3 } from './module3.js';
import { Module4 } from './module4.js';
import { Module5 } from './module5.js';
import { Module6 } from './module6.js';

class Lesson1 {
    constructor(errorInjectionEngine, sampleRecords) {
        this.title = 'Lesson 1: Finding & Identifying Errors';
        this.description = 'Learn to spot and categorize data quality issues in real records';
        this.errorInjectionEngine = errorInjectionEngine;
        this.sampleRecords = sampleRecords;

        this.modules = [
            new Module1(),
            new Module2(errorInjectionEngine, sampleRecords),
            new Module3(errorInjectionEngine, sampleRecords),
            new Module4(errorInjectionEngine, sampleRecords),
            new Module5(),
            new Module6(errorInjectionEngine, sampleRecords)
        ];

        this.currentModuleIndex = 0;
        this.completed = false;
        this.score = 0;
    }

    getCurrentModule() {
        return this.modules[this.currentModuleIndex];
    }

    getModuleByIndex(index) {
        if (index < 0 || index >= this.modules.length) return null;
        return this.modules[index];
    }

    getModuleByNumber(moduleNumber) {
        return this.getModuleByIndex(moduleNumber - 1);
    }

    switchToModule(moduleNumber) {
        const index = moduleNumber - 1;
        if (index < 0 || index >= this.modules.length) return false;
        this.currentModuleIndex = index;
        return true;
    }

    nextModule() {
        if (this.currentModuleIndex < this.modules.length - 1) {
            this.currentModuleIndex++;
            return true;
        }
        return false;
    }

    previousModule() {
        if (this.currentModuleIndex > 0) {
            this.currentModuleIndex--;
            return true;
        }
        return false;
    }

    markModuleComplete(moduleNumber) {
        const module = this.getModuleByNumber(moduleNumber);
        if (module) {
            module.markComplete();
        }
    }

    getProgress() {
        const completedCount = this.modules.filter(m => m.isComplete()).length;
        return {
            currentModule: this.currentModuleIndex + 1,
            totalModules: this.modules.length,
            completedModules: completedCount,
            percentageComplete: Math.round((completedCount / this.modules.length) * 100)
        };
    }

    getAllModuleStats() {
        return this.modules.map((module, index) => ({
            moduleNumber: index + 1,
            title: module.title,
            completed: module.isComplete(),
            stats: module.getStats ? module.getStats() : null
        }));
    }

    completeLessonWithScore(totalScore) {
        this.completed = true;
        this.score = totalScore;
    }

    isLessonComplete() {
        return this.completed;
    }

    getLessonStats() {
        return {
            title: this.title,
            completed: this.completed,
            score: this.score,
            progress: this.getProgress(),
            moduleStats: this.getAllModuleStats()
        };
    }

    reset() {
        this.modules.forEach(module => {
            if (module.reset) {
                module.reset();
            }
        });
        this.currentModuleIndex = 0;
        this.completed = false;
        this.score = 0;
    }
}

export { Lesson1 };
