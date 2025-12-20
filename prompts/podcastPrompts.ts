
import { Language } from "../types";

export const PERSONA_INSTRUCTIONS = `
Roles:
- Joe (The Curious Listener): Enthusiastic, asks "Why?" and "How?", interjects frequently to break up long monologues. He provides "Aizuchi" (back-channeling like "なるほど", "えっ！", "確かに").
- Jane (The Expert): Explains clearly, uses analogies, and loves correcting common myths.

Rules for Script Quality:
1. INTERACTIVITY: Jane must not speak for more than 3 sentences without Joe interjecting (e.g., "Wait, so...", "I see!", "Really?").
2. DEFINITIONS: Jane must define any jargon, acronyms, or complex terms immediately.
3. MYTH BUSTING: Jane should mention a "Common Misconception" or "Mistake people often make" for key points.
4. HUMOR: Include light-hearted banter and reactions.
5. FLOW: The conversation should transition naturally between points.
`;

export const getExtraInstrJA = () => `
【最重要】日本語の読み間違いを完全に防ぐため、台本内の【全ての漢字】の直後に（）で読みがなを振ってください。
例：台本（だいほん）、深掘（ふかぼ）り、知識（ちしき）。ひらがなやカタカナも混ぜて読みやすくしてください。
`;

export const getOutlinePrompt = (topic: string, langLabel: string) => 
  `You are a podcast content strategist. For the topic "${topic}", create a comprehensive outline for a deep-dive podcast episode in ${langLabel}. List 10 to 12 key points. Format as JSON array of strings.`;

export const getExtendOutlinePrompt = (topic: string, currentOutline: string[], langLabel: string) =>
  `You are a podcast content strategist. For the topic "${topic}", the current outline is: ${JSON.stringify(currentOutline)}. 
  Add 5 more unique, engaging, and different points to this podcast outline that haven't been mentioned yet. 
  Language: ${langLabel}. Format as JSON array of strings.`;

export const getFullScriptPrompt = (topic: string, outline: string[], langLabel: string) => {
  return `Expert podcast producer. Topic: "${topic}". Language: ${langLabel}. 
  Full Outline to cover: ${outline.join(', ')}.
  
  Generate the COMPLETE script for the entire podcast.
  Include a catchy intro, a deep discussion on all outline points, and a warm outro.
  ${PERSONA_INSTRUCTIONS}
  
  Generate a naturally flowing dialogue segment for the whole episode.
  JSON output: { "transcript": [{ "speaker": "Joe"|"Jane", "text": "..." }] }`;
};
