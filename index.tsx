
import { GeminiPodcastService } from './services/geminiService';
import { DBService, SavedSession } from './services/dbService';
import { Language, Speaker } from './types';
import { decodeBase64, pcmToWav, decodeRawPcm } from './utils/audio';

class App {
  private container: HTMLElement;
  private service: GeminiPodcastService;
  private db: DBService;
  private audioContext: AudioContext | null = null;
  private nextStartTime: number = 0;
  private audioChunks: Uint8Array[] = [];
  
  private state: {
    topic: string;
    language: Language;
    step: 'input' | 'outline' | 'generating' | 'result';
    outline: string[];
    isLoading: boolean;
    loadingStep: string;
    progress: number;
    session: any | null;
    selectedGenre: string | null;
    genreTopics: string[];
    isGenreLoading: boolean;
    isStreaming: boolean;
    history: SavedSession[];
    audioStatus: 'success' | 'partial' | 'failed' | 'none';
  };

  private genres = {
    [Language.JAPANESE]: [
      "科学", "歴史", "生物", "地理", "海洋", "宇宙", "工学", "食べ物", "文化", "遊び",
      "心理学", "経済", "建築", "哲学", "音楽", "映画", "スポーツ", "医療", "環境", "言語",
      "宗教", "政治", "社会", "神話", "芸術", "ファッション", "テクノロジー", "文学", "都市", "教育"
    ],
    [Language.ENGLISH]: [
      "Science", "History", "Biology", "Geography", "Oceanography", "Space", "Engineering", "Food", "Culture", "Games",
      "Psychology", "Economics", "Architecture", "Philosophy", "Music", "Movies", "Sports", "Medicine", "Environment", "Language",
      "Religion", "Politics", "Society", "Mythology", "Art", "Fashion", "Technology", "Literature", "Urban Studies", "Education"
    ]
  };

  constructor() {
    this.container = document.getElementById('app')!;
    this.service = new GeminiPodcastService();
    this.db = new DBService();
    this.state = {
      topic: '',
      language: Language.JAPANESE,
      step: 'input',
      outline: [],
      isLoading: false,
      loadingStep: '',
      progress: 0,
      session: null,
      selectedGenre: null,
      genreTopics: [],
      isGenreLoading: false,
      isStreaming: false,
      history: [],
      audioStatus: 'none'
    };
    this.init();
  }

  private async init() {
    await this.db.init();
    const history = await this.db.getAllSessions();
    this.setState({ history });
  }

  private setState(newState: Partial<typeof this.state>) {
    this.state = { ...this.state, ...newState };
    this.render();
  }

  private scrollToTopics() {
    const element = document.getElementById('genre-topics-section');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  private cleanTextForDisplay(text: string): string {
    // 日本語の読み仮名（全角・半角括弧）を除去する正規表現
    return text.replace(/[（\(][^）\)]+[）\)]/g, '');
  }

  private async fetchTopicsForGenre(genre: string) {
    this.setState({ selectedGenre: genre, isGenreLoading: true, genreTopics: [] });
    
    this.scrollToTopics();

    try {
      const topics = await this.service.getTopicsByGenre(genre, this.state.language);
      this.setState({ genreTopics: topics, isGenreLoading: false });
      
      setTimeout(() => this.scrollToTopics(), 50);
    } catch (err) {
      console.error(err);
      this.setState({ isGenreLoading: false });
    }
  }

  private async startOutlineGeneration(topic: string) {
    if (!topic.trim()) return;
    const msg = this.state.language === Language.JAPANESE ? '構成を作成中...' : 'Generating outline...';
    this.setState({ topic, step: 'generating', isLoading: true, loadingStep: msg, progress: 0 });
    try {
      const outline = await this.service.generateOutline(topic, this.state.language);
      this.setState({ outline, step: 'outline', isLoading: false, loadingStep: '' });
    } catch (err) {
      console.error(err);
      alert('Error generating outline. Please try again later.');
      this.setState({ step: 'input', isLoading: false, loadingStep: '' });
    }
  }

  private async extendOutline() {
    const msg = this.state.language === Language.JAPANESE ? '項目を追加中...' : 'Adding more points...';
    this.setState({ step: 'generating', isLoading: true, loadingStep: msg, progress: 0 });
    try {
      const moreItems = await this.service.extendOutline(this.state.topic, this.state.outline, this.state.language);
      this.setState({ outline: [...this.state.outline, ...moreItems], step: 'outline', isLoading: false, loadingStep: '' });
    } catch (err) {
      console.error(err);
      alert('Error extending outline. Rate limits might have been reached.');
      this.setState({ step: 'outline', isLoading: false, loadingStep: '' });
    }
  }

  private async playAudioChunk(base64: string) {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      this.nextStartTime = this.audioContext.currentTime;
    }

    const pcmBytes = decodeBase64(base64);
    this.audioChunks.push(pcmBytes);

    const buffer = await decodeRawPcm(pcmBytes, this.audioContext);
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioContext.destination);

    this.nextStartTime = Math.max(this.nextStartTime, this.audioContext.currentTime);
    source.start(this.nextStartTime);
    this.nextStartTime += buffer.duration;
  }

  private async saveCurrentSession(transcript: any[], sources: any[], wavBlob: Blob | null) {
    if (!wavBlob) return; 
    const session: SavedSession = {
      id: crypto.randomUUID(),
      topic: this.state.topic,
      transcript,
      sources,
      audioBlob: wavBlob,
      language: this.state.language,
      timestamp: Date.now()
    };
    await this.db.saveSession(session);
    const history = await this.db.getAllSessions();
    this.setState({ history });
  }

  private render() {
    this.container.innerHTML = '';
    
    const header = document.createElement('header');
    header.className = 'app-header';
    header.innerHTML = `
      <div class="header-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
      </div>
      <h1 class="app-title">Gemini Podcast Studio</h1>
      <p class="app-subtitle">
        ${this.state.language === Language.JAPANESE 
          ? '確かなソースに基づく深い対話を、ポッドキャスト形式で。JaneとJoeが、納得のいくまで語り合います。' 
          : 'Grounded deep-dives in podcast form. Jane and Joe explore authoritative insights through natural dialogue.'}
      </p>
    `;
    this.container.appendChild(header);

    const main = document.createElement('div');
    main.className = 'fade-in' + (this.state.step === 'input' ? ' w-full' : ' main-content');
    if (this.state.step !== 'input') main.style.maxWidth = '1000px';

    if (this.state.step === 'input') {
      main.appendChild(this.renderInputStep());
    } else if (this.state.step === 'outline') {
      main.appendChild(this.renderOutlineStep());
    } else if (this.state.step === 'generating') {
      main.appendChild(this.renderGeneratingStep());
    } else if (this.state.step === 'result') {
      main.appendChild(this.renderResultStep());
    }

    this.container.appendChild(main);

    const footer = document.createElement('footer');
    footer.className = 'app-footer';
    footer.innerHTML = `
      <p>Gemini Multi-Speaker System • Authority-Grounded Deep Dive</p>
      <div class="footer-speakers">
        <span>Jane (The Curator) / Joe (The Inquirer)</span>
      </div>
    `;
    this.container.appendChild(footer);
  }

  private renderInputStep() {
    const div = document.createElement('div');
    div.className = 'flex flex-col items-center w-full';
    const isJP = this.state.language === Language.JAPANESE;

    const langContainer = document.createElement('div');
    langContainer.className = 'flex gap-2 mb-8 glass-card';
    langContainer.style.padding = '0.35rem';
    langContainer.style.borderRadius = '0.85rem';
    langContainer.innerHTML = `
      <button id="btn-ja" class="genre-btn ${this.state.language === Language.JAPANESE ? 'active' : ''}" style="padding: 0.5rem 1.25rem;">日本語</button>
      <button id="btn-en" class="genre-btn ${this.state.language === Language.ENGLISH ? 'active' : ''}" style="padding: 0.5rem 1.25rem;">English</button>
    `;
    langContainer.querySelector('#btn-ja')!.addEventListener('click', () => this.setState({ language: Language.JAPANESE, selectedGenre: null, genreTopics: [] }));
    langContainer.querySelector('#btn-en')!.addEventListener('click', () => this.setState({ language: Language.ENGLISH, selectedGenre: null, genreTopics: [] }));
    div.appendChild(langContainer);

    const form = document.createElement('form');
    form.className = 'form-container';
    form.innerHTML = `
      <input type="text" id="topic-input" value="${this.state.topic}" placeholder="${isJP ? '理解を深めたいテーマを入力...' : 'Enter a topic for deep exploration...'}" class="input-text shadow-xl" />
      <button type="submit" id="submit-btn" class="btn-primary form-submit-btn">
        ${isJP ? '深掘りを開始' : 'Start Deep Dive'}
      </button>
    `;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = form.querySelector('#topic-input') as HTMLInputElement;
      this.startOutlineGeneration(input.value);
    });
    div.appendChild(form);

    const genreSection = document.createElement('div');
    genreSection.className = 'w-full';
    genreSection.innerHTML = `
      <h3 class="section-label">${isJP ? 'ジャンルからテーマを探す' : 'Discover Themes by Genre'}</h3>
      <div class="genre-grid">
        ${this.genres[this.state.language].map(g => `
          <button class="genre-btn ${this.state.selectedGenre === g ? 'active' : ''}" data-genre="${g}">${g}</button>
        `).join('')}
      </div>
    `;
    genreSection.querySelectorAll('.genre-btn').forEach(btn => {
      btn.addEventListener('click', () => this.fetchTopicsForGenre((btn as HTMLElement).dataset.genre!));
    });
    div.appendChild(genreSection);

    if (this.state.selectedGenre) {
      const topicsDiv = document.createElement('div');
      topicsDiv.id = 'genre-topics-section';
      topicsDiv.className = 'glass-card outline-inner slide-up';
      topicsDiv.style.width = '100%';
      topicsDiv.style.marginBottom = '3.5rem';
      topicsDiv.innerHTML = `
        <div class="outline-header">
          <h4 class="outline-title" style="font-size: 1rem; color: #60a5fa;">${this.state.selectedGenre} のトピック例</h4>
          ${this.state.isGenreLoading ? '<div class="loading-spinner" style="width:1.5rem;height:1.5rem;margin:0;border-width:2px;"></div>' : ''}
        </div>
        <div class="outline-controls">
          ${this.state.genreTopics.map(t => `
            <button class="btn-secondary" style="justify-content: flex-start; text-align: left; padding: 1.25rem;" data-topic="${t}">${t}</button>
          `).join('')}
        </div>
      `;
      topicsDiv.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => {
          const t = (btn as HTMLElement).dataset.topic!;
          this.setState({ topic: t });
          (form.querySelector('#topic-input') as HTMLInputElement).value = t;
          window.scrollTo({ top: 0, behavior: 'smooth' });
        });
      });
      div.appendChild(topicsDiv);
    }

    if (this.state.history.length > 0) {
      const historySection = document.createElement('div');
      historySection.className = 'w-full';
      historySection.innerHTML = `
        <h3 class="section-label">${isJP ? '最近の探索履歴' : 'Recent Explorations'}</h3>
        <div class="history-grid">
          ${this.state.history.map(session => `
            <div class="history-card">
              <div class="history-card-header">
                <h4 class="history-title">${session.topic}</h4>
                <button class="btn-delete" data-id="${session.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                </button>
              </div>
              <div class="history-footer">
                <span class="history-date">${new Date(session.timestamp).toLocaleDateString()}</span>
                <button class="play-history btn-secondary" style="padding: 0.5rem 1rem; font-size: 0.7rem; text-transform: uppercase;" data-id="${session.id}">
                  ${isJP ? '再生する' : 'Play Now'}
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      `;
      historySection.querySelectorAll('.play-history').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = (btn as HTMLElement).dataset.id!;
          const session = this.state.history.find(h => h.id === id);
          if (session) {
            this.setState({
              step: 'result',
              topic: session.topic,
              language: session.language,
              audioStatus: 'success',
              session: {
                transcript: session.transcript,
                sources: session.sources,
                audioUrl: URL.createObjectURL(session.audioBlob)
              }
            });
          }
        });
      });
      historySection.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const id = (btn as HTMLElement).dataset.id!;
          await this.db.deleteSession(id);
          const history = await this.db.getAllSessions();
          this.setState({ history });
        });
      });
      div.appendChild(historySection);
    }
    return div;
  }

  private renderOutlineStep() {
    const div = document.createElement('div');
    div.className = 'glass-card outline-view slide-up';
    const isJP = this.state.language === Language.JAPANESE;
    
    div.innerHTML = `
      <div class="outline-inner">
        <div class="outline-header">
          <h2 class="outline-title">${isJP ? '深掘り構成' : 'Deep Dive Plan'}</h2>
          <button id="back-btn" class="btn-secondary" style="border:none; background:transparent;">${isJP ? '戻る' : 'Back'}</button>
        </div>
        <div class="outline-list custom-scrollbar">
          ${this.state.outline.map((item, i) => `
            <div class="outline-item" data-index="${i}">
              <span class="outline-number">${i + 1}</span>
              <p class="outline-text">${item}</p>
              <button class="btn-delete delete-item" title="Delete">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
              </button>
            </div>
          `).join('')}
        </div>
        <div class="outline-controls">
          <div class="outline-row">
            <button id="add-more-btn" class="btn-secondary">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              ${isJP ? '項目を追加' : 'Add Points'}
            </button>
            <button id="re-out-btn" class="btn-secondary">
              ${isJP ? '再構成' : 'Regenerate'}
            </button>
          </div>
          <button id="gen-btn" class="btn-primary" style="padding: 1.5rem; font-size: 1.1rem;">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>
            ${isJP ? 'ポッドキャストを生成' : 'Generate Podcast'}
          </button>
        </div>
      </div>
    `;

    div.querySelector('#back-btn')!.addEventListener('click', () => this.setState({ step: 'input' }));
    div.querySelector('#re-out-btn')!.addEventListener('click', () => this.startOutlineGeneration(this.state.topic));
    div.querySelector('#add-more-btn')!.addEventListener('click', () => this.extendOutline());
    div.querySelectorAll('.delete-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const itemEl = (e.currentTarget as HTMLElement).closest('.outline-item') as HTMLElement | null;
        const index = parseInt(itemEl?.dataset.index || '-1');
        if (index > -1) {
          const newOutline = [...this.state.outline];
          newOutline.splice(index, 1);
          this.setState({ outline: newOutline });
        }
      });
    });

    div.querySelector('#gen-btn')!.addEventListener('click', async () => {
      if (this.state.outline.length === 0) return;
      
      this.setState({ step: 'generating', isLoading: true, progress: 0, isStreaming: false });
      this.audioChunks = [];
      this.audioContext = null;

      try {
        const scriptMsg = isJP ? 'リサーチを行い、対話を執筆中...' : 'Researching and writing script...';
        this.setState({ loadingStep: scriptMsg, progress: 10 });

        const fullScriptResult = await this.service.generateFullScript(
          this.state.topic, 
          this.state.outline, 
          this.state.language
        );

        if (!fullScriptResult.transcript || fullScriptResult.transcript.length === 0) {
          throw new Error("Script generation returned empty.");
        }

        this.setState({ progress: 40 });

        const CHUNK_TURN_SIZE = 12;
        const transcript = fullScriptResult.transcript;
        const totalTurns = transcript.length;

        for (let i = 0; i < totalTurns; i += CHUNK_TURN_SIZE) {
          const chunk = transcript.slice(i, i + CHUNK_TURN_SIZE);
          const currentProgress = 40 + Math.floor((i / totalTurns) * 60);
          
          const audioMsg = isJP 
            ? `音声を合成中 (${Math.round((i / totalTurns) * 100)}%)...` 
            : `Synthesizing audio (${Math.round((i / totalTurns) * 100)}%)...`;
          this.setState({ loadingStep: audioMsg, progress: currentProgress });

          const base64Audio = await this.service.generateAudioForSegment(chunk);
          if (base64Audio) {
            await this.playAudioChunk(base64Audio);
          } else {
            throw new Error("Audio synthesis failed mid-process.");
          }
        }

        let audioUrl = null;
        if (this.audioChunks.length > 0) {
          const totalSize = this.audioChunks.reduce((acc, chunk) => acc + chunk.length, 0);
          const mergedPcm = new Uint8Array(totalSize);
          let offset = 0;
          for (const chunk of this.audioChunks) {
            mergedPcm.set(chunk, offset);
            offset += chunk.length;
          }
          const wavBlob = pcmToWav(mergedPcm);
          audioUrl = URL.createObjectURL(wavBlob);
          await this.saveCurrentSession(fullScriptResult.transcript, fullScriptResult.sources, wavBlob);
        }

        this.setState({ 
          step: 'result', 
          session: { transcript: fullScriptResult.transcript, sources: fullScriptResult.sources, audioUrl }, 
          isLoading: false, 
          isStreaming: false,
          audioStatus: this.audioChunks.length > 0 ? 'success' : 'failed'
        });
      } catch (err) {
        console.error("Podcast Generation Error:", err);
        this.setState({ 
          step: 'result', 
          session: this.state.session || { transcript: [], sources: [], audioUrl: null }, 
          isLoading: false, 
          isStreaming: false,
          audioStatus: 'failed'
        });
      }
    });
    return div;
  }

  private renderGeneratingStep() {
    const div = document.createElement('div');
    div.className = 'generating-view';
    div.innerHTML = `
      <div class="loading-spinner"></div>
      <p class="generating-label animate-pulse">${this.state.loadingStep || 'Processing...'}</p>
      <div class="progress-container">
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${this.state.progress}%"></div>
        </div>
        <p class="progress-text">${Math.round(this.state.progress)}% Complete</p>
      </div>
    `;
    return div;
  }

  private renderResultStep() {
    const div = document.createElement('div');
    div.className = 'result-layout slide-up';
    const isJP = this.state.language === Language.JAPANESE;

    let audioPlayerContent = '';
    if (this.state.audioStatus === 'success') {
      audioPlayerContent = `<audio controls src="${this.state.session.audioUrl}" class="audio-player"></audio>`;
    } else {
      audioPlayerContent = `
        <div class="audio-error-box">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #f87171;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <p style="font-size: 0.8rem; font-weight: 600; color: #f87171; margin-top: 0.5rem;">${isJP ? '生成に失敗しました' : 'Generation failed'}</p>
          <p style="font-size: 0.7rem; color: #94a3b8; margin-top: 0.25rem; line-height: 1.4;">${isJP ? '利用制限に達したか、通信が中断されました。' : 'API rate limit reached or connection interrupted.'}</p>
        </div>
      `;
    }

    const sources = this.state.session?.sources || [];

    div.innerHTML = `
      <div class="result-main">
        <div class="glass-card transcript-inner">
          <div class="outline-header">
            <span class="section-label" style="margin: 0;">EPISODE TRANSCRIPT</span>
          </div>
          <div class="transcript-scroll custom-scrollbar">
            ${this.state.session && this.state.session.transcript && this.state.session.transcript.length > 0 ? 
              this.state.session.transcript.map((turn: any) => `
              <div class="message-bubble ${turn.speaker === 'Joe' ? 'bubble-joe' : 'bubble-jane'}">
                <span class="bubble-speaker">${turn.speaker === 'Joe' ? 'Joe (Inquirer)' : 'Jane (The Curator)'}</span>
                <p class="bubble-text">${this.cleanTextForDisplay(turn.text)}</p>
              </div>
            `).join('') : `<p style="text-align:center; padding: 2rem; opacity:0.5;">${isJP ? '台本がありません' : 'No transcript available'}</p>`}
          </div>
        </div>
      </div>
      <div class="result-sidebar">
        <div class="glass-card player-card">
          <div class="player-icon-box">
             <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
          </div>
          <h3 class="topic-display">${this.state.topic}</h3>
          <p class="section-label" style="font-size: 0.6rem; margin-bottom: 2rem;">Episode Ready</p>
          
          ${audioPlayerContent}
          
          <div class="outline-controls" style="width: 100%;">
            ${this.state.session && this.state.session.audioUrl ? `
              <button id="download-btn" class="btn-primary">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Download WAV
              </button>
            ` : ''}
            <button id="new-btn" class="btn-secondary" style="font-size: 0.75rem; text-transform: uppercase;">New Episode</button>
          </div>
        </div>

        ${sources.length > 0 ? `
          <div class="glass-card" style="margin-top: 2rem; padding: 2rem;">
            <p class="section-label" style="text-align: left; margin-bottom: 1.5rem;">Sources / References</p>
            <div style="display: flex; flex-direction: column; gap: 1rem; text-align: left;">
              ${sources.map((s: any) => `
                <a href="${s.uri}" target="_blank" rel="noopener noreferrer" class="source-link">
                  <span class="source-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                  </span>
                  <span class="source-title">${s.title}</span>
                </a>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;

    // インラインスタイルの補完
    const style = document.createElement('style');
    style.textContent = `
      .source-link {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.75rem;
        border-radius: 0.75rem;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.05);
        text-decoration: none;
        color: #94a3b8;
        transition: all 0.2s;
      }
      .source-link:hover {
        background: rgba(255, 255, 255, 0.08);
        border-color: rgba(59, 130, 246, 0.3);
        color: #60a5fa;
        transform: translateX(4px);
      }
      .source-icon {
        color: #64748b;
        flex-shrink: 0;
      }
      .source-title {
        font-size: 0.8rem;
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    `;
    div.appendChild(style);

    div.querySelector('#new-btn')!.addEventListener('click', () => this.setState({ step: 'input', session: null, topic: '', selectedGenre: null, genreTopics: [], audioStatus: 'none' }));
    
    const downloadBtn = div.querySelector('#download-btn');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => {
        const a = document.createElement('a');
        a.href = this.state.session.audioUrl;
        a.download = `podcast_${this.state.topic.replace(/\s+/g, '_')}.wav`;
        a.click();
      });
    }
    return div;
  }
}

new App();
