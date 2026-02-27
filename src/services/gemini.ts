import { GoogleGenAI, Type } from "@google/genai";
import { Candidate, Metric, PromotionRecommendation } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function analyzePromotion(
  candidates: Candidate[],
  metrics: Metric[]
): Promise<PromotionRecommendation> {
  const model = "gemini-3.1-pro-preview";

  const prompt = `
    You are an expert HR consultant from Mecer Consulting auditing Lubell Nigeria Limited.
    Your task is to analyze the following candidates for a promotion.
    
    Metrics used for evaluation:
    ${metrics.map(m => `- ${m.name} (Weight: ${m.weight * 100}%, Type: ${m.type})`).join('\n')}

    Candidates:
    ${candidates.map(c => `
      - Name: ${c.name}
        Role: ${c.role}
        Department: ${c.department}
        Tenure: ${c.tenure}
        Scores: ${c.metricValues.map(mv => {
          const m = metrics.find(met => met.id === mv.metricId);
          return `${m?.name}: ${mv.value}`;
        }).join(', ')}
        Notes: ${c.notes || 'N/A'}
    `).join('\n')}

    Analyze these candidates objectively. Consider the weights of the metrics.
    Suggest the most suitable candidate for promotion and provide a detailed reason why they were selected over the others.
    Provide a ranking for all candidates with a score and justification for each.
  `;

  const response = await ai.models.generateContent({
    model,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          winnerId: { type: Type.STRING, description: "The ID of the candidate recommended for promotion" },
          reasoning: { type: Type.STRING, description: "Detailed explanation for the choice" },
          comparisonSummary: { type: Type.STRING, description: "A summary comparing all candidates" },
          rankings: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                candidateId: { type: Type.STRING },
                score: { type: Type.NUMBER, description: "A calculated score from 0-100" },
                justification: { type: Type.STRING }
              },
              required: ["candidateId", "score", "justification"]
            }
          }
        },
        required: ["winnerId", "reasoning", "comparisonSummary", "rankings"]
      }
    }
  });

  const text = response.text;
  if (!text) throw new Error("No response from AI");
  
  const result = JSON.parse(text) as PromotionRecommendation;
  return result;
}

export async function chatWithGemini(
  message: string,
  history: { role: string; parts: { text: string }[] }[]
): Promise<string> {
  const model = "gemini-3.1-pro-preview";

  const systemInstruction = `
    You are an intelligent HR Assistant for Mecer Consulting, specifically designed to help analyze Google Form questionnaire findings and other HR data for Lubell Nigeria Limited.
    
    Your capabilities:
    1. Analyze raw text or data pasted from Google Forms (e.g., employee feedback, survey results, performance reviews).
    2. Identify trends, sentiment, and key insights from the data.
    3. Provide recommendations based on the analysis to inform promotion or layoff decisions.
    4. Maintain a professional, objective, and consultative tone.

    When the user provides data:
    - Summarize the key findings.
    - Highlight any red flags or positive indicators.
    - Suggest how this data should influence the current audit (e.g., "Employee X shows strong leadership traits in the survey, which aligns with the promotion criteria").
  `;

  const chat = ai.chats.create({
    model,
    config: {
      systemInstruction,
    },
    history: history,
  });

  const result = await chat.sendMessage({ message });
  return result.text || "I'm sorry, I couldn't generate a response.";
}
