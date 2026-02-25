export enum MetricType {
  NUMBER = 'NUMBER',
  PERCENTAGE = 'PERCENTAGE',
  RATING = 'RATING',
}

export interface Metric {
  id: string;
  name: string;
  type: MetricType;
  weight: number; // 0 to 1
}

export interface CandidateMetricValue {
  metricId: string;
  value: number;
}

export interface Candidate {
  id: string;
  name: string;
  role: string;
  department: string;
  tenure: string;
  metricValues: CandidateMetricValue[];
  notes?: string;
}

export interface PromotionRecommendation {
  winnerId: string;
  reasoning: string;
  comparisonSummary: string;
  rankings: {
    candidateId: string;
    score: number;
    justification: string;
  }[];
}

export interface LayoffRecommendation {
  suggestedLayoffIds: string[];
  reasoning: string;
  riskAssessment: string;
  rankings: {
    candidateId: string;
    riskScore: number; // 0-100, higher means more likely to be laid off
    justification: string;
  }[];
}
