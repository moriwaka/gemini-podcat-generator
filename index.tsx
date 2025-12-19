
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
  };

  private suggestedTopics = {
    [Language.JAPANESE]: [
      "量子コンピュータの未来", "コーヒーの歴史と文化", "火星移住計画の現実味",
      "深海生物の謎", "マインドフルネスの科学", "古代シルクロードの冒険",
      "最新のAIと芸術の融合", "サステナブルな建築デザイン", "江戸時代の食生活",
      "ビデオゲームの進化史", "遺伝子編集技術CRISPR", "都市伝説の心理学"
    ],
    [Language.ENGLISH]: [
      "The Future of Quantum Computing", "History and Culture of Coffee", "Reality of Mars Colonization",
      "Mysteries of Deep Sea Creatures", "Science of Mindfulness", "Adventures on the Silk Road",
      "AI and Art Integration", "Sustainable Architecture", "Daily Life in Edo Period",
      "Evolution of Video Games", "CRISPR Gene Editing", "Psychology of Urban Legends"
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
      session: null
    };
    this.render();
  }

  private setState(newState: Partial<typeof this.state>) {
    this.state = { ...this.state, ...newState };
    this.render();
  }

  private async startOutlineGeneration(topic: string) {
    if (!topic.trim()) return;
    this.setState({ topic, isLoading: true, loadingStep: '構成を作成中...' });
    try {
      const outline = await this.service.generateOutline(topic, this.state.language);
      this.setState({ outline, step: 'outline', isLoading: false });
    } catch (err) {
      alert('Error generating outline.');
      this.setState({ isLoading: false });
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
          ? '聞き手役のJoe（好奇心旺盛）と解説役のJane（専門家）による深掘り対談。' 
          : 'Deep dive discussion between Joe (Curious Novice) and Jane (Expert Explainer).'}
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
    
    // Lang Switcher
    const langDiv = document.createElement('div');
    langDiv.className = 'flex gap-2 justify-center mb-8 bg-white/5 p-1 rounded-xl border border-white/10 w-fit mx-auto';
    langDiv.innerHTML = `
      <button id="btn-ja" class="px-4 py-2 rounded-lg text-xs font-bold transition-all ${this.state.language === Language.JAPANESE ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}">日本語</button>
      <button id="btn-en" class="px-4 py-2 rounded-lg text-xs font-bold transition-all ${this.state.language === Language.ENGLISH ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}">English</button>
    `;
    langDiv.querySelector('#btn-ja')!.addEventListener('click', () => this.setState({ language: Language.JAPANESE }));
    langDiv.querySelector('#btn-en')!.addEventListener('click', () => this.setState({ language: Language.ENGLISH }));
    div.appendChild(langDiv);

    const form = document.createElement('form');
    form.className = 'relative group w-full mb-12';
    form.innerHTML = `
      <input type="text" id="topic-input" value="${this.state.topic}" placeholder="${this.state.language === Language.JAPANESE ? 'トピックを入力 (例: 最新の宇宙探査...)' : 'Enter topic (e.g., Space Exploration...)'}" class="w-full glass-card rounded-2xl py-6 pl-8 pr-40 focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-lg shadow-xl" />
      <button type="submit" id="submit-btn" class="absolute right-3 top-3 bottom-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold px-8 rounded-xl shadow-lg hover:scale-105 transition-all">
        ${this.state.isLoading ? '...' : (this.state.language === Language.JAPANESE ? '構成を作成' : 'Create Outline')}
      </button>
    `;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = form.querySelector('#topic-input') as HTMLInputElement;
      this.startOutlineGeneration(input.value);
    });
    div.appendChild(form);

    // Suggested Topics Section
    const suggestContainer = document.createElement('div');
    suggestContainer.className = 'w-full';
    suggestContainer.innerHTML = `
      <h3 class="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 text-center">
        ${this.state.language === Language.JAPANESE ? 'おすすめのトピック' : 'Suggested Topics'}
      </h3>
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        ${this.suggestedTopics[this.state.language].map(t => `
          <button class="topic-chip glass-card px-4 py-3 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:border-blue-500/50 hover:bg-white/5 transition-all text-left truncate" data-topic="${t}">
            ${t}
          </button>
        `).join('')}
      </div>
    `;
    suggestContainer.querySelectorAll('.topic-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const t = (btn as HTMLElement).dataset.topic;
        if (t) this.startOutlineGeneration(t);
      });
    });
    div.appendChild(suggestContainer);

    return div;
  }

  private renderOutlineStep() {
    const div = document.createElement('div');
    div.className = 'glass-card rounded-3xl p-8 shadow-2xl border border-white/10';
    div.innerHTML = `
      <div class="flex items-center justify-between mb-6 border-b border-white/10 pb-4">
        <h2 class="text-xl font-bold text-white">Proposed Outline</h2>
        <button id="back-btn" class="text-xs text-slate-400 hover:text-white">Back</button>
      </div>
      <ul class="space-y-4 mb-10">
        ${this.state.outline.map((item, i) => `
          <li class="flex items-start gap-4 p-4 rounded-xl bg-white/5 border border-white/5">
            <span class="text-blue-500 font-bold">${i + 1}.</span>
            <p class="text-slate-200">${item}</p>
          </li>
        `).join('')}
      </ul>
      <div class="flex flex-col sm:flex-row gap-4">
        <button id="gen-btn" class="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold py-4 rounded-xl shadow-lg">Generate Podcast</button>
        <button id="re-out-btn" class="px-8 py-4 bg-white/5 text-white font-bold rounded-xl border border-white/10">Regenerate Outline</button>
      </div>
    `;
    div.querySelector('#back-btn')!.addEventListener('click', () => this.setState({ step: 'input' }));
    div.querySelector('#re-out-btn')!.addEventListener('click', () => {
      this.setState({ isLoading: true, loadingStep: '再構成中...' });
      this.service.generateOutline(this.state.topic, this.state.language).then(outline => {
        this.setState({ outline, isLoading: false });
      });
    });
    div.querySelector('#gen-btn')!.addEventListener('click', async () => {
      this.setState({ step: 'generating', isLoading: true, progress: 0 });
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
          isLoading: false
        });
      } catch (err) {
        alert('Generation failed');
        this.setState({ step: 'outline', isLoading: false });
      }
    });
    return div;
  }

  private renderGeneratingStep() {
    const div = document.createElement('div');
    div.className = 'flex flex-col items-center py-20';
    div.innerHTML = `
      <div class="w-20 h-20 mb-8 relative border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
      <p class="text-xl font-bold text-blue-400 mb-2 animate-pulse">Generating Audio...</p>
      <div class="w-full max-w-md bg-white/5 rounded-full h-2 overflow-hidden border border-white/10 mt-4">
        <div class="bg-gradient-to-r from-blue-500 to-indigo-500 h-full transition-all duration-500" style="width: ${this.state.progress}%"></div>
      </div>
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
    div.querySelector('#new-btn')!.addEventListener('click', () => this.setState({ step: 'input', session: null, topic: '' }));
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
