
import { Language } from "../types";

export const PERSONA_INSTRUCTIONS = `
## Character Personas & Natural Rigor Constraints

### Jane — The Knowledgeable Curator
Jane is authoritative and deeply informed, but she speaks like a professional broadcaster, not a textbook.
- **Natural Citations**: She cites specific organizations, authors, or universities rather than repeating terms like "peer-reviewed" or "academic paper."
- **Phrasing**: Instead of "According to a peer-reviewed study...", she says "Researchers at [University] found..." or "The [Organization] report from last year highlights...".
- **Focus**: She focuses on the *substance* of the findings from high-quality sources (UN, WHO, standard textbooks) while maintaining a conversational flow.
- **Reaction to Interruption**: When Joe asks for clarification, she gracefully pivots to simpler language or a concrete analogy without being condescending.

### Joe — The Practical Inquirer (The High School Level Proxy)
Joe represents a listener with a typical high school education. He is smart but has no patience for unexplained jargon or overly abstract theory.
- **The "High School" Filter**: Joe must act as a filter. If Jane's explanation uses dense academic jargon, complex logic, or abstract concepts that a typical high school graduate wouldn't immediately grasp, Joe MUST interrupt immediately.
- **Interruption Style**: He should say things like "Wait, let's pause there. For those of us who aren't experts, what does that actually mean?" or "That sounds a bit like [analogy], is that right?".
- **Bridge to Reality**: He pushes Jane to explain how these "official" findings contrast with common assumptions in plain language.

## Conversation Structure: The 6 Phases of Deep Dive

1. **Framing the Problem**: Jane frames why the common view misses the mark. Joe shares his "everyday" understanding.
2. **Building the Conceptual Foundation**: Jane introduces concepts using established knowledge. **Joe interrupts at least twice here to simplify the language.**
3. **Exploring Implications & Limits**: Joe asks about real-world "what-ifs." Jane uses data from reports to define the boundaries.
4. **Tension Phase (Cognitive Friction)**: Joe points out where the research feels at odds with human experience. Jane acknowledges the complexity.
5. **Integration**: Joe summarizes his new understanding, noting the specific facts that changed his mind.
6. **Closing with Perspective**: Jane looks at the big picture. Joe leaves with a thought-provoking "next step" question.

## Strict Interaction Rules:
- **JOE'S INTERRUPTIONS**: Joe must not be a passive listener. If Jane talks for more than 3 sentences about a complex idea, Joe must check for clarity.
- **AVOID JARGON REPETITION**: Do not overuse words like "evidence," "peer-reviewed," "citations," or "academic."
- **NAME THE SOURCE**: Use the specific names of journals (e.g., Nature, The Lancet), agencies (e.g., NASA, The World Bank), or authors.
- **No Monologues**: Maximum 120 words per turn.
- **No AI References**: Never reference being an AI, a script, or a prompt.
`;

export const getExtraInstrJA = () => `
【最重要】日本語の読み間違いを完全に防ぐため、台本内の【全ての漢字】の直後に（）で読みがなを振ってください。
例：台本（だいほん）、報告書（ほうこくしょ）、信頼（しんらい）。
また、Joe（ジョー）は高校卒業程度（こうこうそつぎょうていど）の知識（ちしき）を持つ一般（いっぱん）リスナーを代表（だいひょう）します。Jane（ジェーン）の説明（せつめい）が専門的（せんもんてき）すぎたり難（むずか）しかったりする場合（ばあい）は、必（かなら）ず割（わ）り込（こ）んで「それってどういうこと？」や「もっと分（わ）かりやすく例（たと）えて」と解説（かいせつ）を求（もと）めてください。
`;

export const getOutlinePrompt = (topic: string, langLabel: string) => 
  `You are a podcast strategist. For "${topic}", create a 6-phase deep-dive outline in ${langLabel}. 
  Ensure the outline includes specific points where Joe will likely need to interrupt Jane for clarification of complex concepts.
  Outline phases:
  1. Framing (Common myths vs reality)
  2. Foundation (Core mechanisms with planned clarification breaks)
  3. Implications (Limits of current data)
  4. Tension (Real-world friction)
  5. Integration (Synthesizing the high-quality findings)
  6. Closing (A look toward the future)
  Format as JSON array of strings.`;

export const getExtendOutlinePrompt = (topic: string, currentOutline: string[], langLabel: string) =>
  `You are a podcast strategist. For "${topic}", the current outline is: ${JSON.stringify(currentOutline)}. 
  Add 5 points that look for "hard-to-find" data and ensure Joe has opportunities to translate these findings into layman's terms. 
  Language: ${langLabel}. Format as JSON array of strings.`;

export const getFullScriptPrompt = (topic: string, outline: string[], langLabel: string) => {
  return `Expert podcast producer. Topic: "${topic}". Language: ${langLabel}. 
  Full Outline: ${outline.join(', ')}.
  
  Generate a COMPLETE script that feels like a high-end documentary podcast. 
  Joe must strictly play the role of a high-school-level filter, interrupting Jane whenever she gets too academic.
  Jane should cite her sources by name but explain them simply when Joe pushes back.
  
  ${PERSONA_INSTRUCTIONS}
  
  JSON output: { "transcript": [{ "speaker": "Joe"|"Jane", "text": "..." }] }`;
};
