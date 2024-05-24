import { VertexAI } from '@google-cloud/vertexai';
import { projectId } from '../firebase.server';

export const generateContent = async ({
  prompt,
  temperature,
  topP,
  topK,
  model = 'gemini-1.0-pro-002',
}: {
  prompt: string;
  temperature?: number;
  topP?: number;
  topK?: number;
  model?: string;
}) => {
  if (!projectId) {
    return null;
  }
  const vertexAI = new VertexAI({ project: projectId, location: 'us-west1' });
  const modelInstance = vertexAI.getGenerativeModel({
    model,
    generationConfig: {
      ...(temperature && { temperature }),
      ...(topP && { top_p: topP }),
      ...(topK && { top_k: topK }),
    },
  });
  const result = await modelInstance.generateContent(prompt);
  // result?.response.candidates?.forEach(candidate => delete candidate.safetyRatings);
  return result;
};
