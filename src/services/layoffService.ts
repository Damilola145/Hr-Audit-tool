import { GoogleGenAI, Type } from "@google/genai";
import { Candidate, Metric, LayoffRecommendation } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function analyzeLayoffs(
  candidates: Candidate[],
  metrics: Metric[],
  layoffCount: number
): Promise<LayoffRecommendation> {
  const model = "gemini-3.1-pro-preview";

  const prompt = `
    You are an expert HR consultant from Mecer Consulting conducting a workforce reduction audit for Lubell Nigeria Limited.
    Your task is to identify ${layoffCount} candidates for potential layoff based on objective metrics and standard HR practices.
    
    Standard HR practices to consider:
    1. Performance: Low performers are typically prioritized for reduction.
    2. Tenure: "Last In, First Out" (LIFO) is a common practice, but must be balanced with performance.
    3. Skill Criticality: Retain employees with unique or essential skills.
    4. Disciplinary History: Consider any documented issues.

    Metrics used for evaluation:
    ${metrics.map(m => `- ${m.name} (Weight: ${m.weight * 100}%, Type: ${m.type})`).join('\n')}

    Candidates Pool (${candidates.length} total):
    ${candidates.map(c => `
      - ID: ${c.id}, Name: ${c.name}, Role: ${c.role}, Tenure: ${c.tenure}, Scores: ${c.metricValues.map(mv => {
          const m = metrics.find(met => met.id === mv.metricId);
          return `${m?.name}: ${mv.value}`;
        }).join(', ')}
    `).join('\n')}

    Analyze the pool and suggest ${layoffCount} candidates for layoff. 
    Provide a risk score (0-100) for each candidate, where 100 means highest priority for layoff.
    Provide a detailed reasoning for the overall strategy and individual justifications.
  `;

  const response = await ai.models.generateContent({
    model,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          suggestedLayoffIds: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING },
            description: "List of IDs of candidates suggested for layoff" 
          },
          reasoning: { type: Type.STRING, description: "Overall strategy and logic for the selection" },
          riskAssessment: { type: Type.STRING, description: "Assessment of organizational risk for these layoffs" },
          rankings: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                candidateId: { type: Type.STRING },
                riskScore: { type: Type.NUMBER, description: "Priority score for layoff (0-100)" },
                justification: { type: Type.STRING }
              },
              required: ["candidateId", "riskScore", "justification"]
            }
          }
        },
        required: ["suggestedLayoffIds", "reasoning", "riskAssessment", "rankings"]
      }
    }
  });

  const text = response.text;
  if (!text) throw new Error("No response from AI");
  
  return JSON.parse(text) as LayoffRecommendation;
}
