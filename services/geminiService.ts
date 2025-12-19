
import { GoogleGenAI, Type } from "@google/genai";
import { PodcastTurn, Speaker, Voice, Language } from "../types";

const MODEL_TEXT = 'gemini-3-pro-preview';
const MODEL_TTS = 'gemini-2.5-flash-preview-tts';

export interface ScriptResult {
  transcript: PodcastTurn[];
  sources: { title: string; uri: string }[];
}

export class GeminiPodcastService {
  private ai: GoogleGenAI;

  constructor() {
    if (!process.env.API_KEY) {
      throw new Error("API_KEY environment variable is not set.");
    }
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  async getTopicsByGenre(genre: string, language: Language): Promise<string[]> {
    const langLabel = language === Language.JAPANESE ? "Japanese" : "English";
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
    try {
      return JSON.parse(response.text || "[]");
    } catch (e) {
      return [];
    }
  }

  async generateOutline(topic: string, language: Language): Promise<string[]> {
    const langLabel = language === Language.JAPANESE ? "Japanese" : "English";
    const response = await this.ai.models.generateContent({
      model: MODEL_TEXT,
      contents: `You are a podcast content strategist. For the topic "${topic}", create a comprehensive outline for a deep-dive podcast episode in ${langLabel}. List 10 key points. Format as JSON array of strings.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });
    try {
      return JSON.parse(response.text || "[]");
    } catch (e) {
      return ["Error generating outline."];
    }
  }

  async extendOutline(topic: string, currentOutline: string[], language: Language): Promise<string[]> {
    const langLabel = language === Language.JAPANESE ? "Japanese" : "English";
    const response = await this.ai.models.generateContent({
      model: MODEL_TEXT,
      contents: `You are a podcast content strategist. For the topic "${topic}", the current outline is: ${JSON.stringify(currentOutline)}. 
      Add 5 more unique, engaging, and different points to this podcast outline that haven't been mentioned yet. 
      Language: ${langLabel}. Format as JSON array of strings.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });
    try {
      return JSON.parse(response.text || "[]");
    } catch (e) {
      return [];
    }
  }

  async generateScript(topic: string, outline: string[], language: Language): Promise<ScriptResult> {
    const langLabel = language === Language.JAPANESE ? "Japanese" : "English";
    
    const personaInstr = `
    Roles:
    - Joe (The Curious Listener): Enthusiastic, asks "Why?" and "How?", interjects frequently to break up long monologues. He provides "Aizuchi" (back-channeling).
    - Jane (The Expert): Explains clearly, uses analogies, and loves correcting common myths.

    Rules for Script Quality:
    1. TARGET LENGTH: Generate an extremely detailed and long script. Each outline point should be discussed for multiple turns.
    2. INTERACTIVITY: Jane must not speak for more than 3 sentences without Joe interjecting (e.g., "Wait, so...", "I see!", "Really?").
    3. DEFINITIONS: Jane must define any jargon, acronyms, or complex terms immediately.
    4. MYTH BUSTING: For each point, Jane should mention a "Common Misconception" or "Mistake people often make."
    5. HUMOR: Include light-hearted banter and reactions.
    `;

    const extraInstr = language === Language.JAPANESE 
      ? `【最重要】日本語の読み間違いを完全に防ぐため、台本内の【全ての漢字】の直後に（）で読みがなを振ってください。例：台本（だいほん）、深掘（ふかぼ）り、知識（ちしき）。ひらがなやカタカナも混ぜて読みやすくしてください。` 
      : "";

    const response = await this.ai.models.generateContent({
      model: MODEL_TEXT,
      contents: `Expert podcast producer. Topic: "${topic}". Language: ${langLabel}. Outline: ${outline.join(', ')}. ${personaInstr} ${extraInstr} Generate a comprehensive 15-minute dialogue equivalent. JSON output: { "transcript": [{ "speaker": "Joe"|"Jane", "text": "..." }] }`,
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
      console.error("Failed to parse script", e);
    }

    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks
      ?.map((chunk: any) => ({
        title: chunk.web?.title || "Source",
        uri: chunk.web?.uri || ""
      }))
      .filter((s: any) => s.uri) || [];

    return { transcript, sources };
  }

  async generateAudioInChunks(
    transcript: PodcastTurn[], 
    onProgress?: (progress: number) => void
  ): Promise<string[]> {
    const chunkSize = 5;
    const chunks: PodcastTurn[][] = [];
    for (let i = 0; i < transcript.length; i += chunkSize) {
      chunks.push(transcript.slice(i, i + chunkSize));
    }

    const audioBase64Strings: string[] = [];
    for (let i = 0; i < chunks.length; i++) {
      if (onProgress) onProgress((i / chunks.length) * 100);
      const segment = chunks[i];
      const promptText = segment.map(turn => `${turn.speaker}: ${turn.text}`).join('\n');
      const fullPrompt = `TTS conversation:\n${promptText}`;

      const response = await this.ai.models.generateContent({
        model: MODEL_TTS,
        contents: [{ parts: [{ text: fullPrompt }] }],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            multiSpeakerVoiceConfig: {
              speakerVoiceConfigs: [
                {
                  speaker: Speaker.JOE,
                  voiceConfig: { prebuiltVoiceConfig: { voiceName: Voice.PUCK } } // Joe = Puck
                },
                {
                  speaker: Speaker.JANE,
                  voiceConfig: { prebuiltVoiceConfig: { voiceName: Voice.KORE } } // Jane = Kore
                }
              ]
            }
          }
        }
      });
      const data = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (data) audioBase64Strings.push(data);
    }
    if (onProgress) onProgress(100);
    return audioBase64Strings;
  }
}
