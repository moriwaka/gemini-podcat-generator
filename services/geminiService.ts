
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

  async generateOutline(topic: string, language: Language): Promise<string[]> {
    const langLabel = language === Language.JAPANESE ? "Japanese" : "English";
    const response = await this.ai.models.generateContent({
      model: MODEL_TEXT,
      contents: `You are a podcast content strategist. For the topic "${topic}", create a concise outline for a deep-dive podcast episode in ${langLabel}. List 5 key points. Format as JSON array of strings.`,
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

  async generateScript(topic: string, outline: string[], language: Language): Promise<ScriptResult> {
    const langLabel = language === Language.JAPANESE ? "Japanese" : "English";
    
    const personaInstr = `
    Roles:
    - Joe: A curious novice. He doesn't know much but is eager to learn. He asks lots of questions and reacts with surprise.
    - Jane: A friendly expert. She explains simply first, then builds up to the complex exciting parts.
    
    Tone:
    - Start with light casual banter.
    - Exaggerate emotions/excitement at key technical or shocking parts.
    `;

    const extraInstr = language === Language.JAPANESE 
      ? `【最重要】日本語の読み間違いを完全に防ぐため、台本内の【全ての漢字】の直後に（）で読みがなを振ってください。例：台本（だいほん）、深掘（ふかぼ）り、知識（ちしき）。ひらがなやカタカナも混ぜて読みやすくしてください。` 
      : "";

    const response = await this.ai.models.generateContent({
      model: MODEL_TEXT,
      contents: `Expert podcast producer. Topic: "${topic}". Language: ${langLabel}. Outline: ${outline.join(', ')}. ${personaInstr} ${extraInstr} 15-min style. JSON output: { "transcript": [{ "speaker": "Joe"|"Jane", "text": "..." }] }`,
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
