export interface User {
  id: number;
  username: string;
  pin: string;
  createdAt: Date;
}

export interface ProgressRecord {
  id: number;
  userId: number;
  trackId: string;
  lessonId: string;
  status: 'started' | 'completed';
  score?: number;
  metadata?: any;
  updatedAt: Date;
}

export interface AnalyticsEvent {
  id: number;
  userId?: number;
  eventType: string;
  timestamp: Date;
  metadata: any;
}

export interface DecisionTreeInput {
  interests: string[];
  previousExperience: boolean;
  timeCommitment: 'low' | 'medium' | 'high';
}

export interface DecisionTreeResult {
  recommendedTrack: string;
  reasoning: string;
}
