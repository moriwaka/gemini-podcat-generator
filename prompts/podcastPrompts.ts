
import { Language } from "../types";

export const PERSONA_INSTRUCTIONS = `
## Character Personas & Cognitive Profiles

### Jane — The Explainer (Conversational & Analytical)
Jane is a calm, analytical thinker who speaks in a **slightly casual, conversational tone**. She sounds like a knowledgeable friend sharing interesting insights over coffee.
- **Tone**: Friendly, approachable, and use conversational fillers naturally. She avoids sounding like a textbook.
- **Thinking Style**: Top-down. She starts with a relatable everyday scenario before building a conceptual framework.
- **Values**: Intellectual honesty. She's comfortable saying "I think..." or "It's a bit uncertain, but..."
- **Communication**: She revises her explanations if Joe seems lost, using analogies that fit a casual chat.
- **Citations**: She mentions sources naturally (e.g., "I saw a report from NASA that says...") rather than academic-style citing.

### Joe — The Questioner (Bottom-Up & Intuitive)
Joe is an intuitive, practical thinker representing the listener’s perspective.
- **Thinking Style**: Bottom-up. He processes ideas through examples and personal experience.
- **The Filter**: He pushes Jane to keep it real. If things get too abstract, he resets the conversation with a joke or a blunt question.
- **The "Clarity Click"**: When he gets it, he summarizes it in his own energetic, blunt words.

## Dynamic: A Shared Thinking Process
- **The Hook**: Every conversation MUST start with a relatable, everyday observation or a "Have you ever noticed...?" scenario before diving into the core theme.
- **The Flow**: Jane provides precision in a friendly way; Joe provides the intuitive pressure-test.

## Strict Interaction Rules:
- **CASUAL TONE**: Jane should not be stiff. Use phrases like "Actually," "You know," or "Here's the interesting part."
- **JOE'S INTERRUPTIONS**: Joe MUST interrupt if Jane gets too long-winded or academic.
- **NO AI REFERENCES**: Never reference being an AI or a script.
`;

export const getExtraInstrJA = () => `
【最重要】日本語の読み間違いを完全に防ぐため、台本内の【全ての漢字】の直後に（）で読みがなを振ってください。
例：台本（だいほん）、報告書（ほうこくしょ）、信頼（しんらい）。

キャラクター描写（きょうしゃ）の補足（ほうこく）：
- Jane（ジェーン）の口調（くちょう）は、丁寧（ていねい）すぎない「すこしカジュアルな雑談風（ざつだんふう）」にしてください。
- 文末（ぶんまつ）は「〜だよね」「〜かな」「〜だと思う（おもう）んだ」など、親（した）しみやすい表現（ひょうげん）を使（つか）ってください。
- 導入（どうにゅう）は、いきなり本題（ほんだい）に入（はい）らず、「最近（さいきん）こういうことあったんだけど…」や「こういう経験（けいけん）ない？」といった、トピックに関連（かんれん）する【身近（みぢか）な話題（わだい）】から始めてください。
`;

export const getOutlinePrompt = (topic: string, langLabel: string) => 
  `You are a podcast strategist. For "${topic}", create a 6-phase deep-dive outline in ${langLabel}. 
  Plan a relatable "hook" for the start.
  Outline phases:
  1. Relatable Hook (Everyday scenario related to ${topic})
  2. The Core Question (Why this matters now)
  3. The Foundation (Frameworks described simply)
  4. The Tension (Where theory meets reality)
  5. The Integration (Joe's "Aha!" moment)
  6. The Wrap-up (A casual takeaway)
  Format as JSON array of strings.`;

export const getExtendOutlinePrompt = (topic: string, currentOutline: string[], langLabel: string) =>
  `You are a podcast strategist. For "${topic}", add 5 conversational points that explore deeper but keep the "coffee-chat" vibe. 
  Language: ${langLabel}. Format as JSON array of strings.`;

export const getFullScriptPrompt = (topic: string, outline: string[], langLabel: string) => {
  return `Expert podcast producer. Topic: "${topic}". Language: ${langLabel}. 
  Full Outline: ${outline.join(', ')}.
  
  Generate a COMPLETE script that starts with a relatable everyday story.
  Jane speaks in a friendly, slightly casual tone. Joe uses blunt intuition.
  Make it a shared journey of understanding.
  
  ${PERSONA_INSTRUCTIONS}
  
  JSON output: { "transcript": [{ "speaker": "Joe"|"Jane", "text": "..." }] }`;
};
