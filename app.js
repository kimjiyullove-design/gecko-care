/**
 * 크리스티드 게코 키우기 (Crested Gecko Care & AI Companion)
 * 메인 애플리케이션 로직
 */

// ==========================================
// 1. 상태 관리 (State Management)
// ==========================================
const DEFAULT_WEEKLY_ROUTINES = [
    { day: '일요일', feed: '🥣 슈푸 배식', tasks: '• 전체 사육장 소독 청소\n• 주간 체중(g) 정밀 측정\n• 1회 분무' },
    { day: '월요일', feed: '🥣 슈푸 피딩 Day', tasks: '• 아침/저녁 벽면 분무\n• 슈퍼푸드 신선하게 배식\n• 온·습도 점검' },
    { day: '화요일', feed: '❌ 소화 및 휴식', tasks: '• 배설물 스팟 클리닝\n• 아침/저녁 수분 분무\n• 탈피 여부 체크' },
    { day: '수요일', feed: '🥣 슈푸 피딩 Day', tasks: '• 슈퍼푸드 배식\n• 물그릇 깨끗이 세척\n• 벽면 분무' },
    { day: '목요일', feed: '❌ 소화 및 휴식', tasks: '• 키친타월 바닥재 점검\n• 배설물 변 상태 확인\n• 온·습도 점검' },
    { day: '금요일', feed: '🦗 귀뚜라미 or 슈푸', tasks: '• 칼슘 더스팅 피딩\n• 점착패드 청결도 확인\n• 저녁 충분한 분무' },
    { day: '토요일', feed: '❌ 소화 및 휴식', tasks: '• 교감 및 가벼운 핸들링\n• 발가락 탈피 껍질 점검\n• 아침/저녁 분무' }
  ];

const AppState = {
  ownerName: '',
  pet: {
    name: '크림',
    morph: '릴리 화이트',
    adoptedDate: '2026-09-24',
  },
  attendance: {
    streak: 0,
    history: [], // ['2026-10-06', ...]
    lastChecked: null,
  },
  previewStage: null,
  soundEnabled: true,
  geminiApiKey: '',
  todos: [
    { id: 1, text: '아침 사육장 온·습도 체크 (적정: 22~26°C / 70%)', tag: '환경', done: true },
    { id: 2, text: '사육장 벽면에 신선한 물 미세 분무 (아침)', tag: '분무', done: true },
    { id: 3, text: '슈퍼푸드 배식 (주 3회 급여 주기 확인)', tag: '피딩', done: false },
    { id: 4, text: '배설물 확인 및 키친타월 스팟 클리닝', tag: '청소', done: false },
    { id: 5, text: '저녁 온습도 확인 및 야간 2차 분무', tag: '분무', done: false }
  ],
  weeklyRoutines: DEFAULT_WEEKLY_ROUTINES.map(item => ({ ...item })),
  diaries: [],
  currentTab: 'schedule',
  currentStage: 1, // 1 to 5
  chatHistory: [
    {
      sender: 'assistant',
      text: '반가워요, 집사님! 크리스티드 게코 전문 AI 상담사입니다. 🌿\n슈퍼푸드 급여, 온·습도 조절, 탈피 껍질 관리, 질병 의심 등 무엇이든 편하게 물어보세요!'
    }
  ],
  currentImageBase64: null,
};

function getOwnerLabel() {
  return AppState.ownerName ? `집사 ${AppState.ownerName}님` : '집사님';
}

function personalizeOwnerText(text) {
  return String(text).replace(/집사님/g, () => getOwnerLabel());
}

function renderOwnerProfile() {
  const greeting = document.getElementById('owner-greeting');
  if (greeting) greeting.textContent = `${getOwnerLabel()}, 오늘도 ${AppState.pet.name}와 함께해요!`;
  const welcome = document.getElementById('chat-welcome-text');
  if (welcome) welcome.textContent = `반가워요, ${getOwnerLabel()}! 크리스티드 게코 전문 AI 상담사입니다. 🌿`;
}

function setApiKeyEditorEnabled(enabled) {
  const panel = document.getElementById('api-key-settings');
  panel.disabled = !enabled;
  panel.classList.toggle('hidden', !enabled);
  const button = document.getElementById('btn-toggle-api-settings');
  button.setAttribute('aria-expanded', String(enabled));
  button.textContent = enabled ? 'API Key 설정 닫기' : 'API Key (선택 사항) 설정 열기';
  if (enabled) document.getElementById('cfg-gemini-key').focus();
}

// ==========================================
// 2. 사운드 이펙트 (Web Audio API Synthesizer)
// ==========================================
class SoundFX {
  static ctx = null;

  static init() {
    if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  static playChime() {
    if (!AppState.soundEnabled) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.exponentialRampToValueAtTime(1046.5, now + 0.2); // C6

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    } catch (e) {
      console.log('Audio playback error', e);
    }
  }

  static playLevelUp() {
    if (!AppState.soundEnabled) return;
    this.init();
    if (!this.ctx) return;

    try {
      const notes = [440, 554.37, 659.25, 880]; // A4, C#5, E5, A5
      notes.forEach((freq, idx) => {
        const now = this.ctx.currentTime + idx * 0.08;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.25);
      });
    } catch (e) {}
  }
}

// ==========================================
// 3. 컨페티 파티클 이펙트 (Confetti)
// ==========================================
class ConfettiEffect {
  static canvas = null;
  static ctx = null;
  static particles = [];
  static animId = null;

  static init() {
    this.canvas = document.getElementById('confetti-canvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  static resize() {
    if (!this.canvas) return;
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  static fire(count = 60) {
    if (!this.canvas) return;
    const colors = ['#4e7354', '#d4a347', '#c86d42', '#39e58c', '#f59e0b', '#ec4899'];
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: window.innerWidth / 2,
        y: window.innerHeight * 0.35,
        vx: (Math.random() - 0.5) * 14,
        vy: (Math.random() - 0.9) * 16,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        vr: (Math.random() - 0.5) * 10,
        gravity: 0.35,
        opacity: 1
      });
    }

    if (!this.animId) {
      this.loop();
    }
  }

  static loop() {
    if (!this.ctx) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.rotation += p.vr;
      p.opacity -= 0.012;

      this.ctx.save();
      this.ctx.translate(p.x, p.y);
      this.ctx.rotate((p.rotation * Math.PI) / 180);
      this.ctx.fillStyle = p.color;
      this.ctx.globalAlpha = Math.max(0, p.opacity);
      this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.4);
      this.ctx.restore();

      if (p.opacity <= 0 || p.y > this.canvas.height + 50) {
        this.particles.splice(i, 1);
      }
    }

    if (this.particles.length > 0) {
      this.animId = requestAnimationFrame(() => this.loop());
    } else {
      this.animId = null;
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }
}

// ==========================================
// 4. 캐릭터 SVG 생성기 (5단계 진화 시스템)
// ==========================================
// 1단계 (1~6일): 귀여운 아기 크레 (Baby Crestie)
// 2단계 (7~13일): 장난꾸러기 주니어 크레 (Junior Crestie)
// 3단계 (14~20일): 위풍당당 성체 크레 (Adult Crowned Crestie)
// 4단계 (21~29일): 작은 날개 돋은 전설의 크레 (Winged Drake Crestie)
// 5단계 (30일+): 신화의 위대한 천상룡 (Grand Celestial Dragon!)
function getGeckoSvg(stage) {
  switch (stage) {
    case 1:
      // 아기 크레: 큰 눈, 앙증맞은 머리, 조그만 속눈썹 볏, 말린 꼬리
      return `
      <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="babySkin" cx="40%" cy="30%" r="70%">
            <stop offset="0%" stop-color="#ffe4b5" />
            <stop offset="100%" stop-color="#e2a15c" />
          </radialGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="blur"/>
            <feComposite in="SourceGraphic" in2="blur" operator="over"/>
          </filter>
        </defs>
        <g class="gecko-body-group">
          <!-- 말린 꼬리 -->
          <path d="M 120 150 Q 155 170 165 140 Q 170 120 155 115 Q 145 115 145 125" 
                fill="none" stroke="#e2a15c" stroke-width="12" stroke-linecap="round"/>
          
          <!-- 뒷다리 & 발바닥 패드 -->
          <ellipse cx="120" cy="145" rx="14" ry="10" fill="#d4924f" />
          <circle cx="132" cy="148" r="5" fill="#f5c28e" />
          <circle cx="126" cy="154" r="4.5" fill="#f5c28e" />

          <!-- 아기 몸통 -->
          <ellipse cx="100" cy="130" rx="28" ry="32" fill="url(#babySkin)" />
          
          <!-- 배 부분 밝은 색 -->
          <ellipse cx="94" cy="132" rx="18" ry="22" fill="#fff5e4" opacity="0.8" />
          
          <!-- 앞다리 -->
          <ellipse cx="72" cy="136" rx="12" ry="8" fill="#d4924f" transform="rotate(-15 72 136)" />
          <circle cx="65" cy="138" r="4" fill="#f5c28e" />
          <circle cx="68" cy="143" r="4" fill="#f5c28e" />

          <!-- 머리 & 왕관 볏 (크레 시그니처) -->
          <ellipse cx="90" cy="80" rx="34" ry="28" fill="url(#babySkin)" />
          
          <!-- 앙증맞은 머리 볏 (Spikes) -->
          <path d="M 62 65 Q 60 50 68 56 Q 74 46 82 54 Q 90 44 98 54 Q 106 46 114 56 Q 122 50 120 65" 
                fill="#ffd499" stroke="#cf8640" stroke-width="2" />
          
          <!-- 왼쪽 눈 & 속눈썹 -->
          <circle cx="72" cy="76" r="13" fill="#ffffff" stroke="#c07b38" stroke-width="2" />
          <circle cx="73" cy="76" r="9" fill="#2d2218" />
          <circle cx="70" cy="73" r="4" fill="#ffffff" />
          <path d="M 60 70 Q 72 63 84 70" fill="none" stroke="#cf8640" stroke-width="3" stroke-linecap="round" />
          
          <!-- 오른쪽 눈 & 속눈썹 -->
          <circle cx="108" cy="76" r="13" fill="#ffffff" stroke="#c07b38" stroke-width="2" />
          <circle cx="107" cy="76" r="9" fill="#2d2218" />
          <circle cx="105" cy="73" r="4" fill="#ffffff" />
          <path d="M 98 70 Q 110 63 122 70" fill="none" stroke="#cf8640" stroke-width="3" stroke-linecap="round" />

          <!-- 귀여운 미소 & 콧구멍 -->
          <circle cx="86" cy="88" r="1.5" fill="#7a461b" />
          <circle cx="94" cy="88" r="1.5" fill="#7a461b" />
          <path d="M 85 95 Q 90 100 95 95" fill="none" stroke="#7a461b" stroke-width="2.5" stroke-linecap="round" />

          <!-- 볼터치 -->
          <ellipse cx="64" cy="86" rx="6" ry="4" fill="#ff9999" opacity="0.6" />
          <ellipse cx="116" cy="86" rx="6" ry="4" fill="#ff9999" opacity="0.6" />
        </g>
      </svg>`;

    case 2:
      // 주니어 크레: 하를리퀸 무늬 발색 시작, 볏이 더욱 풍성해짐, 활발한 눈
      return `
      <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="juniorSkin" cx="40%" cy="30%" r="70%">
            <stop offset="0%" stop-color="#ffcc80" />
            <stop offset="60%" stop-color="#e68a35" />
            <stop offset="100%" stop-color="#b85d18" />
          </radialGradient>
        </defs>
        <g class="gecko-body-group">
          <!-- 꼬리 (발색 무늬) -->
          <path d="M 125 145 Q 165 160 170 125 Q 172 100 150 95 Q 138 95 138 108" 
                fill="none" stroke="#e68a35" stroke-width="15" stroke-linecap="round"/>
          <path d="M 130 148 Q 160 155 165 125" fill="none" stroke="#fff0d0" stroke-width="5" stroke-linecap="round" />

          <!-- 뒷다리 -->
          <ellipse cx="125" cy="140" rx="16" ry="12" fill="#c46a20" />
          <circle cx="138" cy="145" r="5" fill="#ffda9e" />
          <circle cx="132" cy="151" r="5" fill="#ffda9e" />
          <circle cx="125" cy="153" r="4.5" fill="#ffda9e" />

          <!-- 몸통 -->
          <ellipse cx="102" cy="125" rx="30" ry="36" fill="url(#juniorSkin)" />
          <!-- 등 줄무늬 (핀스트라이프) -->
          <path d="M 94 95 Q 98 125 96 155" fill="none" stroke="#fff4db" stroke-width="6" stroke-linecap="round" opacity="0.9" />

          <!-- 앞다리 -->
          <ellipse cx="68" cy="132" rx="14" ry="9" fill="#c46a20" transform="rotate(-20 68 132)" />
          <circle cx="58" cy="134" r="5" fill="#ffda9e" />
          <circle cx="62" cy="140" r="4.5" fill="#ffda9e" />
          
          <!-- 머리 & 화려해진 볏 -->
          <ellipse cx="92" cy="75" rx="36" ry="30" fill="url(#juniorSkin)" />
          <path d="M 58 60 Q 55 42 66 50 Q 74 38 84 48 Q 94 36 104 48 Q 114 38 122 50 Q 132 42 128 60" 
                fill="#ffeaab" stroke="#a34a0a" stroke-width="2.5" />
          
          <!-- 눈 & 선명한 속눈썹 볏 -->
          <circle cx="72" cy="72" r="14" fill="#ffffff" stroke="#a34a0a" stroke-width="2" />
          <circle cx="74" cy="72" r="9.5" fill="#2d1c0b" />
          <circle cx="71" cy="69" r="4.5" fill="#ffffff" />
          <path d="M 58 64 Q 72 56 86 64" fill="none" stroke="#a34a0a" stroke-width="4" stroke-linecap="round" />
          
          <circle cx="112" cy="72" r="14" fill="#ffffff" stroke="#a34a0a" stroke-width="2" />
          <circle cx="110" cy="72" r="9.5" fill="#2d1c0b" />
          <circle cx="107" cy="69" r="4.5" fill="#ffffff" />
          <path d="M 98 64 Q 112 56 126 64" fill="none" stroke="#a34a0a" stroke-width="4" stroke-linecap="round" />

          <!-- 귀여운 혀 낼름 애니메이션 효과 요소 -->
          <path d="M 88 88 Q 92 98 94 92" fill="none" stroke="#ff6b81" stroke-width="3" stroke-linecap="round" />
          
          <!-- 주니어 나뭇잎 악세서리 -->
          <path d="M 52 50 Q 40 40 50 30 Q 60 40 52 50" fill="#66aa55" opacity="0.85" />
        </g>
      </svg>`;

    case 3:
      // 성체 크레: 릴리 화이트의 화려한 화이트 월과 당당한 왕관 볏
      return `
      <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="adultLily" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#fff8ed" />
            <stop offset="50%" stop-color="#ffcc88" />
            <stop offset="100%" stop-color="#a6551b" />
          </linearGradient>
        </defs>
        <g class="gecko-body-group">
          <!-- 꼬리 -->
          <path d="M 130 145 Q 175 160 178 120 Q 180 90 155 85 Q 140 85 142 98" 
                fill="none" stroke="#a6551b" stroke-width="16" stroke-linecap="round"/>
          <path d="M 135 148 Q 170 155 174 122" fill="none" stroke="#ffffff" stroke-width="7" stroke-linecap="round" />

          <!-- 튼튼한 뒷다리 -->
          <ellipse cx="128" cy="140" rx="18" ry="14" fill="#934612" />
          <circle cx="143" cy="144" r="5.5" fill="#ffe2b8" />
          <circle cx="137" cy="152" r="5.5" fill="#ffe2b8" />
          <circle cx="129" cy="155" r="5" fill="#ffe2b8" />

          <!-- 릴리화이트 등과 몸통 -->
          <ellipse cx="102" cy="122" rx="33" ry="38" fill="url(#adultLily)" />
          <path d="M 88 90 Q 95 125 90 155" fill="none" stroke="#ffffff" stroke-width="10" stroke-linecap="round" />
          
          <!-- 앞다리 -->
          <ellipse cx="64" cy="130" rx="16" ry="10" fill="#934612" transform="rotate(-25 64 130)" />
          <circle cx="52" cy="132" r="5.5" fill="#ffe2b8" />
          <circle cx="56" cy="140" r="5" fill="#ffe2b8" />

          <!-- 당당한 머리와 왕관형 볏 (Crest Crown) -->
          <ellipse cx="92" cy="72" rx="38" ry="32" fill="url(#adultLily)" />
          <!-- 웅장한 왕관 볏 -->
          <path d="M 54 55 Q 50 32 64 42 Q 72 26 84 38 Q 94 22 104 38 Q 116 26 124 42 Q 138 32 134 55" 
                fill="#ffffff" stroke="#c97e36" stroke-width="2.5" />
          <polygon points="94,22 98,34 90,34" fill="#ffd700" />

          <!-- 또렷하고 당당한 눈 -->
          <circle cx="70" cy="68" r="15" fill="#ffffff" stroke="#7a3709" stroke-width="2.5" />
          <circle cx="72" cy="68" r="10" fill="#201306" />
          <ellipse cx="73" cy="68" rx="3" ry="8" fill="#ffd54f" opacity="0.6" />
          <circle cx="69" cy="65" r="5" fill="#ffffff" />
          <path d="M 54 58 Q 70 48 86 58" fill="none" stroke="#7a3709" stroke-width="4.5" stroke-linecap="round" />
          
          <circle cx="114" cy="68" r="15" fill="#ffffff" stroke="#7a3709" stroke-width="2.5" />
          <circle cx="112" cy="68" r="10" fill="#201306" />
          <ellipse cx="111" cy="68" rx="3" ry="8" fill="#ffd54f" opacity="0.6" />
          <circle cx="109" cy="65" r="5" fill="#ffffff" />
          <path d="M 98 58 Q 114 48 130 58" fill="none" stroke="#7a3709" stroke-width="4.5" stroke-linecap="round" />

          <!-- 당당한 미소 -->
          <path d="M 85 88 Q 92 95 99 88" fill="none" stroke="#522405" stroke-width="3" stroke-linecap="round" />
        </g>
      </svg>`;

    case 4:
      // 전설의 날개 크레 (Winged Drake): 등에 작고 신비로운 날개, 빛나는 오라
      return `
      <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="dragonSkinGlow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#fff1c7" />
            <stop offset="50%" stop-color="#d48a37" />
            <stop offset="100%" stop-color="#5c2b09" />
          </linearGradient>
          <radialGradient id="wingGrad" cx="30%" cy="30%" r="70%">
            <stop offset="0%" stop-color="#a8e6cf" />
            <stop offset="100%" stop-color="#3b7a57" />
          </radialGradient>
        </defs>
        <g class="gecko-body-group">
          <!-- 마법 날개 (배경 레이어) -->
          <!-- 왼쪽 날개 -->
          <path d="M 75 110 Q 25 70 20 100 Q 18 120 45 125 Q 65 128 75 120" 
                fill="url(#wingGrad)" stroke="#235338" stroke-width="2.5" opacity="0.9" />
          <path d="M 20 100 Q 40 105 75 115" fill="none" stroke="#d5f5e3" stroke-width="2" />

          <!-- 오른쪽 날개 -->
          <path d="M 125 110 Q 175 70 180 100 Q 182 120 155 125 Q 135 128 125 120" 
                fill="url(#wingGrad)" stroke="#235338" stroke-width="2.5" opacity="0.9" />
          <path d="M 180 100 Q 160 105 125 115" fill="none" stroke="#d5f5e3" stroke-width="2" />

          <!-- 꼬리 -->
          <path d="M 125 145 Q 170 160 178 120 Q 182 85 150 80 Q 135 80 138 95" 
                fill="none" stroke="#8c400c" stroke-width="16" stroke-linecap="round"/>
          <path d="M 130 148 Q 165 155 174 122" fill="none" stroke="#ffd54f" stroke-width="6" stroke-linecap="round" />

          <!-- 다리 & 발바닥 -->
          <ellipse cx="126" cy="140" rx="18" ry="14" fill="#783407" />
          <circle cx="140" cy="144" r="5.5" fill="#fde68a" />
          <circle cx="134" cy="152" r="5.5" fill="#fde68a" />
          
          <ellipse cx="64" cy="130" rx="16" ry="10" fill="#783407" transform="rotate(-25 64 130)" />
          <circle cx="52" cy="132" r="5.5" fill="#fde68a" />
          <circle cx="56" cy="140" r="5" fill="#fde68a" />

          <!-- 몸통 -->
          <ellipse cx="100" cy="122" rx="34" ry="38" fill="url(#dragonSkinGlow)" />
          <path d="M 90 90 Q 98 125 94 155" fill="none" stroke="#fff8e7" stroke-width="8" stroke-linecap="round" />

          <!-- 머리 & 드래곤 뿔 + 볏 조합 -->
          <ellipse cx="92" cy="70" rx="38" ry="32" fill="url(#dragonSkinGlow)" />
          <!-- 드래곤 뿔 -->
          <path d="M 55 52 Q 35 25 45 18 Q 58 24 64 45" fill="#ffd700" stroke="#b45309" stroke-width="2" />
          <path d="M 129 52 Q 149 25 139 18 Q 126 24 120 45" fill="#ffd700" stroke="#b45309" stroke-width="2" />
          
          <!-- 머리 볏 -->
          <path d="M 64 45 Q 74 30 84 40 Q 94 25 104 40 Q 114 30 120 45" 
                fill="#fff2cc" stroke="#b45309" stroke-width="2" />

          <!-- 신비로운 눈 (드래곤 동공) -->
          <circle cx="70" cy="66" r="15" fill="#ffffff" stroke="#522405" stroke-width="2.5" />
          <circle cx="72" cy="66" r="10" fill="#1e293b" />
          <polygon points="72,58 75,66 72,74 69,66" fill="#38bdf8" />
          <circle cx="69" cy="63" r="4" fill="#ffffff" />
          <path d="M 54 56 Q 70 46 86 56" fill="none" stroke="#522405" stroke-width="4.5" stroke-linecap="round" />

          <circle cx="114" cy="66" r="15" fill="#ffffff" stroke="#522405" stroke-width="2.5" />
          <circle cx="112" cy="66" r="10" fill="#1e293b" />
          <polygon points="112,58 115,66 112,74 109,66" fill="#38bdf8" />
          <circle cx="109" cy="63" r="4" fill="#ffffff" />
          <path d="M 98 56 Q 114 46 130 56" fill="none" stroke="#522405" stroke-width="4.5" stroke-linecap="round" />

          <!-- 반짝이는 마법 파티클 -->
          <circle cx="35" cy="50" r="3" fill="#38bdf8" opacity="0.8" />
          <circle cx="160" cy="45" r="3.5" fill="#fbbf24" opacity="0.8" />
        </g>
      </svg>`;

    case 5:
    default:
      // 5단계 (30일 완성): 신화의 위대한 천상룡 (Grand Celestial Dragon)
      // 웅장한 황금 날개, 뿔, 오라, 불꽃 마법, 위풍당당한 용의 자태!
      return `
      <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="celestialDragonSkin" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#fff8db" />
            <stop offset="40%" stop-color="#f59e0b" />
            <stop offset="80%" stop-color="#b45309" />
            <stop offset="100%" stop-color="#78350f" />
          </linearGradient>
          <linearGradient id="grandWing" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#fef08a" />
            <stop offset="50%" stop-color="#f59e0b" />
            <stop offset="100%" stop-color="#b45309" />
          </linearGradient>
          <filter id="dragonAura">
            <feGaussianBlur stdDeviation="5" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        <!-- 배경 오라 광배 -->
        <circle cx="100" cy="100" r="82" fill="none" stroke="#fef08a" stroke-width="4" stroke-dasharray="6,8" opacity="0.6"/>

        <g class="gecko-body-group" filter="url(#dragonAura)">
          <!-- 웅장한 거대 날개 (좌측) -->
          <path d="M 80 100 Q 15 35 5 75 Q 0 105 35 115 Q 65 120 80 110" 
                fill="url(#grandWing)" stroke="#78350f" stroke-width="3" />
          <path d="M 5 75 Q 35 85 80 105" fill="none" stroke="#ffffff" stroke-width="3" />
          <path d="M 20 95 Q 45 102 75 110" fill="none" stroke="#ffffff" stroke-width="2" />

          <!-- 웅장한 거대 날개 (우측) -->
          <path d="M 120 100 Q 185 35 195 75 Q 200 105 165 115 Q 135 120 120 110" 
                fill="url(#grandWing)" stroke="#78350f" stroke-width="3" />
          <path d="M 195 75 Q 165 85 120 105" fill="none" stroke="#ffffff" stroke-width="3" />
          <path d="M 180 95 Q 155 102 125 110" fill="none" stroke="#ffffff" stroke-width="2" />

          <!-- 드래곤 꼬리 (끝에 불꽃/마법 팁) -->
          <path d="M 125 145 Q 175 165 182 115 Q 185 75 150 70 Q 135 70 138 88" 
                fill="none" stroke="#9a3412" stroke-width="18" stroke-linecap="round"/>
          <path d="M 130 148 Q 170 158 178 118" fill="none" stroke="#fef08a" stroke-width="7" stroke-linecap="round" />
          <!-- 꼬리 끝 불꽃 보석 -->
          <polygon points="145,62 154,72 145,82 136,72" fill="#ef4444" stroke="#ffd700" stroke-width="2"/>

          <!-- 강인한 다리와 발톱 -->
          <ellipse cx="128" cy="140" rx="20" ry="15" fill="#78350f" />
          <circle cx="145" cy="144" r="6" fill="#fde68a" />
          <circle cx="138" cy="154" r="6" fill="#fde68a" />
          <circle cx="129" cy="157" r="5.5" fill="#fde68a" />

          <ellipse cx="60" cy="130" rx="18" ry="12" fill="#78350f" transform="rotate(-25 60 130)" />
          <circle cx="47" cy="132" r="6" fill="#fde68a" />
          <circle cx="51" cy="142" r="5.5" fill="#fde68a" />

          <!-- 웅장한 드래곤 몸통 -->
          <ellipse cx="100" cy="122" rx="36" ry="40" fill="url(#celestialDragonSkin)" />
          <!-- 복부 황금 비늘 -->
          <path d="M 92 88 Q 100 125 96 158" fill="none" stroke="#fffbeb" stroke-width="12" stroke-linecap="round" />

          <!-- 드래곤 머리와 위엄있는 황금 뿔 -->
          <ellipse cx="92" cy="68" rx="40" ry="34" fill="url(#celestialDragonSkin)" />
          
          <!-- 좌우 황금 뿔 (Grand Horns) -->
          <path d="M 52 48 Q 20 15 36 6 Q 52 14 62 40" fill="#fbbf24" stroke="#78350f" stroke-width="2.5" />
          <path d="M 132 48 Q 164 15 148 6 Q 132 14 122 40" fill="#fbbf24" stroke="#78350f" stroke-width="2.5" />
          
          <!-- 정수리 드래곤 크라운 볏 -->
          <path d="M 62 40 Q 72 20 84 34 Q 92 14 100 34 Q 112 20 122 40" 
                fill="#fef08a" stroke="#78350f" stroke-width="2.5" />
          
          <!-- 천상룡 이마 보석 (크레 드래곤 마크) -->
          <polygon points="92,40 97,48 92,56 87,48" fill="#ef4444" stroke="#ffd700" stroke-width="1.5"/>

          <!-- 불타오르는 드래곤 눈 (신비로운 루비/골드 아이) -->
          <circle cx="68" cy="64" r="16" fill="#ffffff" stroke="#451a03" stroke-width="3" />
          <circle cx="70" cy="64" r="11" fill="#451a03" />
          <polygon points="70,54 74,64 70,74 66,64" fill="#fbbf24" />
          <circle cx="67" cy="60" r="4.5" fill="#ffffff" />
          <path d="M 50 52 Q 68 40 86 52" fill="none" stroke="#451a03" stroke-width="5" stroke-linecap="round" />

          <circle cx="116" cy="64" r="16" fill="#ffffff" stroke="#451a03" stroke-width="3" />
          <circle cx="114" cy="64" r="11" fill="#451a03" />
          <polygon points="114,54 118,64 114,74 110,64" fill="#fbbf24" />
          <circle cx="111" cy="60" r="4.5" fill="#ffffff" />
          <path d="M 98 52 Q 116 40 134 52" fill="none" stroke="#451a03" stroke-width="5" stroke-linecap="round" />

          <!-- 자비롭고 위엄 있는 미소 -->
          <path d="M 84 82 Q 92 90 100 82" fill="none" stroke="#451a03" stroke-width="3.5" stroke-linecap="round" />
          
          <!-- 입가 미세 불꽃 숨결 파티클 -->
          <circle cx="92" cy="94" r="3.5" fill="#f97316" opacity="0.9" />
          <circle cx="98" cy="100" r="2.5" fill="#eab308" opacity="0.8" />
        </g>
      </svg>`;
  }
}

// 실사/일러스트 기반 캐릭터 아바타 및 단계별 마법 진화 오버레이 생성기
function getGeckoDisplay(stage) {
  const stageImages = {
    1: 'image/gecko_stage1_aligned.gif',
    2: 'image/gecko_stage2_junior.gif',
    3: 'image/gecko_stage3_aligned.gif',
    4: 'image/gecko_stage4_aligned.gif',
    5: 'image/gecko_stage5_aligned.gif'
  };
  const photoSrc = stageImages[stage] || 'image/gecko_stage3.jpg';
  let wingsHtml = '';
  let frontHtml = '';
  let badgeIcon = '💖';

  switch (stage) {
    case 1:
      badgeIcon = '🐣';
      frontHtml = `
        <svg class="evo-front-svg" viewBox="0 0 300 300">
          <text x="35" y="70" font-size="22">💕</text>
          <text x="235" y="75" font-size="24">✨</text>
          <text x="220" y="235" font-size="20">🐾</text>
          <text x="45" y="225" font-size="18">💖</text>
        </svg>
      `;
      break;

    case 2:
      badgeIcon = '🌱';
      frontHtml = `
        <svg class="evo-front-svg" viewBox="0 0 300 300">
          <text x="30" y="65" font-size="24">🌿</text>
          <text x="240" y="70" font-size="26">🌱</text>
          <text x="225" y="235" font-size="22">✨</text>
          <!-- 머리 위 귀여운 새싹 -->
          <g transform="translate(145, 18)">
            <path d="M 0 25 Q -6 8 8 12 Q 5 25 0 25" fill="#4ade80" stroke="#166534" stroke-width="2.5"/>
            <path d="M 0 25 Q 6 6 -8 10 Q -5 25 0 25" fill="#22c55e" stroke="#166534" stroke-width="2.5"/>
            <circle cx="0" cy="25" r="2.5" fill="#15803d"/>
          </g>
        </svg>
      `;
      break;

    case 3:
      badgeIcon = '👑';
      frontHtml = `
        <svg class="evo-front-svg" viewBox="0 0 340 340">
          <defs>
            <linearGradient id="goldCrownGrad3" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#fffbeb"/>
              <stop offset="25%" stop-color="#fde047"/>
              <stop offset="70%" stop-color="#eab308"/>
              <stop offset="100%" stop-color="#ca8a04"/>
            </linearGradient>
            <filter id="crownGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#eab308" flood-opacity="0.6"/>
            </filter>
          </defs>
          <!-- 찬란한 황금 루비 왕관 (머리 볏 상단에 착용) -->
          <g transform="translate(132, 12)" filter="url(#crownGlow)">
            <polygon points="0,45 18,15 38,32 58,15 76,45" fill="url(#goldCrownGrad3)" stroke="#854d0e" stroke-width="3"/>
            <circle cx="18" cy="15" r="5" fill="#ef4444" stroke="#7f1d1d" stroke-width="1.5"/>
            <circle cx="38" cy="32" r="5.5" fill="#38bdf8" stroke="#0369a1" stroke-width="1.5"/>
            <circle cx="58" cy="15" r="5" fill="#ef4444" stroke="#7f1d1d" stroke-width="1.5"/>
            <circle cx="38" cy="40" r="3" fill="#ffffff"/>
          </g>
          <text x="35" y="85" font-size="24">✨</text>
          <text x="280" y="90" font-size="28">⭐</text>
          <text x="270" y="270" font-size="24">👑</text>
          <text x="40" y="260" font-size="22">✨</text>
        </svg>
      `;
      break;

    case 4:
      badgeIcon = '🪽';
      // 4단계: 에메랄드 비룡의 리얼 드래곤 날개 (뒤쪽 레이어)
      wingsHtml = `
        <svg class="evo-wings-svg" viewBox="0 0 520 380">
          <defs>
            <linearGradient id="emeraldWingSkin" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#6ee7b7" stop-opacity="0.95"/>
              <stop offset="30%" stop-color="#10b981" stop-opacity="0.95"/>
              <stop offset="70%" stop-color="#047857" stop-opacity="0.98"/>
              <stop offset="100%" stop-color="#064e3b" stop-opacity="1"/>
            </linearGradient>
            <linearGradient id="emeraldBoneGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="#ecfdf5"/>
              <stop offset="35%" stop-color="#10b981"/>
              <stop offset="80%" stop-color="#065f46"/>
              <stop offset="100%" stop-color="#022c22"/>
            </linearGradient>
            <radialGradient id="wingJointGlow4" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="#fef08a"/>
              <stop offset="70%" stop-color="#10b981"/>
              <stop offset="100%" stop-color="#064e3b"/>
            </radialGradient>
            <filter id="emeraldWingGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="6" stdDeviation="10" flood-color="#059669" flood-opacity="0.55"/>
            </filter>
          </defs>

          <!-- 좌측 리얼 드래곤 날개 -->
          <g class="dragon-wing-left" filter="url(#emeraldWingGlow)">
            <!-- 1. 드래곤 피막 (깊은 U자형 가죽 곡선) -->
            <path d="M 190 200 
                     C 150 130, 110 65, 75 55
                     C 30 75, 10 100, 0 125
                     C 12 155, 10 185, 10 215
                     C 22 250, 32 270, 50 295
                     C 70 315, 95 325, 115 330
                     C 145 315, 175 260, 190 200 Z"
                  fill="url(#emeraldWingSkin)" stroke="#064e3b" stroke-width="2.5"/>

            <!-- 2. 피막 내부 힘줄 및 날개막 주름선 -->
            <path d="M 75 55 Q 35 110 0 125" fill="none" stroke="#a7f3d0" stroke-width="2.5" opacity="0.85"/>
            <path d="M 75 55 Q 30 160 10 215" fill="none" stroke="#a7f3d0" stroke-width="2.5" opacity="0.85"/>
            <path d="M 75 55 Q 55 220 50 295" fill="none" stroke="#a7f3d0" stroke-width="2.5" opacity="0.85"/>
            <path d="M 75 55 Q 85 240 115 330" fill="none" stroke="#a7f3d0" stroke-width="2.5" opacity="0.85"/>

            <!-- 3. 주익 골격 (상완골 -> 손목 관절) -->
            <path d="M 190 200 C 150 130, 110 65, 75 55" 
                  fill="none" stroke="url(#emeraldBoneGrad)" stroke-width="9" stroke-linecap="round"/>
            <path d="M 190 200 C 150 130, 110 65, 75 55" 
                  fill="none" stroke="#ecfdf5" stroke-width="2.8" stroke-linecap="round" opacity="0.75"/>

            <!-- 손목 관절 둥근 마디 -->
            <circle cx="75" cy="55" r="7.5" fill="url(#wingJointGlow4)" stroke="#064e3b" stroke-width="2"/>

            <!-- 손목 상단 갈고리 엄지 발톱 -->
            <polygon points="75,55 58,36 78,42" fill="#facc15" stroke="#78350f" stroke-width="2"/>

            <!-- 손가락 끝 뾰족한 미세 발톱들 -->
            <circle cx="0" cy="125" r="3.5" fill="#facc15" stroke="#78350f" stroke-width="1.2"/>
            <circle cx="10" cy="215" r="3.5" fill="#facc15" stroke="#78350f" stroke-width="1.2"/>
            <circle cx="50" cy="295" r="3.5" fill="#facc15" stroke="#78350f" stroke-width="1.2"/>
            <circle cx="115" cy="330" r="3.5" fill="#facc15" stroke="#78350f" stroke-width="1.2"/>
          </g>

          <!-- 우측 리얼 드래곤 날개 -->
          <g class="dragon-wing-right" filter="url(#emeraldWingGlow)">
            <path d="M 330 200 
                     C 370 130, 410 65, 445 55
                     C 490 75, 510 100, 520 125
                     C 508 155, 510 185, 510 215
                     C 498 250, 488 270, 470 295
                     C 450 315, 425 325, 405 330
                     C 375 315, 345 260, 330 200 Z"
                  fill="url(#emeraldWingSkin)" stroke="#064e3b" stroke-width="2.5"/>

            <path d="M 445 55 Q 485 110 520 125" fill="none" stroke="#a7f3d0" stroke-width="2.5" opacity="0.85"/>
            <path d="M 445 55 Q 490 160 510 215" fill="none" stroke="#a7f3d0" stroke-width="2.5" opacity="0.85"/>
            <path d="M 445 55 Q 465 220 470 295" fill="none" stroke="#a7f3d0" stroke-width="2.5" opacity="0.85"/>
            <path d="M 445 55 Q 435 240 405 330" fill="none" stroke="#a7f3d0" stroke-width="2.5" opacity="0.85"/>

            <path d="M 330 200 C 370 130, 410 65, 445 55" 
                  fill="none" stroke="url(#emeraldBoneGrad)" stroke-width="9" stroke-linecap="round"/>
            <path d="M 330 200 C 370 130, 410 65, 445 55" 
                  fill="none" stroke="#ecfdf5" stroke-width="2.8" stroke-linecap="round" opacity="0.75"/>

            <circle cx="445" cy="55" r="7.5" fill="url(#wingJointGlow4)" stroke="#064e3b" stroke-width="2"/>
            <polygon points="445,55 462,36 442,42" fill="#facc15" stroke="#78350f" stroke-width="2"/>

            <circle cx="520" cy="125" r="3.5" fill="#facc15" stroke="#78350f" stroke-width="1.2"/>
            <circle cx="510" cy="215" r="3.5" fill="#facc15" stroke="#78350f" stroke-width="1.2"/>
            <circle cx="470" cy="295" r="3.5" fill="#facc15" stroke="#78350f" stroke-width="1.2"/>
            <circle cx="405" cy="330" r="3.5" fill="#facc15" stroke="#78350f" stroke-width="1.2"/>
          </g>
        </svg>
      `;

      // 4단계 전면 장식: 마법 에메랄드 크리스탈 & 오라
      frontHtml = `
        <svg class="evo-front-svg" viewBox="0 0 320 320">
          <text x="25" y="65" font-size="22">✨</text>
          <text x="275" y="65" font-size="22">✨</text>
          <text x="150" y="28" font-size="24">💎</text>
          <text x="260" y="260" font-size="20">🌿</text>
          <text x="35" y="260" font-size="20">🌿</text>
        </svg>
      `;
      break;

    case 5:
    default:
      badgeIcon = '🐉';
      // 5단계: 천상룡의 웅장한 황금 드래곤 날개 (뒤쪽 레이어)
      wingsHtml = `
        <svg class="evo-wings-svg" viewBox="0 0 520 380">
          <defs>
            <linearGradient id="goldWingSkin5" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#fffbeb" stop-opacity="0.95"/>
              <stop offset="25%" stop-color="#fde047" stop-opacity="0.95"/>
              <stop offset="55%" stop-color="#f59e0b" stop-opacity="0.98"/>
              <stop offset="85%" stop-color="#b45309" stop-opacity="0.98"/>
              <stop offset="100%" stop-color="#451a03" stop-opacity="1"/>
            </linearGradient>
            <linearGradient id="goldBoneGrad5" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="#ffffff"/>
              <stop offset="30%" stop-color="#fbbf24"/>
              <stop offset="70%" stop-color="#b45309"/>
              <stop offset="100%" stop-color="#451a03"/>
            </linearGradient>
            <radialGradient id="wingJointGlow5" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="#ffffff"/>
              <stop offset="60%" stop-color="#f59e0b"/>
              <stop offset="100%" stop-color="#78350f"/>
            </radialGradient>
            <filter id="dragonGoldGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#f59e0b" flood-opacity="0.65"/>
            </filter>
          </defs>

          <!-- 좌측 거대 황금 천상룡 날개 -->
          <g class="dragon-wing-left" filter="url(#dragonGoldGlow)">
            <!-- 1. 거대한 천상룡 피막 (5단 호형 가죽 곡선) -->
            <path d="M 190 200 
                     C 145 120, 105 50, 65 40
                     C 20 60, -5 90, -10 115
                     C 5 150, 0 180, 2 210
                     C 15 245, 25 270, 42 295
                     C 65 320, 90 330, 112 338
                     C 145 325, 175 265, 190 200 Z"
                  fill="url(#goldWingSkin5)" stroke="#78350f" stroke-width="3"/>

            <!-- 2. 황금빛 마그마 힘줄 라인 -->
            <path d="M 65 40 Q 25 95 -10 115" fill="none" stroke="#fef08a" stroke-width="3" opacity="0.9"/>
            <path d="M 65 40 Q 20 150 2 210" fill="none" stroke="#fef08a" stroke-width="3" opacity="0.9"/>
            <path d="M 65 40 Q 45 215 42 295" fill="none" stroke="#fef08a" stroke-width="3" opacity="0.9"/>
            <path d="M 65 40 Q 80 235 112 338" fill="none" stroke="#fef08a" stroke-width="3" opacity="0.9"/>

            <!-- 3. 주익 골격 및 관절 -->
            <path d="M 190 200 C 145 120, 105 50, 65 40" 
                  fill="none" stroke="url(#goldBoneGrad5)" stroke-width="11" stroke-linecap="round"/>
            <path d="M 190 200 C 145 120, 105 50, 65 40" 
                  fill="none" stroke="#fffbeb" stroke-width="3.5" stroke-linecap="round" opacity="0.85"/>

            <!-- 관절 볼 & 황금 드래곤 발톱들 -->
            <circle cx="65" cy="40" r="9" fill="url(#wingJointGlow5)" stroke="#78350f" stroke-width="2.5"/>
            <!-- 뾰족한 이중 황금 스파이크 엄지 발톱 -->
            <polygon points="65,40 45,18 70,25" fill="#fef08a" stroke="#78350f" stroke-width="2"/>
            <polygon points="65,40 50,32 58,45" fill="#fbbf24" stroke="#78350f" stroke-width="1.5"/>

            <circle cx="-10" cy="115" r="4" fill="#fef08a" stroke="#78350f" stroke-width="1.5"/>
            <circle cx="2" cy="210" r="4" fill="#fef08a" stroke="#78350f" stroke-width="1.5"/>
            <circle cx="42" cy="295" r="4" fill="#fef08a" stroke="#78350f" stroke-width="1.5"/>
            <circle cx="112" cy="338" r="4" fill="#fef08a" stroke="#78350f" stroke-width="1.5"/>
          </g>

          <!-- 우측 거대 황금 천상룡 날개 -->
          <g class="dragon-wing-right" filter="url(#dragonGoldGlow)">
            <path d="M 330 200 
                     C 375 120, 415 50, 455 40
                     C 500 60, 525 90, 530 115
                     C 515 150, 520 180, 518 210
                     C 505 245, 495 270, 478 295
                     C 455 320, 430 330, 408 338
                     C 375 325, 345 265, 330 200 Z"
                  fill="url(#goldWingSkin5)" stroke="#78350f" stroke-width="3"/>

            <path d="M 455 40 Q 495 95 530 115" fill="none" stroke="#fef08a" stroke-width="3" opacity="0.9"/>
            <path d="M 455 40 Q 500 150 518 210" fill="none" stroke="#fef08a" stroke-width="3" opacity="0.9"/>
            <path d="M 455 40 Q 475 215 478 295" fill="none" stroke="#fef08a" stroke-width="3" opacity="0.9"/>
            <path d="M 455 40 Q 440 235 408 338" fill="none" stroke="#fef08a" stroke-width="3" opacity="0.9"/>

            <path d="M 330 200 C 375 120, 415 50, 455 40" 
                  fill="none" stroke="url(#goldBoneGrad5)" stroke-width="11" stroke-linecap="round"/>
            <path d="M 330 200 C 375 120, 415 50, 455 40" 
                  fill="none" stroke="#fffbeb" stroke-width="3.5" stroke-linecap="round" opacity="0.85"/>

            <circle cx="455" cy="40" r="9" fill="url(#wingJointGlow5)" stroke="#78350f" stroke-width="2.5"/>
            <polygon points="455,40 475,18 450,25" fill="#fef08a" stroke="#78350f" stroke-width="2"/>
            <polygon points="455,40 470,32 462,45" fill="#fbbf24" stroke="#78350f" stroke-width="1.5"/>

            <circle cx="530" cy="115" r="4" fill="#fef08a" stroke="#78350f" stroke-width="1.5"/>
            <circle cx="518" cy="210" r="4" fill="#fef08a" stroke="#78350f" stroke-width="1.5"/>
            <circle cx="478" cy="295" r="4" fill="#fef08a" stroke="#78350f" stroke-width="1.5"/>
            <circle cx="408" cy="338" r="4" fill="#fef08a" stroke="#78350f" stroke-width="1.5"/>
          </g>
        </svg>
      `;

      // 5단계 전면 장식: 크레 볏 위로 솟아오른 웅장한 드래곤 뿔 + 여의주 루비 코어 + 화염 오라
      frontHtml = `
        <svg class="evo-front-svg" viewBox="0 0 340 340">
          <defs>
            <linearGradient id="dragonHornGrad" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stop-color="#78350f"/>
              <stop offset="35%" stop-color="#b45309"/>
              <stop offset="70%" stop-color="#f59e0b"/>
              <stop offset="100%" stop-color="#fef08a"/>
            </linearGradient>
            <radialGradient id="rubyCoreGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="#ffffff"/>
              <stop offset="30%" stop-color="#f87171"/>
              <stop offset="70%" stop-color="#dc2626"/>
              <stop offset="100%" stop-color="#7f1d1d"/>
            </radialGradient>
            <filter id="dragonHeadGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="5" stdDeviation="8" flood-color="#f59e0b" flood-opacity="0.75"/>
            </filter>
          </defs>

          <!-- 1. 머리 볏 양옆으로 솟구친 트윈 드래곤 뿔 (Twin Dragon Horns) -->
          <g filter="url(#dragonHeadGlow)">
            <!-- 좌측 뿔 -->
            <path d="M 125 110 Q 100 45 75 15 Q 115 55 145 100 Z" 
                  fill="url(#dragonHornGrad)" stroke="#78350f" stroke-width="2.5"/>
            <!-- 좌측 뿔 주름선 -->
            <path d="M 112 80 Q 98 55 88 35" fill="none" stroke="#fef08a" stroke-width="2" opacity="0.8"/>

            <!-- 우측 뿔 -->
            <path d="M 215 110 Q 240 45 265 15 Q 225 55 195 100 Z" 
                  fill="url(#dragonHornGrad)" stroke="#78350f" stroke-width="2.5"/>
            <!-- 우측 뿔 주름선 -->
            <path d="M 228 80 Q 242 55 252 35" fill="none" stroke="#fef08a" stroke-width="2" opacity="0.8"/>
          </g>

          <!-- 2. 이마 중앙의 신성한 용의 여의주 루비 젬 (Dragon Pearl Core) -->
          <g filter="url(#dragonHeadGlow)" transform="translate(170, 75)">
            <polygon points="0,-18 16,0 0,18 -16,0" fill="url(#rubyCoreGlow)" stroke="#fef08a" stroke-width="2.5"/>
            <circle cx="0" cy="0" r="4.5" fill="#ffffff" opacity="0.95"/>
          </g>

          <!-- 3. 드래곤 각성 화염 및 번개 오라 -->
          <text x="15" y="45" font-size="28">🔥</text>
          <text x="295" y="45" font-size="28">🔥</text>
          <text x="20" y="275" font-size="24">⚡</text>
          <text x="295" y="275" font-size="24">⚡</text>
          <text x="155" y="335" font-size="28">🐉</text>
        </svg>
      `;
      break;
  }

  // 새 이미지에 날개와 뿔이 포함되어 있어 SVG 장식이 겹치지 않도록 합니다.
  if (stage >= 4) {
    wingsHtml = '';
    frontHtml = '';
  }

  return `
    <div class="gecko-avatar-display evo-stage-${stage}">
      ${stage >= 3 ? `<div class="evolution-aura" aria-hidden="true"><div class="aura-halo"></div><div class="aura-rays"></div><div class="aura-ring"></div>${Array.from({ length: stage === 5 ? 12 : stage === 4 ? 7 : 4 }, (_, i) => `<span class="aura-particle" style="--angle:${i * 360 / (stage === 5 ? 12 : stage === 4 ? 7 : 4)}deg;--delay:${-i * 0.43}s"></span>`).join('')}</div>` : ''}
      ${wingsHtml ? `<div class="gecko-wings-layer">${wingsHtml}</div>` : ''}
      <div class="gecko-photo-frame">
        <img src="${photoSrc}" alt="${stage === 5 ? '완전히 진화한 황금 드래곤 크림이' : stage === 4 ? '작은 날개가 돋은 게코 크림이' : '크리스티드 게코 크림이'}" class="gecko-real-photo">
      </div>
      ${frontHtml ? `<div class="gecko-front-layer">${frontHtml}</div>` : ''}
      <div class="sparkle-badge">${badgeIcon}</div>
    </div>
  `;
}

// 단계 정보 반환 (이름, 뱃지, 설명, 대사)
function getStageMetadata(streak) {
  if (streak >= 30) {
    return {
      stage: 5,
      badge: '5단계 (최종 진화)',
      name: '신화의 천상룡 크림이 (Grand Celestial Dragon)',
      desc: '30일의 정성 어린 보살핌으로 크림이가 전설 속의 위대한 천상룡 드래곤으로 완전 진화했습니다! 웅장한 날개와 황금빛 뿔, 신비로운 용의 축복이 깃들어 있습니다.',
      speech: '집사님의 사랑으로 마침내 진정한 드래곤으로 각성했어요! 이제 크림이가 집사님을 영원히 지켜줄게요! 🐉✨🔥',
      nextText: '🎉 30일 완성! 최종 진화 달성!'
    };
  } else if (streak >= 21) {
    return {
      stage: 4,
      badge: '4단계',
      name: '전설의 날개 크림이 (Winged Drake)',
      desc: '등에 신비로운 마법의 드래곤 날개가 돋아났습니다. 드래곤의 힘이 깨어나며 작은 바람을 일으키며 날갯짓해요!',
      speech: '우와! 등에 작고 예쁜 날개가 생겼어요! 30일이 되면 진짜 하늘을 나는 드래곤이 될 수 있대요! 🪽💚',
      nextText: `최종 드래곤까지: ${30 - streak}일 남음 (30일차)`
    };
  } else if (streak >= 14) {
    return {
      stage: 3,
      badge: '3단계',
      name: '위풍당당 성체 크림이 (Adult Crowned)',
      desc: '머리의 왕관 볏(Crest)과 황금빛 등 라인이 완벽하게 자리 잡은 건강하고 듬직한 성체 크림이입니다.',
      speech: '제 머리 볏이 황금 왕관처럼 정말 멋지게 자랐죠? 늠름한 크림이랍니다! 👑🦎',
      nextText: `다음 진화(날개 크림이)까지: ${21 - streak}일 남음 (21일차)`
    };
  } else if (streak >= 7) {
    return {
      stage: 2,
      badge: '2단계',
      name: '장난꾸러기 주니어 크림이 (Junior Creamie)',
      desc: '몸집이 조금씩 자라고 고유의 아름다운 모프 발색이 선명해지며 호기심이 왕성해졌습니다. 손가락 위를 뽈뽈 타고 노는 걸 제일 좋아해요!',
      speech: '집사님 손바닥 위가 제일 따뜻하고 편해요~ 낼름! 슈푸 주실 거죠? 🌿',
      nextText: `다음 진화(성체 크림이)까지: ${14 - streak}일 남음 (14일차)`
    };
  } else {
    return {
      stage: 1,
      badge: '1단계',
      name: '아기 크레 크림이 (Baby Creamie)',
      desc: '동그란 눈망울과 앙증맞은 속눈썹을 가진 귀여운 아기 게코 크림이입니다. 30일 연속 출석하면 전설의 천상룡으로 진화해요!',
      speech: '집사님 안녕! 나 크림이야~ 오늘도 나 보러 와줘서 너무 좋아! 🦎💕',
      nextText: `다음 진화(주니어 크림이)까지: ${7 - streak}일 남음 (7일차)`
    };
  }
}

// ==========================================
// 5. 로컬스토리지 저장 및 복원 (Persistence)
// ==========================================
function saveStorage() {
  localStorage.setItem('gecko_app_state', JSON.stringify({
    ownerName: AppState.ownerName,
    pet: AppState.pet,
    attendance: AppState.attendance,
    soundEnabled: AppState.soundEnabled,
    geminiApiKey: AppState.geminiApiKey,
    todos: AppState.todos,
    diaries: window.GeckoCloud?.enabled ? window.GeckoCloud.localRecords() : AppState.diaries,
    weeklyRoutines: AppState.weeklyRoutines,
    chatHistory: AppState.chatHistory
  }));
}

function loadStorage() {
  const saved = localStorage.getItem('gecko_app_state');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (typeof parsed.ownerName === 'string') AppState.ownerName = parsed.ownerName.trim().slice(0, 30);
      if (parsed.pet) AppState.pet = parsed.pet;
      if (parsed.attendance) AppState.attendance = parsed.attendance;
      if (parsed.soundEnabled !== undefined) AppState.soundEnabled = parsed.soundEnabled;
      if (parsed.geminiApiKey) AppState.geminiApiKey = parsed.geminiApiKey;
      if (parsed.todos && parsed.todos.length > 0) AppState.todos = parsed.todos;
      if (parsed.diaries) AppState.diaries = parsed.diaries;
      if (Array.isArray(parsed.weeklyRoutines) && parsed.weeklyRoutines.length === 7 &&
          parsed.weeklyRoutines.every(item => item && typeof item.feed === 'string' && typeof item.tasks === 'string')) {
        AppState.weeklyRoutines = parsed.weeklyRoutines.map((item, index) => ({
          day: DEFAULT_WEEKLY_ROUTINES[index].day,
          feed: item.feed.slice(0, 100),
          tasks: item.tasks.slice(0, 2000)
        }));
      }
      if (parsed.chatHistory) AppState.chatHistory = parsed.chatHistory;
    } catch (e) {
      console.error('Failed to parse localStorage', e);
    }
  }

  // 1회성 초기화 마이그레이션: 사용자가 직접 오늘 출석 버튼을 클릭해야 1일차가 되도록 초기화
  const resetKey = 'gecko_zero_streak_reset_v7';
  if (!localStorage.getItem(resetKey)) {
    AppState.attendance.streak = 0;
    AppState.attendance.history = [];
    AppState.attendance.lastChecked = null;
    AppState.previewDay = null;
    localStorage.setItem(resetKey, 'true');
    saveStorage();
  }

  // 기존 '초코' 이름 데이터 자동 마이그레이션
  if (!AppState.pet || !AppState.pet.name || AppState.pet.name === '초코') {
    AppState.pet.name = '크림';
    saveStorage();
  }
}

function getTodayString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ==========================================
// 6. UI 렌더링 함수들
// ==========================================

// 캐릭터 및 출석 렌더링 (previewStreak이 주어지면 실제 streak은 보존하고 아바타 외형만 미리보기!)
function renderCharacterAndStreak(previewStreak = null) {
  const isPreview = previewStreak !== null;
  const displayStreak = isPreview ? previewStreak : AppState.attendance.streak;
  const meta = getStageMetadata(displayStreak);
  AppState.currentStage = meta.stage;

  // 1. 실사 아바타 & 리얼 드래곤 날개/진화 오버레이 렌더
  const svgWrapper = document.getElementById('gecko-svg-wrapper');
  if (svgWrapper) {
    svgWrapper.innerHTML = getGeckoDisplay(meta.stage);
  }

  // 2. 텍스트 정보 업데이트
  // 미리보기 시에는 미리보기 전용 뱃지 및 안내 문구 노출
  document.getElementById('stage-badge').textContent = isPreview 
    ? `👀 체험 미리보기 (${meta.badge})` 
    : meta.badge;
  document.getElementById('stage-name').textContent = meta.name;
  document.getElementById('stage-description').textContent = meta.desc;

  const speechText = isPreview
    ? `[${meta.name} 체험 미리보기 중! ✨] ${meta.speech} (도마뱀 아바타를 클릭하면 내 실제 크림이로 돌아와요!)`
    : meta.speech;
  document.getElementById('character-speech').querySelector('.speech-text').textContent = personalizeOwnerText(speechText);

  // 다음 진화 안내는 실제 내 streak 기준
  const realMeta = getStageMetadata(AppState.attendance.streak);
  document.getElementById('next-evo-info').innerHTML = realMeta.nextText;

  // 실제 출석일수 숫자 (미리보기를 눌러도 streak-count는 절대 변하지 않고 실제 출석일 유지!)
  document.getElementById('streak-count').textContent = AppState.attendance.streak;

  // 3. 프로그레스 바 계산 (실제 streak 기준, 0일이면 0%)
  const percent = Math.min(100, Math.max(0, (AppState.attendance.streak / 30) * 100));
  document.getElementById('evolution-progress-bar').style.width = `${percent}%`;

  // 4. 출석 스텝 마커 active 표시 (실제 내 출석 기준!)
  const stepPoints = document.querySelectorAll('.evolution-steps-indicator .step-point');
  const thresholds = [1, 7, 14, 21, 30];
  stepPoints.forEach((point, idx) => {
    if (AppState.attendance.streak >= thresholds[idx]) {
      point.classList.add('active');
    } else {
      point.classList.remove('active');
    }
  });

  // 5. 프로필 바 업데이트
  document.getElementById('pet-display-name').textContent = AppState.pet.name;
  document.getElementById('pet-display-morph').textContent = AppState.pet.morph;

  // D-Day 계산
  if (AppState.pet.adoptedDate) {
    const adopt = new Date(AppState.pet.adoptedDate);
    const now = new Date();
    const diffTime = Math.abs(now - adopt);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    document.getElementById('pet-display-dday').textContent = `함께한 지 ${diffDays}일째`;
  }

  // 6. 오늘 출석 버튼 상태 (실제 attendance.history 기준!)
  const todayStr = getTodayString();
  const btnCheckin = document.getElementById('btn-checkin');
  const checkinText = document.getElementById('checkin-btn-text');
  if (AppState.attendance.history.includes(todayStr)) {
    btnCheckin.classList.add('checked');
    checkinText.textContent = `오늘 출석 완료! (내일 또 만나요 🐾)`;
    btnCheckin.title = '오늘은 이미 출석 도장을 찍었습니다.';
  } else {
    btnCheckin.classList.remove('checked');
    checkinText.textContent = '오늘 출석체크 도장 찍기!';
    btnCheckin.title = '오늘의 출석 도장을 찍고 크림이를 진화시키세요!';
  }

  // 7. 미리보기 모드 복귀 버튼 토글
  const restoreBtn = document.getElementById('btn-restore-preview');
  if (restoreBtn) {
    restoreBtn.style.display = isPreview ? 'inline-block' : 'none';
  }
}

// 30일 스탬프 모달 렌더링
function renderStampBoard() {
  const board = document.getElementById('stamp-board');
  if (!board) return;
  board.innerHTML = '';

  const streak = AppState.attendance.streak;
  for (let i = 1; i <= 30; i++) {
    const isStamped = i <= streak;
    const isDragonDay = i === 30;
    
    let icon = isStamped ? '🐾' : '⚪';
    if (isDragonDay) {
      icon = isStamped ? '🐉' : '🥚';
    }

    const cell = document.createElement('div');
    cell.className = `stamp-cell ${isStamped ? 'stamped' : ''} ${isDragonDay ? 'dragon-day' : ''}`;
    cell.innerHTML = `
      <span class="stamp-day-num">${i}일차</span>
      <span class="stamp-mark">${icon}</span>
    `;
    board.appendChild(cell);
  }
}

// 스케줄 투두리스트 렌더링
function renderTodoList() {
  const listEl = document.getElementById('todo-list');
  if (!listEl) return;
  listEl.innerHTML = '';

  let doneCount = 0;
  AppState.todos.forEach(todo => {
    if (todo.done) doneCount++;

    const li = document.createElement('li');
    li.className = `todo-item ${todo.done ? 'done' : ''}`;
    li.innerHTML = `
      <input type="checkbox" class="todo-checkbox" ${todo.done ? 'checked' : ''} data-id="${todo.id}">
      <div class="todo-body">
        <span class="todo-title">${escapeHtml(todo.text)}</span>
        <span class="todo-tag">${escapeHtml(todo.tag || '일반')}</span>
      </div>
      <button class="todo-delete" data-id="${todo.id}" title="삭제">✕</button>
    `;
    listEl.appendChild(li);
  });

  const total = AppState.todos.length;
  const pct = total === 0 ? 0 : Math.round((doneCount / total) * 100);
  document.getElementById('todo-percent').textContent = `${pct}%`;
  document.getElementById('todo-progress-bar').style.width = `${pct}%`;
}

// 주간 케어 사이클 렌더링
function renderWeeklyCycle() {
  const grid = document.getElementById('weekly-cycle-grid');
  if (!grid) return;

  const todayIdx = new Date().getDay();

  grid.innerHTML = '';
  // 월요일부터 일요일 순으로 정렬 표시
  const order = [1, 2, 3, 4, 5, 6, 0];
  order.forEach(dayIdx => {
    const item = AppState.weeklyRoutines[dayIdx];
    const isToday = dayIdx === todayIdx;

    const div = document.createElement('div');
    div.className = `day-card ${isToday ? 'today' : ''}`;
    div.innerHTML = `
      <div class="day-name">${escapeHtml(item.day)} ${isToday ? '<span style="color:var(--primary); font-size:0.75rem;">(오늘)</span>' : ''}</div>
      <div class="day-badge-feed">${escapeHtml(item.feed)}</div>
      <div class="day-tasks">${escapeHtml(item.tasks).replace(/\n/g, '<br>')}</div>
    `;
    grid.appendChild(div);
  });
}

function setWeeklyScheduleEditing(editing) {
  const form = document.getElementById('weekly-schedule-form');
  const button = document.getElementById('btn-edit-weekly');
  form.classList.toggle('hidden', !editing);
  document.getElementById('weekly-cycle-grid').classList.toggle('hidden', editing);
  button.setAttribute('aria-expanded', String(editing));
  button.textContent = editing ? '수정 닫기' : '✏️ 수정';
  if (!editing) return;
  document.getElementById('weekly-schedule-fields').innerHTML = [1, 2, 3, 4, 5, 6, 0].map(index => {
    const item = AppState.weeklyRoutines[index];
    return `<fieldset class="weekly-edit-day">
      <legend>${item.day}</legend>
      <div class="form-group">
        <label for="weekly-feed-${index}">급여 / 주제</label>
        <input id="weekly-feed-${index}" type="text" maxlength="100" required value="${escapeHtml(item.feed)}">
      </div>
      <div class="form-group">
        <label for="weekly-tasks-${index}">케어 내용 (한 줄에 한 항목)</label>
        <textarea id="weekly-tasks-${index}" rows="5" maxlength="2000">${escapeHtml(item.tasks)}</textarea>
      </div>
    </fieldset>`;
  }).join('');
  document.getElementById('weekly-feed-1').focus();
}

function saveWeeklySchedule(event) {
  event.preventDefault();
  const routines = DEFAULT_WEEKLY_ROUTINES.map((item, index) => ({
    day: item.day,
    feed: document.getElementById(`weekly-feed-${index}`).value.trim(),
    tasks: document.getElementById(`weekly-tasks-${index}`).value.trim()
  }));
  for (let index = 0; index < routines.length; index++) {
    if (!routines[index].feed) {
      const input = document.getElementById(`weekly-feed-${index}`);
      input.setCustomValidity('급여 또는 주제를 입력해주세요.');
      input.reportValidity();
      input.addEventListener('input', () => input.setCustomValidity(''), { once: true });
      return;
    }
  }
  const previous = AppState.weeklyRoutines;
  AppState.weeklyRoutines = routines;
  try {
    saveStorage();
  } catch (error) {
    AppState.weeklyRoutines = previous;
    alert('저장 공간에 스케줄을 저장하지 못했습니다. 브라우저 저장 공간을 확인해주세요.');
    return;
  }
  renderWeeklyCycle();
  setWeeklyScheduleEditing(false);
  document.getElementById('weekly-save-status').textContent = '주간 스케줄을 저장했습니다.';
  document.getElementById('btn-edit-weekly').focus();
}

// 온습도 상태 배지 업데이트
function updateEnvStatus() {
  const tempInput = document.getElementById('input-current-temp');
  const humInput = document.getElementById('input-current-humidity');
  const tempBadge = document.getElementById('temp-status-badge');
  const humBadge = document.getElementById('humidity-status-badge');
  const tipText = document.getElementById('env-care-tip');

  if (!tempInput || !humInput) return;

  const temp = parseFloat(tempInput.value) || 24;
  const hum = parseFloat(humInput.value) || 70;

  // 온도 판정 (적정 22~26도)
  if (temp < 20) {
    tempBadge.textContent = '위험: 너무 추움 (20°C 미만)';
    tempBadge.className = 'dial-status danger';
    tipText.innerHTML = '⚠️ <strong>저온 경고:</strong> 온도가 20°C 이하로 떨어지면 도마뱀의 소화 능력이 멈추고 면역력이 급격히 떨어집니다. 전기장판이나 필름 히터로 23~25°C를 유지해주세요!';
  } else if (temp < 22) {
    tempBadge.textContent = '주의: 다소 쌀쌀함';
    tempBadge.className = 'dial-status warn';
  } else if (temp <= 26.5) {
    tempBadge.textContent = '쾌적: 완벽한 적정 온도';
    tempBadge.className = 'dial-status safe';
    tipText.innerHTML = '💡 <strong>쾌적 상태:</strong> 22~26°C는 크레스티드 게코가 가장 활발하고 건강하게 소화하는 이상적인 온도 범위입니다!';
  } else if (temp <= 28) {
    tempBadge.textContent = '주의: 다소 더움';
    tempBadge.className = 'dial-status warn';
  } else {
    tempBadge.textContent = '위험: 고온 쇼크 주의!';
    tempBadge.className = 'dial-status danger';
    tipText.innerHTML = '🚨 <strong>고온 경고:</strong> 크레스티드 게코는 28°C 이상의 열기에 매우 취약하여 폐사할 수 있습니다! 사육장에 쿨링팬을 켜거나 시원한 곳으로 이동해주세요!';
  }

  // 습도 판정 (적정 60~80%)
  if (hum < 50) {
    humBadge.textContent = '위험: 매우 건조함';
    humBadge.className = 'dial-status danger';
  } else if (hum < 60) {
    humBadge.textContent = '주의: 건조함 (탈피부전 위험)';
    humBadge.className = 'dial-status warn';
  } else if (hum <= 80) {
    humBadge.textContent = '촉촉: 이상적인 습도';
    humBadge.className = 'dial-status safe';
  } else {
    humBadge.textContent = '주의: 과습 환기 필요';
    humBadge.className = 'dial-status warn';
  }
}

// 다이어리 목록 및 체중 차트 렌더링
function renderDiary() {
  const listEl = document.getElementById('diary-list');
  const countEl = document.getElementById('diary-count-text');
  if (!listEl) return;

  listEl.innerHTML = '';
  countEl.textContent = `총 ${AppState.diaries.length}개의 기록`;

  if (AppState.diaries.length === 0) {
    listEl.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">
        아직 작성된 일기가 없습니다. 위 양식에서 첫 번째 관찰 일기를 남겨보세요! ✍️
      </div>
    `;
  } else {
    // 최신순 정렬
    const sorted = [...AppState.diaries].sort((a, b) => new Date(b.date) - new Date(a.date));
    sorted.forEach(entry => {
      const card = document.createElement('div');
      card.className = 'diary-card';
      card.innerHTML = `
        <button class="diary-card-delete" data-id="${entry.id}" title="기록 삭제">✕</button>
        <div class="diary-card-header">
          <span class="diary-card-date">📅 ${escapeHtml(entry.date)}</span>
          <span class="diary-card-weight">${entry.weight ? `${entry.weight} g` : ''}</span>
        </div>
        <div class="diary-card-badges">
          <span class="diary-badge">${escapeHtml(entry.feed)}</span>
          <span class="diary-badge">${escapeHtml(entry.poop)}</span>
          <span class="diary-badge">${escapeHtml(entry.shed)}</span>
        </div>
        ${entry.photoUrl ? `
          <div class="diary-card-photo">
            <img src="${escapeHtml(entry.photoUrl)}" alt="일기 사진">
          </div>
        ` : ''}
        ${entry.notes ? `<div class="diary-card-notes">${escapeHtml(entry.notes)}</div>` : ''}
      `;
      listEl.appendChild(card);
    });
  }

  // 체중 그래프 렌더
  renderWeightChart();
}

// 캔버스 체중 그래프 그리기
function renderWeightChart() {
  const canvas = document.getElementById('weight-chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  
  // 캔버스 DPI 보정
  const width = canvas.clientWidth || 560;
  const height = canvas.clientHeight || 220;
  canvas.width = width * 2;
  canvas.height = height * 2;
  ctx.scale(2, 2);

  ctx.clearRect(0, 0, width, height);

  // 체중 기록이 있는 데이터만 날짜순 정렬
  const data = AppState.diaries
    .filter(d => d.weight && parseFloat(d.weight) > 0)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  // 현재 성장 단계 배지 업데이트
  const phaseBadge = document.getElementById('current-growth-phase');
  if (data.length > 0) {
    const latestWeight = parseFloat(data[data.length - 1].weight);
    if (latestWeight < 10) {
      phaseBadge.textContent = `현재: 베이비/해츨링 단계 (${latestWeight}g)`;
    } else if (latestWeight < 25) {
      phaseBadge.textContent = `현재: 아성체 성장기 (${latestWeight}g)`;
    } else {
      phaseBadge.textContent = `현재: 준성체/성체 도마뱀 (${latestWeight}g)`;
    }
  } else {
    phaseBadge.textContent = '체중 데이터 대기 중';
  }

  const padding = { top: 20, right: 30, bottom: 35, left: 45 };
  const graphWidth = width - padding.left - padding.right;
  const graphHeight = height - padding.top - padding.bottom;

  // 가이드 기준선 (10g, 25g, 40g)
  const maxWeight = Math.max(45, ...(data.map(d => parseFloat(d.weight))));
  
  // Y축 눈금선
  ctx.strokeStyle = '#e8e0d0';
  ctx.lineWidth = 1;
  ctx.fillStyle = '#9f9488';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'right';

  const ySteps = [10, 25, 40];
  ySteps.forEach(val => {
    const y = padding.top + graphHeight - (val / maxWeight) * graphHeight;
    ctx.beginPath();
    ctx.setLineDash([4, 4]);
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillText(`${val}g`, padding.left - 6, y + 4);
  });

  if (data.length === 0) {
    ctx.fillStyle = '#a89c8d';
    ctx.textAlign = 'center';
    ctx.font = '13px sans-serif';
    ctx.fillText('다이어리에 몸무게를 기록하면 성장 곡선이 그려집니다!', width / 2, height / 2);
    return;
  }

  // 데이터 포인트 좌표 계산
  const points = data.map((d, idx) => {
    const x = data.length === 1 
      ? padding.left + graphWidth / 2 
      : padding.left + (idx / (data.length - 1)) * graphWidth;
    const y = padding.top + graphHeight - (parseFloat(d.weight) / maxWeight) * graphHeight;
    return { x, y, weight: d.weight, date: d.date };
  });

  // 선 그래프 그리기
  ctx.beginPath();
  ctx.strokeStyle = '#4e7354';
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  points.forEach((p, idx) => {
    if (idx === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.stroke();

  // 면 채우기 (그라데이션)
  if (points.length > 1) {
    const grad = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
    grad.addColorStop(0, 'rgba(78, 115, 84, 0.25)');
    grad.addColorStop(1, 'rgba(78, 115, 84, 0.0)');
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.lineTo(points[points.length - 1].x, height - padding.bottom);
    ctx.lineTo(points[0].x, height - padding.bottom);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
  }

  // 포인트 원형 및 텍스트 표시
  points.forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#c86d42';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // 상단 체중 레이블
    ctx.fillStyle = '#38312b';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${p.weight}g`, p.x, p.y - 10);

    // 하단 날짜
    ctx.fillStyle = '#8c7e6f';
    ctx.font = '10px sans-serif';
    const shortDate = p.date.substring(5); // MM-DD
    ctx.fillText(shortDate, p.x, height - padding.bottom + 16);
  });
}

// ==========================================
// 7. AI 사진 건강 진단 (Vision Analysis)
// ==========================================

let visionAnalysisInProgress = false;
let activeVisionSession = null;
let visionDetections = [];

function getContainedImageBounds(areaWidth, areaHeight, imageWidth, imageHeight) {
  if (![areaWidth, areaHeight, imageWidth, imageHeight].every(value => Number.isFinite(value) && value > 0)) return null;
  const scale = Math.min(areaWidth / imageWidth, areaHeight / imageHeight);
  const width = imageWidth * scale;
  const height = imageHeight * scale;
  return { width, height, left: (areaWidth - width) / 2, top: (areaHeight - height) / 2 };
}

function getSmoothGeckoContourPath(contour, imageWidth, imageHeight) {
  const points = contour.map(([y, x]) => [x * imageWidth / 1000, y * imageHeight / 1000]);
  const between = (a, b, ratio) => a.map((value, axis) => value + (b[axis] - value) * ratio);
  const format = point => point.map(value => Number(value.toFixed(3))).join(',');
  // Round each corner within its adjacent edges so narrow tails and toes do not overshoot.
  const start = between(points[0], points[points.length - 1], 0.25);
  const segments = points.map((point, index) => {
    const previous = points[(index + points.length - 1) % points.length];
    const next = points[(index + 1) % points.length];
    const entry = between(point, previous, 0.25);
    const exit = between(point, next, 0.25);
    return `L ${format(entry)} Q ${format(point)} ${format(exit)}`;
  });
  return `M ${format(start)} ${segments.join(' ')} Z`;
}

function renderGeckoDetections() {
  const overlay = document.getElementById('gecko-detection-overlay');
  const area = document.getElementById('preview-area');
  const image = document.getElementById('preview-img');
  const bounds = getContainedImageBounds(area.clientWidth, area.clientHeight, image.naturalWidth, image.naturalHeight);
  overlay.innerHTML = '';
  if (!bounds || !visionDetections.length) return;
  Object.assign(overlay.style, { width: `${bounds.width}px`, height: `${bounds.height}px`, left: `${bounds.left}px`, top: `${bounds.top}px` });
  const colors = ['#50f0a0', '#64caff', '#ffe16b', '#ff90d2', '#bba0ff'];
  const paths = visionDetections.map((detection, index) => {
    const path = getSmoothGeckoContourPath(detection.contour, image.naturalWidth, image.naturalHeight);
    return `<path d="${path}" class="gecko-contour-shadow"/><path d="${path}" class="gecko-contour" style="stroke:${colors[index % colors.length]}"/>`;
  }).join('');
  const labels = visionDetections.map((detection, index) => {
    const top = Math.min(...detection.contour.map(point => point[0])) / 10;
    const left = Math.min(...detection.contour.map(point => point[1])) / 10;
    return `<span class="gecko-detection-label" style="left:${left}%;top:${top}%;background:${colors[index % colors.length]}">도마뱀 ${index + 1}</span>`;
  }).join('');
  overlay.innerHTML = `<svg class="gecko-contour-svg" viewBox="0 0 ${image.naturalWidth} ${image.naturalHeight}" preserveAspectRatio="none" aria-hidden="true">${paths}</svg>${labels}`;
}

function clearGeckoDetections() {
  visionDetections = [];
  document.getElementById('gecko-detection-overlay').innerHTML = '';
}

function resetVisionReport(message = '실제 도마뱀 사진을 올리면 자동으로 분석을 시작합니다.') {
  clearGeckoDetections();
  document.getElementById('analysis-loading').classList.add('hidden');
  document.getElementById('scanner-laser').classList.remove('scanning');
  document.getElementById('report-timestamp').textContent = '사진 분석 대기 중';
  const badge = document.getElementById('overall-score-badge');
  badge.className = 'health-score-badge caution';
  badge.textContent = '대기 중';
  document.getElementById('report-content').classList.remove('hidden');
  document.getElementById('report-content').innerHTML = `<div class="empty-state-box"><div class="empty-icon">🦎🔍</div><p>${escapeHtml(message)}</p></div>`;
}

function showImagePreview(dataUrl, sampleType = null) {
  if (visionAnalysisInProgress) return;
  AppState.currentImageBase64 = null;
  AppState.currentSampleType = sampleType;
  resetVisionReport();
  const previewImg = document.getElementById('preview-img');
  const btnRun = document.getElementById('btn-run-analysis');
  btnRun.disabled = true;
  document.getElementById('preview-area').classList.remove('hidden');
  document.getElementById('dropzone-prompt').classList.add('hidden');
  previewImg.onload = () => {
    previewImg.onload = null;
    AppState.currentImageBase64 = dataUrl;
    btnRun.disabled = false;
    renderGeckoDetections();
    runVisionAnalysis();
  };
  previewImg.onerror = () => {
    AppState.currentImageBase64 = null;
    btnRun.disabled = true;
    resetVisionReport('사진을 읽지 못했습니다. JPG·PNG·WebP 형식의 실제 사진을 다시 선택해주세요.');
  };
  previewImg.src = dataUrl;
}

function updateVisionActionButton() {
  const button = document.getElementById('btn-run-analysis');
  button.disabled = !visionAnalysisInProgress && !AppState.currentImageBase64;
  button.textContent = visionAnalysisInProgress ? '⏹ 중단하기' : '🔬 AI 건강 상태 정밀 진단 시작하기';
}

function stopVisionAnalysis() {
  const session = activeVisionSession;
  if (!session) return;
  activeVisionSession = null;
  visionAnalysisInProgress = false;
  session.controller.abort();
  session.controls.forEach((control, index) => { control.disabled = session.disabledStates[index]; });
  resetVisionReport('분석을 중단했습니다. 다시 시작하려면 정밀 진단 시작하기를 눌러주세요.');
  document.getElementById('overall-score-badge').textContent = '중단됨';
  document.getElementById('report-timestamp').textContent = '사용자가 분석을 중단했습니다';
  updateVisionActionButton();
}

function handleVisionAction() {
  if (visionAnalysisInProgress) {
    if (confirm('진행 중인 사진 분석을 정말 중단하시겠습니까?')) stopVisionAnalysis();
  } else {
    runVisionAnalysis();
  }
}

function clearImagePreview() {
  const message = visionAnalysisInProgress
    ? '사진을 정말 삭제하시겠습니까? 진행 중인 분석과 자동 재시도도 함께 중단됩니다.'
    : '사진을 정말 삭제하시겠습니까?';
  if (!confirm(message)) return;
  stopVisionAnalysis();
  AppState.currentImageBase64 = null;
  AppState.currentSampleType = null;
  const img = document.getElementById('preview-img');
  img.onload = null;
  img.onerror = null;
  img.removeAttribute('src');
  document.getElementById('preview-area').classList.add('hidden');
  document.getElementById('dropzone-prompt').classList.remove('hidden');
  document.getElementById('gecko-photo-input').value = '';
  resetVisionReport();
  updateVisionActionButton();
}

async function prepareVisionImage(source, signal) {
  const image = new Image();
  await new Promise((resolve, reject) => {
    const cleanup = () => signal?.removeEventListener('abort', abort);
    const abort = () => {
      cleanup();
      image.onload = null;
      image.onerror = null;
      image.src = '';
      const error = new Error('분석을 중단했습니다.');
      error.name = 'AbortError';
      reject(error);
    };
    image.onload = () => { cleanup(); resolve(); };
    image.onerror = () => { cleanup(); reject(new Error('사진을 읽지 못했습니다. 다른 사진을 선택해주세요.')); };
    if (signal?.aborted) { abort(); return; }
    signal?.addEventListener('abort', abort, { once: true });
    image.src = source;
  });
  if (!image.naturalWidth || !image.naturalHeight) throw new Error('사진 크기가 올바르지 않습니다.');
  const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext('2d');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  try {
    return canvas.toDataURL('image/jpeg', 0.9);
  } catch {
    throw new Error('이 사진을 API로 전달할 수 없습니다. 사진 파일을 직접 업로드해주세요.');
  }
}

function validateVisionReport(result) {
  if (!result || typeof result.isRealGeckoPhoto !== 'boolean' || typeof result.summary !== 'string') {
    throw new Error('AI 분석 결과 형식이 올바르지 않습니다. 다시 시도해주세요.');
  }
  if (!result.isRealGeckoPhoto) throw new Error('실제 도마뱀을 확인할 수 있는 사진이 아닙니다. 그림이나 샘플 대신 선명한 실제 사진을 올려주세요.');
  if (!Array.isArray(result.detections) || result.detections.length < 1 || result.detections.length > 20 || result.detections.some(detection => {
    const box = detection?.box_2d;
    return !Array.isArray(box) || box.length !== 4 || !box.every(value => Number.isFinite(value) && value >= 0 && value <= 1000) || box[0] >= box[2] || box[1] >= box[3] ||
      !Array.isArray(detection.contour) || detection.contour.length < 8 || detection.contour.length > 128 ||
      detection.contour.some(point => !Array.isArray(point) || point.length !== 2 || !point.every(value => Number.isFinite(value) && value >= 0 && value <= 1000));
  })) throw new Error('도마뱀의 형태 윤곽을 정확히 반환하지 못했습니다. 다시 분석해주세요.');
  if (!['normal', 'caution', 'danger'].includes(result.statusClass) || typeof result.overallStatus !== 'string' || !Array.isArray(result.checks) || result.checks.length !== 5) {
    throw new Error('AI 분석 결과가 불완전합니다. 다시 시도해주세요.');
  }
  for (const check of result.checks) {
    if (!['good', 'warning', 'danger', 'unknown'].includes(check.level) || !['icon', 'part', 'statusText', 'detail', 'advice'].every(key => typeof check[key] === 'string')) {
      throw new Error('부위별 분석 결과가 불완전합니다. 다시 시도해주세요.');
    }
  }
  return result;
}

function renderVisionReport(result) {
  visionDetections = result.detections;
  renderGeckoDetections();
  const badge = document.getElementById('overall-score-badge');
  badge.textContent = result.overallStatus;
  badge.className = `health-score-badge ${result.statusClass}`;
  document.getElementById('report-timestamp').textContent = `Gemini 사진 분석 완료: ${new Date().toLocaleTimeString('ko-KR')}`;
  document.getElementById('report-content').innerHTML = `
    <div class="vision-summary"><h4>🩺 사진에서 관찰한 특징</h4><p>사진에서 도마뱀 ${result.detections.length}마리를 찾았습니다. 사진 위 번호와 색 테두리로 도마뱀의 형태를 표시했습니다.</p><p>${escapeHtml(result.summary)}</p></div>
    <p class="vision-report-note">사진에 보이는 외형을 바탕으로 한 AI 관찰 리포트입니다. 사진만으로 질병, 골밀도, 점착력 또는 전체 건강을 확진할 수 없습니다.</p>
    <div class="health-item-grid">${result.checks.map(check => `
      <div class="health-check-card"><div class="health-check-header">
        <div class="health-part-title"><span>${escapeHtml(check.icon)}</span><span>${escapeHtml(check.part)}</span></div>
        <span class="health-part-status ${check.level}">${escapeHtml(check.statusText)}</span></div>
        <p class="health-check-detail">${escapeHtml(check.detail)}</p>
        <div class="health-advice-box"><strong>💡 권장사항:</strong> ${escapeHtml(check.advice)}</div></div>`).join('')}</div>`;
}

async function runVisionAnalysis() {
  if (visionAnalysisInProgress || !AppState.currentImageBase64) return;
  const source = AppState.currentImageBase64;
  const key = AppState.geminiApiKey;
  const laser = document.getElementById('scanner-laser');
  const loading = document.getElementById('analysis-loading');
  const report = document.getElementById('report-content');
  const button = document.getElementById('btn-run-analysis');
  const badge = document.getElementById('overall-score-badge');
  try {
    validateGeminiApiKey(key);
    if (AppState.currentSampleType) throw new Error('예시 그림은 실제 건강 분석에 사용할 수 없습니다. 도마뱀 사진을 직접 업로드해주세요.');
  } catch (error) {
    resetVisionReport(error.message);
    return;
  }
  visionAnalysisInProgress = true;
  clearGeckoDetections();
  const controls = [...document.querySelectorAll('#btn-select-file, #gecko-photo-input, .btn-sample')];
  const disabledStates = controls.map(control => control.disabled);
  controls.forEach(control => { control.disabled = true; });
  const session = { controller: new AbortController(), controls, disabledStates };
  activeVisionSession = session;
  updateVisionActionButton();
  laser.classList.add('scanning');
  loading.classList.remove('hidden');
  report.classList.add('hidden');
  report.innerHTML = '';
  badge.textContent = '분석 중';
  badge.className = 'health-score-badge caution';
  document.getElementById('report-timestamp').textContent = '선택한 사진 분석 중';
  const step = document.getElementById('analysis-step-text');
  step.textContent = '선택한 사진을 준비하고 있습니다.';
  try {
    const image = await prepareVisionImage(source, session.controller.signal);
    if (activeVisionSession !== session) return;
    step.textContent = 'Gemini가 실제 사진을 분석하고 있습니다. 결과를 기다려주세요.';
    const result = await callGeminiVision(image, key, message => { if (activeVisionSession === session) step.textContent = message; }, session.controller.signal);
    if (activeVisionSession !== session) return;
    renderVisionReport(result);
  } catch (error) {
    if (activeVisionSession !== session) return;
    badge.textContent = '분석 실패';
    badge.className = 'health-score-badge caution';
    document.getElementById('report-timestamp').textContent = '분석 결과를 생성하지 못했습니다';
    report.innerHTML = `<div class="empty-state-box"><p>${escapeHtml(error.message || '사진 분석 중 오류가 발생했습니다.')}</p><p>원인을 확인한 뒤 정밀 진단 시작하기를 다시 눌러주세요.</p></div>`;
  } finally {
    if (activeVisionSession === session) {
      activeVisionSession = null;
      visionAnalysisInProgress = false;
      laser.classList.remove('scanning');
      loading.classList.add('hidden');
      report.classList.remove('hidden');
      updateVisionActionButton();
      controls.forEach((control, i) => { control.disabled = disabledStates[i]; });
    }
  }
}

function waitForGeminiRetry(delayMs, signal) {
  return new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      const error = new Error('요청이 중단되었습니다.');
      error.name = 'AbortError';
      reject(error);
    };
    const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, delayMs);
    if (signal?.aborted) { abort(); return; }
    signal?.addEventListener('abort', abort, { once: true });
  });
}

function isTemporaryGeminiStatus(status) {
  return [500, 502, 503, 504].includes(status);
}

async function fetchGeminiWithRetry(url, options, onProgress = () => {}) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(url, options);
    if (!isTemporaryGeminiStatus(response.status) || attempt === 2) return response;
    // 2초, 4초 간격으로 최대 두 번 재시도합니다. 서버 대기 지침이 있으면 우선합니다.
    const retryAfter = response.headers?.get('Retry-After');
    const seconds = retryAfter ? Number(retryAfter) : NaN;
    const requestedDelay = Number.isFinite(seconds) ? seconds * 1000 : retryAfter ? Date.parse(retryAfter) - Date.now() : 0;
    const delayMs = Math.max(2000 * 2 ** attempt, Number.isFinite(requestedDelay) ? requestedDelay : 0);
    onProgress(`AI 서버가 일시적으로 혼잡합니다. ${Math.ceil(delayMs / 1000)}초 후 자동 재시도합니다 (${attempt + 1}/2).`);
    if (response.body?.cancel) await response.body.cancel().catch(() => {});
    await waitForGeminiRetry(delayMs, options.signal);
    onProgress('AI 서버에 다시 요청하고 있습니다. 잠시 기다려주세요.');
  }
}

async function callGeminiVision(base64Data, apiKey, onProgress = () => {}, externalSignal) {
  const key = validateGeminiApiKey(apiKey);
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(base64Data);
  if (!match) throw new Error('사진 데이터를 전달할 수 없습니다. JPG·PNG·WebP 사진을 올려주세요.');
  const prompt = `실제 도마뱀 사진에 보이는 외형을 한국어로 관찰하는 보조 AI입니다.
사진에서 보이는 모든 실제 도마뱀을 각각 찾아 detections에 넣으세요. box_2d는 [y_min,x_min,y_max,x_max] 순서로 가로/세로 각각 0~1000 정규화 좌표입니다. 왼쪽 위는 [0,0], 오른쪽 아래는 [1000,1000]입니다. 머리, 몸, 발과 보이는 꼬리를 포함한 가장 작은 사각형을 쓰세요. 여러 마리는 각각 표시하고 왼쪽에서 오른쪽 순서로 번호를 매기세요. 가려진 부분을 추측해서 박스를 늘리지 마세요. 각 detection에는 contour도 넣으세요. contour는 도마뱀의 실제 실루엣 외곽을 시계방향으로 따라가는 [y,x] 좌표의 배열이고 box_2d와 동일한 0~1000 좌표계입니다. 사각형의 네 꼭짓점이 아닌 머리의 곡선, 몸통, 네 다리의 돌출, 꼬리 굴곡과 끝을 따르는 24~64개 꼭짓점을 쓰세요. 첫 점을 마지막에 반복하지 마세요. 팔다리 사이 배경은 윤곽의 오목한 부분으로 제외하세요. 가려진 부위는 사진에서 보이는 경계를 따르고 배경/바위/나무를 포함하지 마세요. 각 도마뱀마다 독립적인 닫힌 실루엣을 반환하세요. 대상이 없으면 detections는 빈 배열입니다.
여러 마리가 있으면 summary와 checks에 '도마뱀 1', '도마뱀 2'처럼 대상을 구분하세요.
그림, 캐릭터, 가짜 샘플 또는 도마뱀이 아닌 사진은 isRealGeckoPhoto=false로 표시하세요.
보이는 사실과 추정을 구분하세요. 보이지 않거나 흐릿한 부위는 level=unknown, statusText=판단 불가로 쓰고 필요한 추가 사진을 advice에 적으세요.
5개 항목: 눈 외형, 피부/탈피, 척추/꼬리의 외형, 체형, 발가락의 외형.
사진만으로 MBD 확진/배제, 골밀도, 점착력, 영양 결핍, 전체 건강을 단정하지 마세요. 점수나 등급을 만들지 마세요.
모프 색 변화만으로 질병을 추정하지 마세요. 약물, 칼슘/D3 용량이나 강제 처치는 지시하지 마세요.
뚜렷한 이상 징후가 있으면 파충류 진료 수의사 상담과 추가 확인을 권하세요.
반드시 다음 JSON 구조로 답하세요. isRealGeckoPhoto가 true이면 checks에는 위 순서로 정확히 5개 항목을 넣으세요:
{"isRealGeckoPhoto":true,"detections":[{"box_2d":[100,150,800,900],"contour":[[100,300],[150,400],[250,600],[400,900],[600,700],[800,600],[700,400],[500,150],[250,200]]}],"overallStatus":"사진상 관찰 소견 / 추가 확인 필요 / 진료 상담 권장","statusClass":"normal 또는 caution 또는 danger","summary":"관찰 근거와 사진의 한계","checks":[{"icon":"👁️","part":"부위명","statusText":"관찰 결과 또는 판단 불가","level":"good 또는 warning 또는 danger 또는 unknown","detail":"사진에서 실제로 보인 근거 / 확인 불가 이유","advice":"추가 확인 또는 관리 안내"}]}`;
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (externalSignal?.aborted) controller.abort();
  else externalSignal?.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(() => controller.abort(), 90000);
  try {
    const detected = await resolveWorkingGeminiModel(key, controller.signal);
    const models = [...new Set([detected.model, ...(detected.alternatives || [])])].slice(0, 3);
    let lastError;
    for (const model of models) {
      const response = await fetchGeminiWithRetry(`https://generativelanguage.googleapis.com/${detected.apiVersion}/models/${model}:generateContent`, {
        method: 'POST', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }, { inlineData: { mimeType: match[1], data: match[2] } }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.2, maxOutputTokens: 8192 }
        })
      }, onProgress);
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        lastError = new Error(`[HTTP ${response.status}] ${data.error?.message || 'Gemini API 오류'}`);
        if (response.status === 404 || isTemporaryGeminiStatus(response.status)) {
          cachedGeminiModelInfo = null;
          if (model !== models[models.length - 1]) onProgress('현재 모델에서 응답을 받지 못해 다른 AI 모델로 전환하고 있습니다.');
          continue;
        }
        throw lastError;
      }
      const json = await response.json();
      const text = (json.candidates?.[0]?.content?.parts || []).filter(part => !part.thought && typeof part.text === 'string').map(part => part.text).join('');
      if (!text) throw new Error(`사진 분석 응답이 없습니다. (${json.promptFeedback?.blockReason || json.candidates?.[0]?.finishReason || '빈 응답'})`);
      let result;
      try { result = JSON.parse(text.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '')); }
      catch { throw new Error('사진 분석 응답이 불완전합니다. 다시 시도해주세요.'); }
      validateVisionReport(result);
      cachedGeminiModelInfo = { ...detected, model, alternatives: [...new Set([detected.model, ...(detected.alternatives || [])])].filter(name => name !== model) };
      return result;
    }
    if (lastError && /HTTP (500|502|503|504)/.test(lastError.message)) {
      throw new Error('Gemini 서버가 혼잡하여 자동 재시도와 다른 모델 전환 후에도 분석하지 못했습니다. 잠시 후 다시 시도해주세요. ' + lastError.message);
    }
    throw lastError || new Error('사용 가능한 사진 분석 모델이 없습니다.');
  } catch (error) {
    if (error.name === 'AbortError') {
      if (externalSignal?.aborted) throw error;
      throw new Error('사진 분석 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.');
    }
    throw error;
  } finally { clearTimeout(timeout); externalSignal?.removeEventListener('abort', abort); }
}

// ==========================================
// 8. AI 도마뱀 케어 상담소 (Chatbot)
// ==========================================

// 내장 전문가 답변 데이터베이스 (풍부한 수의학 & 일상 대화 & 교감 지원)
const GeckoKnowledgeBase = [
  // 1. 일상 대화 & 교감 (티키타카)
  {
    keywords: ['안녕', '반가워', '하이', 'hello', 'hi', '좋은 아침', '굿모닝'],
    response: `안녕 집사님! 🦎 오늘 크림이 보러 와줘서 정말 기뻐요! 
오늘 하루는 어떠셨나요? 사육장 분무랑 맛있는 밥 챙겨주실 시간인가요? 헤헤 🌿✨`
  },
  {
    keywords: ['대화', '말할수', '말해', '소통', '가능해', '이야기'],
    response: `네! 저랑 얼마든지 대화할 수 있어요! 🦎💬
크레스티드 게코 사육법, 슈푸 먹이기, 온습도 조절, 탈피, 꼬리 건강, 모프 종류 등 무엇이든 편하게 물어보세요!
집사님과 도마뱀 친구의 건강한 동행을 위해 성심성의껏 답변해 드릴게요! ✨`
  },
  {
    keywords: ['누구', '이름', '정체', '자기소개'],
    response: `저는 집사님 사육장의 귀염둥이 크림이를 돌보는 **'게코 닥터 AI 크림이'**예요! 🦎
매일매일 출석체크와 사육 루틴을 함께하며, 30일차에는 위대한 **천상계 엠페러 드래곤**으로 진화할 준비를 하고 있답니다! 🐉👑`
  },
  {
    keywords: ['귀여워', '예뻐', '사랑해', '착해', '심쿵'],
    response: `(속눈썹을 깜빡이며 손바닥에 조심스레 턱을 괸다) 🦎💖
에헤헤... 집사님이 그렇게 다정하게 말해주시니까 온몸이 따뜻해지는 것 같아요! 
제가 세상에서 집사님을 제일 신뢰하고 좋아해요! 항상 아껴주셔서 감사해요 집사님 🥰`
  },
  {
    keywords: ['심심', '놀자', '뭐해', '근황'],
    response: `저는 지금 유리벽에 착! 붙어서 집사님을 빼꼼 바라보고 있었어요! 🦎
오늘 손바닥 사다리 타기 핸들링 5분만 해주실래요? 아니면 사육장 벽면에 시원하게 미스트 한 번 뿌려주세요! 🌿`
  },
  {
    keywords: ['고마워', '감사', '수고', '땡큐'],
    response: `천만에요, 집사님! 🌿 집사님이 사랑으로 정성껏 보살펴주시니까 저도 항상 힘이 나요!
궁금한 점이 생기면 언제든 또 편하게 말 걸어주세요. 오늘도 행복한 하루 보내세요! 🦎💚`
  },

  // 2. 먹이 & 영양 (슈푸, 충식, 칼슘)
  {
    keywords: ['슈퍼푸드', '슈푸', '밥', '안먹', '거부', '식음', '먹이'],
    response: `🥣 **슈퍼푸드를 잘 안 먹을 때 수의학적 대처 팁:**
1. **적응기 확인**: 입양 후 1~2주는 낯설어서 먹이를 거부하는 것이 정상입니다. 스스로 적응할 시간을 주세요.
2. **농도 체크**: 너무 되직하거나 묽으면 거부할 수 있습니다. **묽은 요거트나 케첩 정도의 점도**가 가장 이상적입니다.
3. **맛(브랜드) 다양화**: 판게아(무화과, 수박, 파파야), 레파시(클래식, 바나나) 등 브랜드를 번갈아 주며 입맛을 찾아주세요.
4. **코 끝 피딩**: 실리콘 스푼이나 주사기 끝에 슈푸를 살짝 묻혀 코 끝에 대어주면 혀로 핥아먹으며 맛을 인지합니다.
5. **야행성 골든타임**: 저녁 불이 꺼진 뒤(오후 8~10시) 활동을 시작할 때 자율 급여구를 넣어주세요!`
  },
  {
    keywords: ['귀뚜라미', '밀웜', '생먹이', '충식', '곤충'],
    response: `🦗 **생먹이(귀뚜라미/밀웜) 급여 가이드:**
• **귀뚜라미 (적극 추천)**: 크레의 사냥 본능을 자극하고 성장 속도를 높여줍니다.
  - **크기**: 양 눈 사이 간격보다 작은 크기를 급여하세요.
  - **머리 떼기**: 턱 힘이 강한 성체 귀뚜라미는 도마뱀 입 안을 물 수 있으므로 뒷다리와 머리를 제거해 주시면 안전합니다.
  - **칼슘 더스팅 필수**: 비타민 D3 포함 칼슘제를 귀뚜라미 몸에 하얗게 묻혀 주 1회 급여하세요.
• **밀웜 (주의 필요)**: 겉껍질(키틴질)이 두꺼워 소화불량 및 장폐색을 유발할 수 있으므로 갓 탈피한 하얀 밀웜 위주로 아주 가끔만 간식으로 주세요.`
  },
  {
    keywords: ['mbd', '대사성', '칼슘', '골질환', '뼈', '다리', '떨림'],
    response: `🦴 **MBD (대사성 골질환) 주의 및 예방법:**
• **원인**: 체내 칼슘 부족 또는 비타민 D3 결핍으로 뼈의 칼슘이 빠져나가 뼈가 물렁물렁해지는 질환입니다.
• **의심 증상**: 턱뼈가 고무처럼 말랑해짐, 척추가 S자로 휨, 다리를 파들파들 떨며 걸음, 점프 실패.
• **해결 및 예방**:
  1. 귀뚜라미 급여 시 **비타민 D3 함유 칼슘제**를 100% 코팅(더스팅)해서 먹이세요.
  2. 성장기 베이비/아성체나 산란기 암컷은 슈푸에도 2주에 1회 극소량의 칼슘제를 섞어주세요.
  3. 증상이 나타나면 자가치료가 어려우므로 즉시 특수동물 전문 병원에서 칼슘 주사를 처방받아야 합니다.`
  },

  // 3. 환경 & 사육장 (온습도, 바닥재, 계절)
  {
    keywords: ['온도', '습도', '환경', '세팅', '몇도', '적정'],
    response: `🌡️ **크레스티드 게코 최적 사육 환경:**
• **적정 온도**: **22°C ~ 26°C** (가장 쾌적: 23~25°C)
  - ⚠️ **28°C 초과 시 위험**: 열사병으로 급사할 수 있으므로 여름철에는 쿨링팬이나 에어컨이 필수입니다.
  - ⚠️ **20°C 미만 시 주의**: 신진대사와 소화가 멈추므로 겨울철에는 필름 히터로 22°C 이상 유지해주세요.
• **적정 습도**: **60% ~ 80%**
  - **건식-습식 사이클**: 아침/저녁 벽면 분무로 80%까지 올리고, 낮에는 자연 환기로 50~60%까지 건조되어야 곰팡이와 호흡기 질환을 막을 수 있습니다.`
  },
  {
    keywords: ['사육장', '크기', '유리장', '아크릴', '백업', '렉사'],
    response: `🏠 **사육장 선택 및 세팅 팁:**
• **크기 기준**: 크레는 나무 위에서 생활하는 교목성 파충류라 **높이가 높은 사육장**이 좋습니다.
  - 베이비/아성체(15g 미만): 15×15×20cm 내외 (너무 크면 먹이를 못 찾아요)
  - 성체(25g 이상): 30×30×45cm 이상 권장
• **필수 내부 세팅**:
  - **백업(인조 덩굴/스펀지 바)/코르크 보드**: 수평 및 대각선 은신처를 풍성하게 넣어주어야 플로피테일 증후군을 예방합니다.
  - **환기 구멍**: 습도가 높으면서도 바람이 통하는 상단/측면 환기망 필수!`
  },
  {
    keywords: ['바닥재', '키친타월', '코코피트', '바크', '펠렛', '임팩션'],
    response: `🧻 **바닥재 종류별 장단점 및 추천:**
• **키친타월 (가장 추천 ⭐⭐⭐⭐⭐)**:
  - 배변 상태 확인이 쉽고 매일 교체가 간편하며, 바닥재를 삼켜 장이 막히는 '임팩션' 위험이 0%입니다!
• **코코피트 / 바크**:
  - 자연스럽고 습도 유지에 좋으나, 먹이 사냥 시 바닥재를 함께 삼켜 장폐색(임팩션)을 일으킬 위험이 있습니다. 초보 집사님께는 무조건 키친타월을 권장합니다.`
  },
  {
    keywords: ['여름', '더워', '폭염', '에어컨', '쿨링팬'],
    response: `❄️ **여름철 고온 주의보 (28°C 초과 금지):**
크레스티드 게코는 추위보다 **더위에 극도로 취약**합니다! 28°C를 넘어가면 뇌 손상과 탈수가 옵니다.
1. 방 온도를 에어컨으로 24~26°C로 맞춰주세요.
2. 에어컨 가동이 어렵다면 사육장 뚜껑 위에 아이스팩을 수건으로 감싸 올려 냉기를 아래로 내려주세요.
3. 사육장 전용 USB 쿨링팬을 설치해 공기를 순환시켜 주세요.`
  },
  {
    keywords: ['겨울', '추워', '한파', '보온', '히터', '난방'],
    response: `🔥 **겨울철 저온 관리 (20°C 이하 금지):**
온도가 20°C 밑으로 떨어지면 먹이를 소화하지 못하고 장에서 부패할 수 있습니다!
1. 사육장 뒷면이나 측면의 1/3 영역에 **필름 히터(전기방석)**를 부착해 주세요.
2. 사육장 내부 전체를 덥히지 말고, 따뜻한 핫존(25°C)과 시원한 쿨존(22°C)을 만들어 스스로 체온을 조절하게 하세요.`
  },

  // 4. 질병 & 건강 케어 (탈피, 꼬리, 눈, 변)
  {
    keywords: ['탈피', '껍질', '온욕', '부전', '사우나'],
    response: `🦎 **탈피 부전 및 안전한 사우나 온욕법:**
1. **발가락 끝 & 꼬리 끝 확인 필수!**: 발가락에 남은 탈피 껍질은 고무줄처럼 조여 발가락이 괴사되어 떨어질 수 있습니다.
2. **미온수 사우나 온욕법**:
   - 밀폐 반찬통 바닥에 키친타월을 깔고 **26~27°C 미온수**를 타월이 흠뻑 젖을 정도로만 부어줍니다.
   - 도마뱀을 넣고 뚜껑(숨구멍 필수)을 닫은 뒤 **15~20분간 사우나** 상태로 불려줍니다.
   - 꺼낸 뒤 젖은 면봉으로 발가락 끝을 살살 쓸어내리면 껍질이 쏙 벗겨집니다. 절대 핀셋으로 억지로 뜯지 마세요!`
  },
  {
    keywords: ['꼬리', '부절', '자절', '끊', '잘림', '챠우'],
    response: `🦎 **꼬리 끊김(부절) 대처법 및 안내:**
• **재생 여부**: 레오파드 게코와 달리 크레스티드 게코는 **꼬리가 한 번 끊어지면 평생 다시 자라지 않습니다** (귀여운 개구리 엉덩이 '챠우' 상태가 됩니다).
• **건강 영향**: 꼬리가 없어도 일상생활, 수명, 번식에는 아무런 지장이 없으니 너무 자책하지 마세요!
• **응급 처치**:
  1. 끊어진 상처 부위에 베타딘(빨간약)을 생수에 1:10으로 연하게 희석해 면봉으로 톡톡 소독합니다.
  2. 2차 감염을 막기 위해 상처가 아물 때까지 바닥재를 깨끗한 키친타월로 유지해 주세요.`
  },
  {
    keywords: ['fts', '플로피', '플로피테일', '골반', '거꾸로 매달려'],
    response: `⚠️ **FTS (플로피 테일 증후군) 예방 가이드:**
• **현상**: 도마뱀이 유리벽에 머리를 아래로 하고 거꾸로 매달려 잘 때, 무거운 꼬리가 중력에 의해 뒤로 꺾이면서 골반과 척추가 영구적으로 휘는 증상입니다.
• **예방법**:
  - 사육장 내부에 수평/대각선 구조물(백업 스펀지, 유목, 인조 덩굴, 코르크 보드)을 넉넉하게 설치해 편안하게 누워서 잘 수 있는 자리를 만들어주세요!`
  },
  {
    keywords: ['눈', '백탁', '각막', '눈곱', '염증', '비비'],
    response: `👁️ **눈 건강 및 각막 이상 대처법:**
• 크레스티드 게코는 눈꺼풀이 없어서 투명한 각막 비늘로 덮여 있으며, 혀로 핥아서 눈을 닦습니다.
• **눈에 백탁이 생기거나 뿌옇게 흐려진 경우**:
  1. 탈피 껍질이 눈에 덮여 남았거나 각막에 상처가 났을 가능성이 높습니다.
  2. 인공눈물(무방부제 멸균 식염수)을 한 방울 떨어뜨려 부드럽게 씻어내 주세요.
  3. 눈을 감싸는 부종이나 고름이 보이면 즉시 파충류 전문 병원에서 항생제 안약을 처방받아야 합니다.`
  },
  {
    keywords: ['똥', '배변', '변비', '설사', '요산'],
    response: `💩 **배변 상태로 보는 건강 체크:**
• **정상적인 변**: 갈색의 단단한 대변 + 하얀색 고체 덩어리(요산)가 함께 배출됩니다.
• **변비 (배변 안 함)**:
  - 사육장 온도가 낮거나 탈수 상태일 때 발생합니다. 온도를 24°C로 올리고 27°C 미온수 사우나 온욕을 해주면 장운동이 촉진되어 배변합니다.
• **물설사**:
  - 물설사가 며칠간 지속된다면 슈푸 농도가 너무 묽거나, 내부 기생충(원충) 감염일 수 있으므로 분변 검사를 받아보세요.`
  },

  // 5. 행동, 핸들링, 번식
  {
    keywords: ['핸들링', '친해지', '손', '만지', '적응'],
    response: `🤲 **스트레스 없는 핸들링 적응법:**
1. **초기 안정기**: 입양 후 첫 1~2주는 사육장 밖으로 꺼내지 말고 밥만 주며 환경에 적응하게 두세요.
2. **사다리 타기 핸들링**: 위에서 덮치듯 손을 뻗으면 포식자로 오해해 꼬리를 자를 수 있습니다! 손바닥을 도마뱀 턱 밑에 가만히 대어 스스로 올라타게 한 뒤, 두 손을 번갈아 계단처럼 내어주세요.
3. **시간 엄수**: 사람 체온(36.5°C)은 변온동물에게 뜨거우므로 하루 5분 이내로 짧게 끝내는 것이 좋습니다.`
  },
  {
    keywords: ['물어', '입질', '공격', '사나워'],
    response: `🦷 **입질 및 무는 행동의 이유:**
• 크레는 이빨이 미세해서 물려도 거의 아프지 않거나 벨크로 테이프 느낌 정도입니다.
• **원인**:
  1. 배가 고파서 움직이는 손가락을 귀뚜라미로 착각한 경우.
  2. 발정기 수컷이 영역 방어 또는 짝짓기 본능으로 반응한 경우.
  3. 갑작스러운 위협에 놀란 경우.
• **대처**: 손을 확 빼면 도마뱀 턱이 다칠 수 있으니 가만히 기다리거나 콧등에 미스트를 살짝 뿌려주면 입을 뗍니다.`
  },
  {
    keywords: ['암수', '구별', '성별', '수컷', '암컷', '천공'],
    response: `🔍 **크레스티드 게코 암수 구별법:**
체중 약 10~15g 이상(아성체 후기)부터 정확한 구별이 가능합니다:
• **수컷 ♂️**: 총배설강 아래쪽에 고환 주머니(헤미페니스)가 큼직하게 볼록 튀어나오며, 뒷다리 사이 비늘에 점 같은 모공(천공, Pores)이 일렬로 보입니다.
• **암컷 ♀️**: 총배설강 아래가 평평하며, 천공 모공이 없습니다.`
  },
  {
    keywords: ['모프', '릴리', '할리퀸', '트익할', '카푸치노', '아잔틱'],
    response: `🎨 **크레스티드 게코 대표 인기 모프:**
• **노멀/플레임/할리퀸**: 몸통과 다리에 불꽃무늬나 크림색 패턴이 들어간 클래식 모프.
• **트익할 (익스트림 할리퀸)**: 옆구리와 다리까지 크림 패턴이 빽빽하게 뒤덮인 화려한 타입.
• **릴리 화이트 (Lilly White)**: 등과 몸통 전체가 눈부신 백색으로 덮이는 최고 인기 모프!
• **카푸치노 (Cappuccino)**: 짙은 커피빛 베이스에 독특한 유전자를 가진 모프.
• **아잔틱 (Axanthic)**: 노란/붉은 색소가 결핍되어 시크한 흑백 모노톤을 띠는 희귀 모프.`
  },
  {
    keywords: ['드래곤', '진화', '30일', '캐릭터', '출석'],
    response: `🐉 **전설의 드래곤 진화 조건 안내!**
매일 사육 루틴을 완료하고 **[오늘 출석체크 도장 찍기!]**를 눌러주세요!
• **1~6일차**: 앙증맞은 아기 크레 🐣
• **7~13일차**: 무늬가 짙어지는 주니어 크레 🌿
• **14~20일차**: 위풍당당 왕관 볏을 가진 성체 크레 👑
• **21~29일차**: 등에 마법의 날개가 돋아난 비룡 크레 🪽
• **30일차 달성 시**: 신화의 위대한 **천상계 엠페러 드래곤**으로 최종 각성합니다! 🐉✨
(상단의 '체험 미리보기' 버튼으로 각 단계의 멋진 모습을 미리 구경하실 수 있습니다!)`
  }
];

function addChatMessage(sender, text) {
  if (sender === 'assistant') text = personalizeOwnerText(text);
  AppState.chatHistory.push({ sender, text });
  saveStorage();

  const msgContainer = document.getElementById('chat-messages');
  if (!msgContainer) return;

  const msgDiv = document.createElement('div');
  msgDiv.className = `chat-message ${sender}`;
  msgDiv.innerHTML = `
    <div class="msg-avatar">${sender === 'assistant' ? '🦎' : '👤'}</div>
    <div class="msg-bubble">${formatChatText(text)}</div>
  `;
  msgContainer.appendChild(msgDiv);
  msgContainer.scrollTop = msgContainer.scrollHeight;
}

function formatChatText(text) {
  // 간단한 마크다운 줄바꿈 및 강조 파싱
  return text
    .split('\n')
    .map(line => `<p>${escapeHtml(line).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</p>`)
    .join('');
}

// Gemini API 실시간 채팅 상태 갱신 함수
function updateChatApiStatus() {
  const statusBadge = document.getElementById('chat-api-status-badge');
  const aiTag = document.getElementById('ai-mode-tag');

  if (AppState.geminiApiKey && AppState.geminiApiKey.trim() !== '') {
    if (statusBadge) statusBadge.classList.add('connected');
    if (aiTag) aiTag.textContent = '🟢 Gemini API 키 등록됨';
  } else {
    if (statusBadge) statusBadge.classList.remove('connected');
    if (aiTag) aiTag.textContent = '내장 지식 엔진 모드';
  }
}

// 챗봇 응답 처리 (Gemini API 실시간 대화 지원)
async function handleChatSubmit(userText) {
  if (!userText || userText.trim() === '') return;

  addChatMessage('user', userText);

  // 로딩 인디케이터 말풍선
  const msgContainer = document.getElementById('chat-messages');
  const tempId = 'typing-' + Date.now();
  const typingDiv = document.createElement('div');
  typingDiv.id = tempId;
  typingDiv.className = 'chat-message assistant';
  const hasKey = !!(AppState.geminiApiKey && AppState.geminiApiKey.trim() !== '');
  typingDiv.innerHTML = `
    <div class="msg-avatar">🦎</div>
    <div class="msg-bubble"><span style="color:var(--text-muted);">${hasKey ? '⚡ Gemini AI가 전문 수의학 지식으로 실시간 답변을 생성하고 있습니다... 💭' : '게코 박사가 답변을 생각하고 있습니다... 💭'}</span></div>
  `;
  msgContainer.appendChild(typingDiv);
  msgContainer.scrollTop = msgContainer.scrollHeight;

  let reply = '';
  let apiSuccess = false;
  let apiErrorMessage = null;

  // 1. Gemini API 키가 있는 경우 실제 Gemini 멀티턴 대화 호출
  if (hasKey) {
    try {
      const geminiText = await callGeminiChat(userText, AppState.geminiApiKey, message => {
        const status = typingDiv.querySelector('.msg-bubble span');
        if (status) status.textContent = message;
      });
      reply = `✨ **[Google Gemini 실시간 AI 답변]**\n\n${geminiText}`;
      apiSuccess = true;
    } catch (e) {
      console.warn('Gemini chat error, falling back to smart expert engine:', e);
      apiErrorMessage = e.message || 'API 통신 오류';
    }
  }

  // 2. 키가 없거나 API 호출 실패 시 지능형 수의학 지식베이스 질의 응답
  if (!apiSuccess) {
    const lower = userText.toLowerCase().replace(/\s+/g, '');
    
    // 키워드 다중 매칭 점수 계산
    let bestMatch = null;
    let maxScore = 0;

    for (const kb of GeckoKnowledgeBase) {
      let score = 0;
      for (const kw of kb.keywords) {
        const cleanKw = kw.toLowerCase().replace(/\s+/g, '');
        if (lower.includes(cleanKw)) {
          score += cleanKw.length;
        }
      }
      if (score > maxScore) {
        maxScore = score;
        bestMatch = kb;
      }
    }

    let kbReply = '';
    if (bestMatch && maxScore > 0) {
      kbReply = `🌿 **[내장 수의학 지식베이스 답변]**\n\n${bestMatch.response}`;
    } else {
      kbReply = `🌿 **[내장 수의학 지식베이스 답변]**\n\n집사님! 질문해주신 "${userText}"에 대해 안내해 드릴게요. 🦎🌿\n\n크레스티드 게코는 **적정 온도 22~26°C / 습도 60~80%**와 규칙적인 슈퍼푸드 피딩, 안전한 은신처가 갖춰지면 스트레스 없이 건강하게 잘 자랍니다. 😊\n\n혹시 슈푸 거부, 탈피 부전, 꼬리 건강(MBD/FTS), 온습도 조절, 핸들링 등에 대해 더 구체적인 도움이 필요하신가요? 궁금하신 단어나 증상을 편하게 말씀해 주시면 자세히 설명해 드릴게요! ✨`;
    }

    // 만약 API 키를 넣었는데 실패한 경우 실제 원문 에러를 솔직하고 투명하게 표시
    if (apiErrorMessage) {
      kbReply += `\n\n---\n> ⚠️ **Gemini API 통신 상태**: ${apiErrorMessage}`;
    }

    reply = kbReply;
    await new Promise(r => setTimeout(r, 400));
  }

  // 로딩 말풍선 제거 후 실제 답변 추가
  const tempEl = document.getElementById(tempId);
  if (tempEl) tempEl.remove();

  addChatMessage('assistant', reply);
  SoundFX.playChime();
}

// Gemini API 키 정제 (공백, 따옴표, 줄바꿈, 접두사 자동 제거)
function sanitizeApiKey(rawKey) {
  if (!rawKey) return '';
  let key = String(rawKey).trim();
  // 따옴표 제거 ("키", '키', `키`)
  key = key.replace(/^["'`]|["'`]$/g, '').trim();
  // 접두사 제거 (API_KEY=, GEMINI_API_KEY=, Bearer 등)
  key = key.replace(/^(?:gemini_)?api_?key\s*[:=]\s*/i, '');
  key = key.replace(/^Bearer\s+/i, '');
  // 제로위드 유니코드 공백문자 제거
  key = key.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
  key = key.replace(/^["'`]|["'`]$/g, '').trim();
  return key;
}

function validateGeminiApiKey(rawKey) {
  const key = sanitizeApiKey(rawKey);
  if (!key) throw new Error('게코 프로필 / API 설정에서 Gemini API 키를 먼저 등록해주세요.');
  if (/[^\x21-\x7E]/.test(key)) {
    throw new Error('API 키에 공백, 한글 또는 특수문자가 포함되어 있습니다. AI Studio에서 키만 복사해 다시 입력해주세요.');
  }
  return key;
}

// 사용 가능한 Gemini 모델 동적 감지 캐시
let cachedGeminiModelInfo = null;

async function resolveWorkingGeminiModel(apiKey, signal) {
  if (cachedGeminiModelInfo) return cachedGeminiModelInfo;

  const key = validateGeminiApiKey(apiKey);
  const versions = ['v1beta', 'v1'];

  // 1. Google API의 ListModels를 호출하여 이 키로 실제 사용 가능한 모델 목록 조회
  for (const ver of versions) {
    try {
      const listUrl = `https://generativelanguage.googleapis.com/${ver}/models?key=${encodeURIComponent(key)}`;
      const res = await fetch(listUrl, { signal });
      if (res.ok) {
        const data = await res.json();
        while (data.nextPageToken) {
          const next = await fetch(`${listUrl}&pageToken=${encodeURIComponent(data.nextPageToken)}`, { signal });
          if (!next.ok) break;
          const page = await next.json();
          data.models = [...(data.models || []), ...(page.models || [])];
          data.nextPageToken = page.nextPageToken;
        }
        if (data && Array.isArray(data.models) && data.models.length > 0) {
          const usable = data.models.filter(m => 
            Array.isArray(m.supportedGenerationMethods) && 
            m.supportedGenerationMethods.includes('generateContent') &&
            m.name.startsWith('models/gemini-') &&
            !/image|tts|live|robotics|computer-use/i.test(m.name)
          );

          if (usable.length > 0) {
            // 선호 순위: flash 계열 > 1.5 계열 > 2.0 계열 > pro 계열
            const preferred = usable.find(m => m.name.includes('flash') && !/preview|exp/.test(m.name)) ||
                              usable.find(m => m.name.includes('flash')) ||
                              usable.find(m => m.name.includes('gemini-1.5')) ||
                              usable.find(m => m.name.includes('gemini-2.0')) ||
                              usable.find(m => m.name.includes('gemini-pro')) ||
                              usable[0];

            if (preferred) {
              const cleanName = preferred.name.replace(/^models\//, '');
              cachedGeminiModelInfo = { model: cleanName, apiVersion: ver, alternatives: usable.filter(m => m !== preferred).map(m => m.name.replace(/^models\//, '')) };
              console.log(`Auto-detected Gemini model: ${cleanName} (${ver})`);
              return cachedGeminiModelInfo;
            }
          }
        }
      }
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      console.warn(`ListModels error on ${ver}:`, e);
    }
  }

  // 2. 동적 조회가 실패할 경우 정적 기본값
  return { model: 'gemini-2.5-flash', apiVersion: 'v1beta' };
}

async function callGeminiChat(userText, apiKey, onProgress = () => {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000);
  try {
    return await performGeminiChat(userText, apiKey, onProgress, controller.signal);
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('AI 응답 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.');
    throw error;
  } finally { clearTimeout(timeout); }
}

async function performGeminiChat(userText, apiKey, onProgress, signal) {
  const systemPrompt = `당신은 크레스티드 게코(Crested Gecko) 전문 수의학 상담사이자 집사님을 다정하고 친절하게 돕는 '게코 닥터 AI'입니다.
크레스티드 게코의 모프(릴리 화이트, 익스트림 할리퀸 등), 적정 사육 환경(온도 22~26°C, 습도 60~80%, 환기, 테라리움 세팅), 슈퍼푸드 피딩 주기와 적정 농도, 영양 결핍(MBD 대사성골질환 및 D3 칼슘제 급여), 꼬리 꺾임(FTS 플로피테일 증후군), 탈피 부전 미온수 사우나 온욕법, 스트레스 없는 사다리 타기 핸들링, 질병 징후 및 수의학적 대처법을 정확하고 전문적으로 설명하세요.
사용자의 호칭은 ${JSON.stringify(getOwnerLabel())}입니다. 사용자에게 이 호칭으로 말하세요.
한국어로 친절하고 가독성 높게, 마크다운 목록과 이모지(🦎, 🌿, 🥣, 🌡️ 등)를 섞어 성심성의껏 답변하세요.`;

  // 멀티턴 대화 기록 구성 (최근 6개 내역)
  const recentHistory = (AppState.chatHistory || []).slice(-6);
  const contents = [];

  recentHistory.forEach(item => {
    contents.push({
      role: item.sender === 'user' ? 'user' : 'model',
      parts: [{ text: item.text }]
    });
  });

  // 현재 사용자 메시지 추가
  if (recentHistory.at(-1)?.sender !== 'user' || recentHistory.at(-1)?.text !== userText) contents.push({
    role: 'user',
    parts: [{ text: userText }]
  });

  while (contents.length && contents[0].role !== 'user') contents.shift();

  // 1차 시도: 동적으로 감지된 모델 및 버전 사용
  const detected = await resolveWorkingGeminiModel(apiKey, signal);
  
  // 시도할 최신 모델 후보군 (감지된 모델 최우선)
  const candidateList = [
    { model: detected.model, ver: detected.apiVersion },
    ...(detected.alternatives || []).map(model => ({ model, ver: detected.apiVersion })),
    { model: 'gemini-2.5-flash', ver: 'v1beta' },
    { model: 'gemini-2.5-flash-lite', ver: 'v1beta' }
  ];

  let lastError = null;

  const safeKey = validateGeminiApiKey(apiKey);

  const uniqueCandidates = candidateList.filter((item, index, list) => list.findIndex(candidate => candidate.model === item.model && candidate.ver === item.ver) === index).slice(0, 3);
  for (const item of uniqueCandidates) {
    try {
      const url = `https://generativelanguage.googleapis.com/${item.ver}/models/${item.model}:generateContent?key=${encodeURIComponent(safeKey)}`;
      
      // systemInstruction과 contents 구성
      const requestBody = {
        contents: contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024
        }
      };

      // v1beta인 경우 systemInstruction 추가, 구버전일 경우 첫 메시지에 프롬프트 포함
      if (item.ver === 'v1beta') {
        requestBody.systemInstruction = { parts: [{ text: systemPrompt }] };
      } else {
        // v1 호환: 첫 번째 유저 메시지에 시스템 지침 병합
        if (contents.length > 0 && contents[0].role === 'user') {
          contents[0].parts[0].text = `[시스템 지침: ${systemPrompt}]\n\n${contents[0].parts[0].text}`;
        }
      }

      const response = await fetchGeminiWithRetry(url, {
        method: 'POST', signal,
        headers: { 
          'Content-Type': 'application/json',
          'x-goog-api-key': safeKey
        },
        body: JSON.stringify(requestBody)
      }, onProgress);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errMessage = errorData.error?.message || `HTTP ${response.status}`;
        
        // 1) 400 키 유효성 오류 (API_KEY_INVALID)
        if (errMessage.includes('API key not valid') || JSON.stringify(errorData).includes('API_KEY_INVALID')) {
          throw new Error(`API 키가 유효하지 않습니다. (Google AI Studio 페이지의 복사 아이콘 📋을 눌러 키 전체가 온전히 복사되었는지 확인해 주세요.)`);
        }

        // 2) 403 API 차단 (API_KEY_SERVICE_BLOCKED)
        if (response.status === 403 || errMessage.includes('API_KEY_SERVICE_BLOCKED') || errMessage.includes('blocked')) {
          throw new Error(`API 키 권한 차단됨: ${errMessage}`);
        }
        
        if (isTemporaryGeminiStatus(response.status)) {
          lastError = new Error(`[HTTP ${response.status}] ${errMessage}`);
          if (item !== uniqueCandidates[uniqueCandidates.length - 1]) onProgress('다른 AI 모델로 전환하고 있습니다.');
          continue;
        }

        // 3) 404 모델 못 찾음 (Generative Language API 미활성화 또는 미지원 프로젝트)
        if (response.status === 404 || errMessage.includes('not found') || errMessage.includes('not supported')) {
          cachedGeminiModelInfo = null;
          lastError = new Error(`모델 ${item.model}을 사용할 수 없습니다. [HTTP ${response.status}] ${errMessage}`);
          continue;
        }
        
        const error = new Error(`[HTTP ${response.status}] ${errMessage}`);
        error.status = response.status;
        throw error;
      }

      const json = await response.json();
      const text = (json.candidates?.[0]?.content?.parts || []).filter(part => !part.thought && typeof part.text === 'string').map(part => part.text).join('');
      if (text && text.trim() !== '') {
        // 성공한 모델을 캐시에 기록
        cachedGeminiModelInfo = { model: item.model, apiVersion: item.ver, alternatives: detected.alternatives || [] };
        return text;
      }
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      console.warn(`Gemini API [${item.ver}/${item.model}] 시도 실패:`, err);
      lastError = err;
      
      // 즉각적인 설정 문제인 경우 불필요한 반복 시도 없이 바로 중단
      if (err.status === 400 || err.status === 429 || (err.message && (
        err.message.includes('API 키 권한 차단됨') || 
        err.message.includes('유효하지 않습니다') || 
        err.message.includes('라이브러리가 활성화되지 않았습니다')
      ))) {
        break;
      }
    }
  }

  throw lastError || new Error('사용 가능한 Gemini API 모델을 찾을 수 없습니다.');
}

// ==========================================
// 9. 이벤트 리스너 및 초기화 (Init & Events)
// ==========================================
function initApp() {
  loadStorage();
  ConfettiEffect.init();

  // 오늘 날짜 텍스트 세팅
  const today = new Date();
  const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
  document.getElementById('today-date-text').textContent = today.toLocaleDateString('ko-KR', options);

  // 초기 렌더링
  renderCharacterAndStreak();
  renderWeeklyCycle();
  document.getElementById('btn-edit-weekly').addEventListener('click', () => {
    document.getElementById('weekly-save-status').textContent = '';
    setWeeklyScheduleEditing(document.getElementById('weekly-schedule-form').classList.contains('hidden'));
  });
  document.getElementById('btn-cancel-weekly').addEventListener('click', () => {
    setWeeklyScheduleEditing(false);
    document.getElementById('btn-edit-weekly').focus();
  });
  document.getElementById('weekly-schedule-form').addEventListener('submit', saveWeeklySchedule);
  renderTodoList();
  updateEnvStatus();
  renderDiary();
  updateChatApiStatus();
  renderOwnerProfile();

  // 1. 출석 체크 버튼 기능 (하루 1회만 가능: 미출석 시 클릭해야 1일 달성 및 도장 완료!)
  function performCheckIn() {
    const todayStr = getTodayString();
    const isFirstToday = !AppState.attendance.history.includes(todayStr);

    if (isFirstToday) {
      AppState.attendance.history.push(todayStr);
      AppState.attendance.lastChecked = todayStr;
      AppState.attendance.streak += 1;
      AppState.previewDay = null; // 출석 완료 시 미리보기 상태 해제
      saveStorage();

      SoundFX.playLevelUp();
      ConfettiEffect.fire(90);
      renderCharacterAndStreak();
      renderStampBoard();

      const speech = document.getElementById('character-speech').querySelector('.speech-text');
      speech.textContent = `도장 쾅! 오늘 출석체크 완료! 연속 ${AppState.attendance.streak}일째 달성했어요! 크림이가 너무 행복해해요! 🐾🎉`;
    } else {
      // 이미 오늘 출석을 완료한 경우: streak 증가하지 않고 안내만 출력
      SoundFX.playPop();
      const speech = document.getElementById('character-speech').querySelector('.speech-text');
      speech.textContent = `${getOwnerLabel()}! 오늘 출석 도장은 이미 쾅 찍었어요! 🐾 연속 ${AppState.attendance.streak}일째 유지 중이에요. 내일 또 만나요~ 💕`;

      // 버튼 흔들림 애니메이션 효과
      const btn = document.getElementById('btn-checkin');
      btn.classList.add('shake-anim');
      setTimeout(() => btn.classList.remove('shake-anim'), 600);
    }
  }

  document.getElementById('btn-checkin').addEventListener('click', performCheckIn);

  // 2. 진화 체험 미리보기 & 단계 인디케이터 클릭 (출석일수는 그대로 유지하고 오직 도마뱀 외형만 미리보기!)
  document.querySelectorAll('.btn-test-stage, .step-point').forEach(el => {
    el.addEventListener('click', (e) => {
      const targetDay = parseInt(e.currentTarget.dataset.day, 10);
      if (isNaN(targetDay)) return;

      // 실제 출석일수(streak)는 절대 바꾸지 않고, 미리보기용 변수만 설정
      AppState.previewDay = targetDay;
      SoundFX.playLevelUp();
      ConfettiEffect.fire(targetDay === 30 ? 80 : 35);
      renderCharacterAndStreak(targetDay);
    });
  });

  // 3. 캐릭터 클릭 인터랙션 (미리보기 모드일 경우 내 원래 출석 상태로 복귀!)
  document.getElementById('avatar-container').addEventListener('click', () => {
    SoundFX.playChime();
    ConfettiEffect.fire(20);

    // 미리보기 중이었다면 내 실제 크림이로 즉시 복귀
    if (AppState.previewDay !== null) {
      AppState.previewDay = null;
      renderCharacterAndStreak();
      const speech = document.getElementById('character-speech').querySelector('.speech-text');
      speech.textContent = `다시 내 원래 크림이(출석 ${AppState.attendance.streak}일차)로 돌아왔어요! 🦎💕`;
      return;
    }

    const meta = getStageMetadata(AppState.attendance.streak);
    const speech = document.getElementById('character-speech').querySelector('.speech-text');
    const cuteSounds = [
      '꾸르륵~ 집사님 손길이 따뜻해요! 크림이는 집사님이 제일 좋아! 🥰',
      '낼름! (작은 혓바닥으로 톡) 밥 시간인가요? 슈푸 먹을래요~ 🥣✨',
      '손바닥 위로 폴짝! 집사님 품이 제일 포근해요~ 🐾',
      '살랑살랑~ 기분 좋아서 꼬리를 흔들고 있어요! 💕',
      meta.speech
    ];
    const rand = cuteSounds[Math.floor(Math.random() * cuteSounds.length)];
    speech.textContent = personalizeOwnerText(rand);
  });

  // 3-1. 미리보기 복귀 버튼 클릭 이벤트
  const btnRestore = document.getElementById('btn-restore-preview');
  if (btnRestore) {
    btnRestore.addEventListener('click', () => {
      SoundFX.playChime();
      AppState.previewDay = null;
      renderCharacterAndStreak();
      const speech = document.getElementById('character-speech').querySelector('.speech-text');
      speech.textContent = `다시 내 원래 크림이(출석 ${AppState.attendance.streak}일차)로 돌아왔어요! 🦎💕`;
    });
  }

  // 4. 스탬프 모달 열기/닫기
  document.getElementById('btn-view-stamps').addEventListener('click', () => {
    renderStampBoard();
    document.getElementById('stamp-modal').classList.remove('hidden');
  });
  document.getElementById('btn-close-stamp').addEventListener('click', () => {
    document.getElementById('stamp-modal').classList.add('hidden');
  });
  document.getElementById('btn-modal-checkin-confirm').addEventListener('click', () => {
    document.getElementById('btn-checkin').click();
    document.getElementById('stamp-modal').classList.add('hidden');
  });

  // 5. 프로필 / API 설정 모달
  document.getElementById('btn-profile-edit').addEventListener('click', () => {
    document.getElementById('cfg-owner-name').value = AppState.ownerName;
    setApiKeyEditorEnabled(false);
    document.getElementById('cfg-pet-name').value = AppState.pet.name;
    document.getElementById('cfg-pet-morph').value = AppState.pet.morph;
    document.getElementById('cfg-pet-bday').value = AppState.pet.adoptedDate || '';
    document.getElementById('cfg-gemini-key').value = AppState.geminiApiKey || '';
    document.getElementById('settings-modal').classList.remove('hidden');
  });
  document.getElementById('btn-close-settings').addEventListener('click', () => {
    document.getElementById('settings-modal').classList.add('hidden');
  });
  document.getElementById('settings-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const keyInput = document.getElementById('cfg-gemini-key');
    if (!document.getElementById('api-key-settings').disabled && keyInput.value.trim()) {
      try { validateGeminiApiKey(keyInput.value); } catch (error) { alert(error.message); return; }
    }
    AppState.ownerName = document.getElementById('cfg-owner-name').value.trim().slice(0, 30);
    AppState.pet.name = document.getElementById('cfg-pet-name').value.trim() || '크림';
    AppState.pet.morph = document.getElementById('cfg-pet-morph').value.trim() || '릴리 화이트';
    AppState.pet.adoptedDate = document.getElementById('cfg-pet-bday').value;
    if (!document.getElementById('api-key-settings').disabled) AppState.geminiApiKey = sanitizeApiKey(keyInput.value);

    // AI 모드 배지 갱신
    const aiTag = document.getElementById('ai-mode-tag');
    if (AppState.geminiApiKey) {
      aiTag.textContent = '⚡ Gemini 실시간 API 가동 중';
    } else {
      aiTag.textContent = '지능형 게코 케어 AI 가동 중';
    }

    saveStorage();
    cachedGeminiModelInfo = null;
    renderCharacterAndStreak();
    renderOwnerProfile();
    updateChatApiStatus();
    document.getElementById('settings-modal').classList.add('hidden');
    SoundFX.playChime();
    alert('설정이 안전하게 저장되었습니다!');
  });

  // API 키 편집은 프로필 설정에서 버튼으로 활성화합니다.
  const settingsKeyInput = document.getElementById('cfg-gemini-key');
  document.getElementById('btn-toggle-api-settings').addEventListener('click', () => {
    setApiKeyEditorEnabled(document.getElementById('api-key-settings').disabled);
  });
  function saveSettingsApiKey(showNotice = false) {
    try {
      const key = settingsKeyInput.value.trim() ? validateGeminiApiKey(settingsKeyInput.value) : '';
      AppState.geminiApiKey = key;
      cachedGeminiModelInfo = null;
      saveStorage();
      updateChatApiStatus();
      document.getElementById('api-key-save-status').textContent = key ? 'API 키가 저장되었습니다. 상담 또는 사진 분석 시 연결을 확인합니다.' : '내장 지식 엔진 모드입니다.';
      if (showNotice) settingsKeyInput.value = key;
    } catch (error) {
      document.getElementById('api-key-save-status').textContent = error.message;
    }
  }
  settingsKeyInput.addEventListener('input', () => saveSettingsApiKey());
  settingsKeyInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); saveSettingsApiKey(true); }
  });
  document.getElementById('btn-save-settings-key').addEventListener('click', () => saveSettingsApiKey(true));

  document.getElementById('btn-export-api-key').addEventListener('click', async () => {
    try {
      const key = validateGeminiApiKey(AppState.geminiApiKey);
      if (typeof window.showSaveFilePicker !== 'function') {
        throw new Error('이 브라우저는 폴더를 선택해 저장하는 기능을 지원하지 않습니다. Chrome 또는 Edge에서 열어주세요.');
      }
      const handle = await window.showSaveFilePicker({
        id: 'gecko-api-key',
        suggestedName: 'gecko-gemini-key.json',
        types: [{ description: 'Gemini API 키 JSON 파일', accept: { 'application/json': ['.json'] } }]
      });
      const writable = await handle.createWritable();
      try {
        await writable.write(JSON.stringify({ geminiApiKey: key }, null, 2));
        await writable.close();
      } catch (error) {
        await writable.abort().catch(() => {});
        throw error;
      }
      alert('선택한 위치에 API 키 파일을 저장했습니다.');
    } catch (error) {
      if (error.name === 'AbortError') return;
      alert(error.message);
    }
  });

  const keyFileInput = document.getElementById('api-key-file-input');
  document.getElementById('btn-import-api-key').addEventListener('click', () => keyFileInput.click());
  keyFileInput.addEventListener('change', async () => {
    const file = keyFileInput.files[0];
    if (!file) return;
    try {
      if (file.size > 16384) throw new Error('API 키 파일은 16KB 이하의 JSON 파일이어야 합니다.');
      let data;
      try {
        data = JSON.parse(await file.text());
      } catch {
        throw new Error('올바른 JSON 키 파일이 아닙니다. 키 파일 저장 버튼으로 만든 파일을 선택해주세요.');
      }
      if (!data || typeof data.geminiApiKey !== 'string') {
        throw new Error('파일에 geminiApiKey 항목이 없습니다.');
      }
      const key = validateGeminiApiKey(data.geminiApiKey);
      const previousKey = AppState.geminiApiKey;
      AppState.geminiApiKey = key;
      try {
        saveStorage();
      } catch (error) {
        AppState.geminiApiKey = previousKey;
        throw new Error('브라우저에 API 키를 저장하지 못했습니다. 저장소 설정을 확인해주세요.');
      }
      cachedGeminiModelInfo = null;
      if (settingsKeyInput) settingsKeyInput.value = key;
      updateChatApiStatus();
      alert('API 키 파일을 불러와 이 브라우저에 저장했습니다.');
    } catch (error) {
      alert(error.message);
    } finally {
      keyFileInput.value = '';
    }
  });

  document.getElementById('btn-use-builtin-mode').addEventListener('click', () => {
    settingsKeyInput.value = '';
    saveSettingsApiKey(true);
  });

  // 리셋 버튼
  document.getElementById('btn-reset-data').addEventListener('click', () => {
    if (confirm('이 브라우저에 저장된 출석 기록, 로컬 일기, 스케줄을 초기화하시겠습니까? 온라인 일기는 삭제되지 않습니다.')) {
      localStorage.removeItem('gecko_app_state');
      location.reload();
    }
  });

  // 효과음 토글 버튼
  document.getElementById('btn-sound-toggle').addEventListener('click', () => {
    AppState.soundEnabled = !AppState.soundEnabled;
    document.getElementById('sound-icon').textContent = AppState.soundEnabled ? '🔔' : '🔕';
    saveStorage();
  });

  // 6. 탭 네비게이션
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const targetId = 'tab-' + btn.dataset.tab;
      document.getElementById(targetId).classList.add('active');
      AppState.currentTab = btn.dataset.tab;

      if (btn.dataset.tab === 'diary') {
        renderWeightChart();
        window.GeckoCloud?.refresh();
      }
    });
  });

  // 7. 온습도 입력 리스너
  document.getElementById('input-current-temp').addEventListener('input', updateEnvStatus);
  document.getElementById('input-current-humidity').addEventListener('input', updateEnvStatus);

  // 8. 체크리스트 체크 & 추가
  document.getElementById('todo-list').addEventListener('change', (e) => {
    if (e.target.classList.contains('todo-checkbox')) {
      const id = parseInt(e.target.dataset.id, 10);
      const item = AppState.todos.find(t => t.id === id);
      if (item) {
        item.done = e.target.checked;
        saveStorage();
        renderTodoList();
        SoundFX.playChime();
      }
    }
  });

  document.getElementById('todo-list').addEventListener('click', (e) => {
    if (e.target.classList.contains('todo-delete')) {
      const id = parseInt(e.target.dataset.id, 10);
      AppState.todos = AppState.todos.filter(t => t.id !== id);
      saveStorage();
      renderTodoList();
    }
  });

  document.getElementById('btn-add-todo').addEventListener('click', () => {
    const text = prompt('추가할 게코 케어 항목을 입력하세요 (예: 귀뚜라미 피딩, 코르크보드 소독)');
    if (text && text.trim() !== '') {
      AppState.todos.push({
        id: Date.now(),
        text: text.trim(),
        tag: '추가',
        done: false
      });
      saveStorage();
      renderTodoList();
      SoundFX.playChime();
    }
  });

  // 9. AI 사진 건강 진단 이벤트
  const detectionResizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(renderGeckoDetections) : null;
  if (detectionResizeObserver) detectionResizeObserver.observe(document.getElementById('preview-area'));
  window.addEventListener('resize', renderGeckoDetections);
  const dropzone = document.getElementById('dropzone');
  const photoInput = document.getElementById('gecko-photo-input');
  const btnSelectFile = document.getElementById('btn-select-file');

  btnSelectFile.addEventListener('click', (e) => {
    e.stopPropagation();
    photoInput.click();
  });
  dropzone.addEventListener('click', () => { if (!visionAnalysisInProgress) photoInput.click(); });

  photoInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        showImagePreview(event.target.result);
      };
      reader.readAsDataURL(file);
    }
  });

  // 드래그 앤 드롭
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (visionAnalysisInProgress) return;
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        showImagePreview(event.target.result);
      };
      reader.readAsDataURL(file);
    }
  });

  document.getElementById('btn-clear-photo').addEventListener('click', (e) => {
    e.stopPropagation();
    clearImagePreview();
  });

  // 진단 시작 버튼
  document.getElementById('btn-run-analysis').addEventListener('click', handleVisionAction);

  // 10. AI 채팅 이벤트
  document.getElementById('chat-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (text) {
      input.value = '';
      handleChatSubmit(text);
    }
  });

  document.querySelectorAll('.btn-quick-q').forEach(btn => {
    btn.addEventListener('click', () => {
      const q = btn.dataset.q;
      handleChatSubmit(q);
    });
  });

  // 11. 다이어리 저장 이벤트
  const diaryDateInput = document.getElementById('diary-date');
  if (diaryDateInput) diaryDateInput.value = getTodayString();

  document.getElementById('diary-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const date = document.getElementById('diary-date').value;
    const weight = document.getElementById('diary-weight').value;
    const feed = document.getElementById('diary-feed').value;
    const poop = document.getElementById('diary-poop').value;
    const shed = document.getElementById('diary-shed').value;
    const notes = document.getElementById('diary-notes').value;
    const photoFile = document.getElementById('diary-photo').files[0];
    const diaryAccountId = window.GeckoCloud?.accountId();

    const saveEntry = async (photoUrl = '') => {
      const newEntry = {
        id: Date.now() * 1000 + Math.floor(Math.random() * 1000),
        date,
        weight: weight ? parseFloat(weight) : null,
        feed,
        poop,
        shed,
        notes,
        photoUrl
      };
      try {
        if (window.GeckoCloud?.enabled) {
          if (window.GeckoCloud.accountId() !== diaryAccountId) throw new Error('계정이 변경되었습니다. 현재 계정에서 다시 작성해주세요.');
          await window.GeckoCloud.save(newEntry);
        }
        else {
          AppState.diaries.push(newEntry);
          saveStorage();
          renderDiary();
        }
      } catch (error) {
        alert(`일기를 저장하지 못했습니다. ${error.message}`);
        return;
      }

      // 폼 초기화
      document.getElementById('diary-weight').value = '';
      document.getElementById('diary-notes').value = '';
      document.getElementById('diary-photo').value = '';

      SoundFX.playLevelUp();
      ConfettiEffect.fire(25);
      alert('일기가 성공적으로 등록되었습니다! 📝');
    };

    if (photoFile) {
      const reader = new FileReader();
      reader.onload = (evt) => saveEntry(evt.target.result);
      reader.onerror = () => alert('사진을 읽지 못했습니다. 다시 선택해주세요.');
      reader.readAsDataURL(photoFile);
    } else {
      saveEntry();
    }
  });

  // 다이어리 삭제 이벤트
  document.getElementById('diary-list').addEventListener('click', async (e) => {
    if (e.target.classList.contains('diary-card-delete')) {
      const id = parseInt(e.target.dataset.id, 10);
      if (confirm('이 일기를 삭제하시겠습니까?')) {
        if (window.GeckoCloud?.enabled) {
          try { await window.GeckoCloud.remove(id); }
          catch (error) { alert(`일기를 삭제하지 못했습니다. ${error.message}`); }
          return;
        }
        AppState.diaries = AppState.diaries.filter(d => d.id !== id);
        saveStorage();
        renderDiary();
      }
    }
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
}

// 브라우저 로드시 초기화
document.addEventListener('DOMContentLoaded', initApp);
