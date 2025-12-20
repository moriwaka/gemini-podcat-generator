
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { PodcastTurn, Speaker, Voice, Language } from "../types";
import { 
  getOutlinePrompt, 
  getExtendOutlinePrompt, 
  getFullScriptPrompt, 
  getExtraInstrJA 
} from "../prompts/podcastPrompts";

const MODEL_TEXT = 'gemini-3-flash-preview';
const MODEL_TTS = 'gemini-2.5-flash-preview-tts';

export interface ScriptResult {
  transcript: PodcastTurn[];
  sources: { title: string; uri: string }[];
}

export interface AudioGenerationResult {
  success: boolean;
  status: 'success' | 'partial' | 'failed';
  error?: string;
}

export class GeminiPodcastService {
  private ai: GoogleGenAI;

  constructor() {
    if (!process.env.API_KEY) {
      throw new Error("API_KEY environment variable is not set.");
    }
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  private async callWithRetry<T>(fn: () => Promise<T>, retries = 2, delay = 2000): Promise<T> {
    try {
      return await fn();
    } catch (error: any) {
      if (retries > 0 && (error.message?.includes('429') || error.status === 429)) {
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.callWithRetry(fn, retries - 1, delay * 2);
      }
      throw error;
    }
  }

  async getTopicsByGenre(genre: string, language: Language): Promise<string[]> {
    const langLabel = language === Language.JAPANESE ? "Japanese" : "English";
    return this.callWithRetry(async () => {
      const response = await this.ai.models.generateContent({
        model: MODEL_TEXT,
        contents: `You are a podcast producer. For the genre "${genre}", suggest 5 specific and highly engaging podcast episode topics in ${langLabel}. Format as JSON array of strings.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        }
      });
      return JSON.parse(response.text || "[]");
    });
  }

  async generateOutline(topic: string, language: Language): Promise<string[]> {
    const langLabel = language === Language.JAPANESE ? "Japanese" : "English";
    return this.callWithRetry(async () => {
      const response = await this.ai.models.generateContent({
        model: MODEL_TEXT,
        contents: getOutlinePrompt(topic, langLabel),
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        }
      });
      return JSON.parse(response.text || "[]");
    });
  }

  async extendOutline(topic: string, currentOutline: string[], language: Language): Promise<string[]> {
    const langLabel = language === Language.JAPANESE ? "Japanese" : "English";
    return this.callWithRetry(async () => {
      const response = await this.ai.models.generateContent({
        model: MODEL_TEXT,
        contents: getExtendOutlinePrompt(topic, currentOutline, langLabel),
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        }
      });
      return JSON.parse(response.text || "[]");
    });
  }

  async generateFullScript(
    topic: string, 
    outline: string[], 
    language: Language
  ): Promise<ScriptResult> {
    const langLabel = language === Language.JAPANESE ? "Japanese" : "English";
    const extraInstr = language === Language.JAPANESE ? getExtraInstrJA() : "";

    return this.callWithRetry(async () => {
      const response = await this.ai.models.generateContent({
        model: MODEL_TEXT,
        contents: getFullScriptPrompt(topic, outline, langLabel) + extraInstr,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              transcript: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    speaker: { type: Type.STRING, enum: [Speaker.JOE, Speaker.JANE] },
                    text: { type: Type.STRING }
                  },
                  required: ["speaker", "text"]
                }
              }
            },
            required: ["transcript"]
          }
        }
      });

      let transcript: PodcastTurn[] = [];
      try {
        const parsed = JSON.parse(response.text || "{}");
        transcript = parsed.transcript || [];
      } catch (e) {
        console.error("Failed to parse full script", e);
      }

      const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks
        ?.map((chunk: any) => ({
          title: chunk.web?.title || "Source",
          uri: chunk.web?.uri || ""
        }))
        .filter((s: any) => s.uri) || [];

      return { transcript, sources };
    });
  }

  async generateAudioForSegment(transcript: PodcastTurn[]): Promise<string | null> {
    if (transcript.length === 0) return null;
    const fullConversation = transcript.map(turn => `${turn.speaker}: ${turn.text}`).join('\n\n');
    const fullPrompt = `Please synthesize this podcast dialogue segment as high-quality audio:\n\n${fullConversation}`;

    try {
      const response = await this.ai.models.generateContent({
        model: MODEL_TTS,
        contents: [{ parts: [{ text: fullPrompt }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            multiSpeakerVoiceConfig: {
              speakerVoiceConfigs: [
                {
                  speaker: Speaker.JOE,
                  voiceConfig: { prebuiltVoiceConfig: { voiceName: Voice.PUCK } }
                },
                {
                  speaker: Speaker.JANE,
                  voiceConfig: { prebuiltVoiceConfig: { voiceName: Voice.KORE } }
                }
              ]
            }
          }
        }
      });

      return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
    } catch (e) {
      console.error("Audio generation for segment failed", e);
      return null;
    }
  }

  /**
   * @deprecated Used in older versions. Prefer segmented audio calls.
   */
  async streamAudioInChunks(
    transcript: PodcastTurn[], 
    onChunk: (base64: string) => void,
    onProgress?: (progress: number) => void
  ): Promise<AudioGenerationResult> {
    const data = await this.generateAudioForSegment(transcript);
    if (data) {
      onChunk(data);
      if (onProgress) onProgress(100);
      return { success: true, status: 'success' };
    }
    return { success: false, status: 'failed' };
  }
}
