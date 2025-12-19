
import { GeminiPodcastService } from './services/geminiService';
import { Language, Speaker } from './types';
import { decodeBase64, pcmToWav } from './utils/audio';

class App {
  private container: HTMLElement;
  private service: GeminiPodcastService;
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
      isGenreLoading: false
    };
    this.render();
  }

  private setState(newState: Partial<typeof this.state>) {
    this.state = { ...this.state, ...newState };
    this.render();
  }

  private async fetchTopicsForGenre(genre: string) {
    this.setState({ selectedGenre: genre, isGenreLoading: true, genreTopics: [] });
    try {
      const topics = await this.service.getTopicsByGenre(genre, this.state.language);
      this.setState({ genreTopics: topics, isGenreLoading: false });
    } catch (err) {
      alert("Failed to fetch topics.");
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
      alert('Error generating outline.');
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
      alert('Error extending outline.');
      this.setState({ step: 'outline', isLoading: false, loadingStep: '' });
    }
  }

  private render() {
    this.container.innerHTML = '';
    
    // Header
    const header = document.createElement('header');
    header.className = 'text-center mb-10';
    header.innerHTML = `
      <div class="inline-flex items-center justify-center p-3 rounded-full bg-blue-500/20 text-blue-400 mb-4 border border-blue-500/20 shadow-lg">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
      </div>
      <h1 class="text-4xl md:text-5xl font-extrabold tracking-tight mb-3 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400">
        Gemini Podcast Studio
      </h1>
      <p class="text-slate-400 max-w-xl mx-auto text-sm">
        ${this.state.language === Language.JAPANESE 
          ? 'Joe（聞き手）とJane（解説者）による、深く鋭いポッドキャスト生成ツール。' 
          : 'Detailed podcast discussions between Joe and Jane.'}
      </p>
    `;
    this.container.appendChild(header);

    const main = document.createElement('div');
    main.className = 'w-full max-w-4xl';

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

    // Footer
    const footer = document.createElement('footer');
    footer.className = 'mt-auto pt-20 pb-8 text-slate-600 text-[9px] flex flex-col items-center gap-4 opacity-50 uppercase tracking-[0.4em]';
    footer.innerHTML = `
      <p>Gemini Multi-Speaker System</p>
      <div class="flex gap-12 text-center">
        <span>Joe (Puck) / Jane (Kore)</span>
      </div>
    `;
    this.container.appendChild(footer);
  }

  private renderInputStep() {
    const div = document.createElement('div');
    div.className = 'flex flex-col items-center';
    
    const isJP = this.state.language === Language.JAPANESE;

    // Lang Switcher
    const langDiv = document.createElement('div');
    langDiv.className = 'flex gap-2 justify-center mb-8 bg-white/5 p-1 rounded-xl border border-white/10 w-fit mx-auto';
    langDiv.innerHTML = `
      <button id="btn-ja" class="px-4 py-2 rounded-lg text-xs font-bold transition-all ${this.state.language === Language.JAPANESE ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}">日本語</button>
      <button id="btn-en" class="px-4 py-2 rounded-lg text-xs font-bold transition-all ${this.state.language === Language.ENGLISH ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}">English</button>
    `;
    langDiv.querySelector('#btn-ja')!.addEventListener('click', () => this.setState({ language: Language.JAPANESE, selectedGenre: null, genreTopics: [] }));
    langDiv.querySelector('#btn-en')!.addEventListener('click', () => this.setState({ language: Language.ENGLISH, selectedGenre: null, genreTopics: [] }));
    div.appendChild(langDiv);

    const form = document.createElement('form');
    form.className = 'relative group w-full mb-12';
    form.innerHTML = `
      <input type="text" id="topic-input" value="${this.state.topic}" placeholder="${isJP ? 'トピックを入力またはジャンルから選択...' : 'Enter topic or select genre...'}" class="w-full glass-card rounded-2xl py-6 pl-8 pr-40 focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-lg shadow-xl" />
      <button type="submit" id="submit-btn" class="absolute right-3 top-3 bottom-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold px-8 rounded-xl shadow-lg hover:scale-105 transition-all">
        ${isJP ? '構成を作成' : 'Create Outline'}
      </button>
    `;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = form.querySelector('#topic-input') as HTMLInputElement;
      this.startOutlineGeneration(input.value);
    });
    div.appendChild(form);

    // Genre Selector
    const genreContainer = document.createElement('div');
    genreContainer.className = 'w-full mb-10';
    genreContainer.innerHTML = `
      <h3 class="text-xs font-bold text-slate-500 uppercase tracking-widest mb-6 text-center">
        ${isJP ? 'ジャンルからトピックを探す' : 'Discover Topics by Genre'}
      </h3>
      <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-10 gap-2 mb-8">
        ${this.genres[this.state.language].map(g => `
          <button class="genre-btn px-2 py-3 rounded-lg text-[10px] font-bold border transition-all ${this.state.selectedGenre === g ? 'bg-blue-600 border-blue-500 text-white' : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20 hover:text-white'}" data-genre="${g}">
            ${g}
          </button>
        `).join('')}
      </div>
    `;
    genreContainer.querySelectorAll('.genre-btn').forEach(btn => {
      btn.addEventListener('click', () => this.fetchTopicsForGenre((btn as HTMLElement).dataset.genre!));
    });
    div.appendChild(genreContainer);

    // Dynamic Topic Suggestions
    if (this.state.selectedGenre) {
      const topicsDiv = document.createElement('div');
      topicsDiv.className = 'w-full glass-card rounded-2xl p-6 border border-blue-500/20 animate-in slide-in-from-top-4 duration-500';
      topicsDiv.innerHTML = `
        <div class="flex items-center justify-between mb-4">
          <h4 class="text-sm font-bold text-blue-400 uppercase tracking-widest">
            ${this.state.selectedGenre} のおすすめ
          </h4>
          ${this.state.isGenreLoading ? '<div class="w-4 h-4 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>' : ''}
        </div>
        <div class="space-y-2">
          ${this.state.genreTopics.map(t => `
            <button class="topic-suggestion w-full text-left px-4 py-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-blue-500/30 text-sm text-slate-300 transition-all" data-topic="${t}">
              ${t}
            </button>
          `).join('')}
        </div>
      `;
      topicsDiv.querySelectorAll('.topic-suggestion').forEach(btn => {
        btn.addEventListener('click', () => {
          const t = (btn as HTMLElement).dataset.topic!;
          this.setState({ topic: t });
          (form.querySelector('#topic-input') as HTMLInputElement).value = t;
        });
      });
      div.appendChild(topicsDiv);
    }

    return div;
  }

  private renderOutlineStep() {
    const div = document.createElement('div');
    div.className = 'glass-card rounded-3xl p-8 shadow-2xl border border-white/10 max-h-[80vh] flex flex-col';
    
    const isJP = this.state.language === Language.JAPANESE;
    
    div.innerHTML = `
      <div class="flex items-center justify-between mb-6 border-b border-white/10 pb-4 flex-shrink-0">
        <h2 class="text-xl font-bold text-white">${isJP ? '番組構成案' : 'Proposed Outline'}</h2>
        <button id="back-btn" class="text-xs text-slate-400 hover:text-white">${isJP ? '戻る' : 'Back'}</button>
      </div>
      <div class="overflow-y-auto flex-grow pr-2 custom-scrollbar mb-8">
        <ul id="outline-list" class="space-y-4">
          ${this.state.outline.map((item, i) => `
            <li class="flex items-start gap-4 p-4 rounded-xl bg-white/5 border border-white/5 group relative transition-all hover:bg-white/10" data-index="${i}">
              <span class="text-blue-500 font-bold flex-shrink-0 w-6">${i + 1}.</span>
              <p class="text-slate-200 flex-grow pr-8">${item}</p>
              <button class="delete-item absolute right-4 top-4 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all p-1" title="Delete">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
              </button>
            </li>
          `).join('')}
        </ul>
      </div>
      <div class="flex flex-col gap-4 flex-shrink-0">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button id="add-more-btn" class="py-4 bg-white/5 text-blue-400 font-bold rounded-xl border border-blue-500/20 hover:bg-blue-500/10 transition-all flex items-center justify-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            ${isJP ? '項目を更に追加' : 'Add More Points'}
          </button>
          <button id="re-out-btn" class="py-4 bg-white/5 text-slate-300 font-bold rounded-xl border border-white/10 hover:text-white transition-all">
            ${isJP ? '構成案を再生成' : 'Regenerate Entire Outline'}
          </button>
        </div>
        <button id="gen-btn" class="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold py-5 rounded-xl shadow-lg hover:scale-[1.02] transition-all flex items-center justify-center gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>
          ${isJP ? 'ポッドキャストを生成' : 'Generate Podcast'}
        </button>
      </div>
    `;

    div.querySelector('#back-btn')!.addEventListener('click', () => this.setState({ step: 'input' }));
    div.querySelector('#re-out-btn')!.addEventListener('click', () => {
      this.startOutlineGeneration(this.state.topic);
    });
    div.querySelector('#add-more-btn')!.addEventListener('click', () => {
      this.extendOutline();
    });
    
    div.querySelectorAll('.delete-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const li = (e.currentTarget as HTMLElement).closest('li');
        const index = parseInt(li?.dataset.index || '-1');
        if (index > -1) {
          const newOutline = [...this.state.outline];
          newOutline.splice(index, 1);
          this.setState({ outline: newOutline });
        }
      });
    });

    div.querySelector('#gen-btn')!.addEventListener('click', async () => {
      if (this.state.outline.length === 0) {
        alert(isJP ? '項目を1つ以上追加してください' : 'Please add at least one point');
        return;
      }
      const msg = isJP ? '音声生成中...' : 'Generating audio...';
      this.setState({ step: 'generating', isLoading: true, loadingStep: msg, progress: 0 });
      try {
        const { transcript, sources } = await this.service.generateScript(this.state.topic, this.state.outline, this.state.language);
        const audioChunks = await this.service.generateAudioInChunks(transcript, (p) => this.setState({ progress: p }));
        
        // Merge binary chunks
        const totalSize = audioChunks.reduce((acc, base64) => acc + decodeBase64(base64).length, 0);
        const mergedPcm = new Uint8Array(totalSize);
        let offset = 0;
        for (const base64 of audioChunks) {
          const chunk = decodeBase64(base64);
          mergedPcm.set(chunk, offset);
          offset += chunk.length;
        }

        const wavBlob = pcmToWav(mergedPcm);
        const audioUrl = URL.createObjectURL(wavBlob);

        this.setState({
          step: 'result',
          session: {
            transcript,
            sources,
            audioUrl
          },
          isLoading: false,
          loadingStep: ''
        });
      } catch (err) {
        alert('Generation failed');
        this.setState({ step: 'outline', isLoading: false, loadingStep: '' });
      }
    });
    return div;
  }

  private renderGeneratingStep() {
    const div = document.createElement('div');
    div.className = 'flex flex-col items-center py-20 animate-in fade-in duration-500';
    div.innerHTML = `
      <div class="w-20 h-20 mb-8 relative border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
      <p class="text-xl font-bold text-blue-400 mb-2 animate-pulse">${this.state.loadingStep}</p>
      ${this.state.progress > 0 ? `
        <div class="w-full max-w-md bg-white/5 rounded-full h-2 overflow-hidden border border-white/10 mt-4">
          <div class="bg-gradient-to-r from-blue-500 to-indigo-500 h-full transition-all duration-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]" style="width: ${this.state.progress}%"></div>
        </div>
        <p class="mt-4 text-[10px] text-slate-500 uppercase tracking-widest">${Math.round(this.state.progress)}% Complete</p>
      ` : ''}
    `;
    return div;
  }

  private renderResultStep() {
    const div = document.createElement('div');
    div.className = 'grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in zoom-in fade-in duration-700';
    div.innerHTML = `
      <div class="lg:col-span-8 space-y-8">
        <div class="glass-card rounded-3xl p-8 shadow-2xl border border-white/10">
          <div class="flex items-center gap-2 mb-6 border-b border-white/10 pb-4">
            <span class="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-400">EPISODE TRANSCRIPT</span>
          </div>
          <div class="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
            ${this.state.session.transcript.map((turn: any) => `
              <div class="flex flex-col ${turn.speaker === 'Joe' ? 'items-start' : 'items-end'}">
                <div class="max-w-[85%] rounded-2xl p-4 ${turn.speaker === 'Joe' ? 'bg-blue-600/30 text-blue-100 rounded-bl-none' : 'bg-purple-600/30 text-purple-100 rounded-br-none'}">
                  <span class="text-[10px] font-bold uppercase block mb-1 opacity-70">${turn.speaker}</span>
                  <p class="text-sm leading-relaxed">${turn.text}</p>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
      <div class="lg:col-span-4 lg:sticky lg:top-8 h-fit space-y-6">
        <div class="glass-card rounded-3xl p-8 flex flex-col items-center text-center shadow-2xl border border-white/10">
          <div class="mb-8 flex flex-col items-center gap-2">
            <div class="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center text-blue-400">
               <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
            </div>
            <h3 class="text-xl font-bold text-white">${this.state.topic}</h3>
            <p class="text-xs text-slate-500 uppercase tracking-widest">Ready to listen</p>
          </div>
          
          <audio controls src="${this.state.session.audioUrl}" class="w-full mb-6 accent-blue-500"></audio>
          
          <div class="flex flex-col w-full gap-3">
            <button id="download-btn" class="w-full py-4 rounded-2xl bg-blue-600 text-white font-bold hover:bg-blue-500 transition-all flex items-center justify-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Download WAV
            </button>
            <button id="new-btn" class="w-full py-4 rounded-2xl bg-white/5 border border-white/5 text-slate-400 font-bold hover:text-white transition-all uppercase tracking-widest text-xs">New Episode</button>
          </div>
        </div>
      </div>
    `;
    div.querySelector('#new-btn')!.addEventListener('click', () => this.setState({ step: 'input', session: null, topic: '', selectedGenre: null, genreTopics: [] }));
    div.querySelector('#download-btn')!.addEventListener('click', () => {
      const a = document.createElement('a');
      a.href = this.state.session.audioUrl;
      a.download = `podcast_${this.state.topic.replace(/\s+/g, '_')}.wav`;
      a.click();
    });
    return div;
  }
}

new App();
