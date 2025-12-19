
export interface PodcastTurn {
  speaker: string;
  text: string;
}

export interface PodcastSession {
  topic: string;
  transcript: PodcastTurn[];
  audioUrl?: string;
  audioBuffer?: AudioBuffer;
  language: Language;
}

export enum Speaker {
  JOE = 'Joe',
  JANE = 'Jane'
}

export enum Voice {
  KORE = 'Kore',
  PUCK = 'Puck',
  CHARON = 'Charon',
  FENRIR = 'Fenrir',
  ZEPHYR = 'Zephyr'
}

export enum Language {
  JAPANESE = 'ja',
  ENGLISH = 'en'
}
