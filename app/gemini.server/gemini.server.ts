import { VertexAI } from '@google-cloud/vertexai';
import { projectId } from '../firebase.server';

export const generateContent = async ({
  prompt,
  temperature,
  topP,
  topK,
}: {
  prompt: string;
  temperature?: number;
  topP?: number;
  topK?: number;
}) => {
  if (!projectId) {
    return null;
  }
  const vertexAI = new VertexAI({ project: projectId, location: 'us-west1' });
  const model = vertexAI.getGenerativeModel({
    model: 'gemini-1.0-pro',
    generation_config: {
      ...(temperature && { temperature }),
      ...(topP && { top_p: topP }),
      ...(topK && { top_k: topK }),
    },
  });
  const result = await model.generateContent(prompt);
  result?.response.candidates.forEach(candidate => delete candidate.safetyRatings);
  return result;
};
