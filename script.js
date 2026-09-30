// ===== SÍMBOLOS =====
const SYMBOLS = [
  { id: 'goat', html: '🐐', label: '🐐' },
  { id: 'diamond', html: '<img src="Captura de tela 2026-09-30 005218.png" class="reel-img" alt="Diamante">', label: '💎' },
  { id: 'clover', html: '<img src="17851883746a67d0167c001_1785188374_3x2_md.webp" class="reel-img" alt="Sorte">', label: '🍀' },
  { id: 'fire', html: '<img src="4831535743feb49a1792c9a626407407.webp" class="reel-img" alt="Fire">', label: '🔥' },
  { id: 'star', html: '<img src="jon-vlogs.webp" class="reel-img" alt="Star">', label: '⭐' },
  {
    id: 'blue',
    html: '<img src="6e3811d3288de17d42a50bbe6bf119509295371e6d1a98ee733b6ff5ad584ccd.webp" class="reel-img" alt="Prêmio">',
    label: '🔵'
  },
  {
    id: 'white',
    html: '<img src="772fae22-0dda-46ca-a066-e4f6fd6f9acd-profile_image-300x300.webp" class="reel-img" alt="Azar">',
    label: '⚪'
  },
];

// Pesos de sorteio — soma = 100
const WEIGHTS = [20, 10, 13, 13, 12, 17, 15];

// ===== CONSTANTES =====
const BANCA_INICIAL = 300;
const COOLDOWN_MS = 5 * 60 * 60 * 1000; // 5 horas
const JACKPOT_VALUE = 10000;

// Pools de perda — peso maior = mais freqüente
const LOSS_POOL = [
  { value: -10, w: 22 },
  { value: -20, w: 20 },
  { value: -30, w: 18 },
  { value: -50, w: 15 },
  { value: -75, w: 10 },
  { value: -100, w: 8 },
  { value: -150, w: 5 },
  { value: -200, w: 2 },
];

// Pool de ganho para PAR
const SMALL_POOL = [
  { value: 20, w: 30 },
  { value: 30, w: 25 },
  { value: 50, w: 25 },
  { value: 75, w: 20 },
];

// Pool de ganho para TRIPLETA
const BIG_POOL = [
  { value: 100, w: 35 },
  { value: 150, w: 30 },
  { value: 250, w: 25 },
  { value: 500, w: 10 },
];

function pickFromPool(pool) {
  const total = pool.reduce((s, e) => s + e.w, 0);
  let r = Math.random() * total;
  for (const entry of pool) {
    r -= entry.w;
    if (r <= 0) return entry.value;
  }
  return pool[pool.length - 1].value;
}

let currentBet = 0; // valor da aposta desta rodada (negativo)

// ===== ESTADO (com persistência) =====
function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem('goat22_state') || '{}');
    return {
      banca: typeof s.banca === 'number' ? s.banca : BANCA_INICIAL,
      rounds: typeof s.rounds === 'number' ? s.rounds : 0,
      best: typeof s.best === 'number' ? s.best : 0,
      history: Array.isArray(s.history) ? s.history : [],
      brokeAt: s.brokeAt || null, // timestamp ISO quando banca zerou
    };
  } catch { return { banca: BANCA_INICIAL, rounds: 0, best: 0, history: [], brokeAt: null }; }
}

function saveState() {
  localStorage.setItem('goat22_state', JSON.stringify(state));
}

let state = loadState();
let isSpinning = false;
let brokeTimerInterval = null;

// ===== REFS DOM =====
const spinBtn = document.getElementById('spin-btn');
const btnText = document.getElementById('btn-text');
const bancaValEl = document.getElementById('banca-valor');
const roundsEl = document.getElementById('rounds');
const bestEl = document.getElementById('best');
const resultMsg = document.getElementById('result-message');
const histList = document.getElementById('history-list');
const jackpotOv = null; // substituído pelo goat-overlay
const lossOverlay = document.getElementById('loss-overlay');
const lossMsgEl = document.getElementById('loss-message');
const lossClose = document.getElementById('loss-close');
const imgLoss = document.getElementById('img-loss');
const brokeOverlay = document.getElementById('broke-overlay');
const brokeTimerEl = document.getElementById('broke-timer');
const confettiCt = document.getElementById('confetti-container');
const coinsBgEl = document.getElementById('coins-bg');
const goatOverlay = document.getElementById('goat-overlay');
const goatPrizeEl = document.getElementById('goat-prize');
const reels = [
  document.getElementById('reel-0'),
  document.getElementById('reel-1'),
  document.getElementById('reel-2'),
];

// ===== SORTEIO COM PESO =====
function weightedRandom() {
  const total = WEIGHTS.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < SYMBOLS.length; i++) {
    r -= WEIGHTS[i];
    if (r <= 0) return SYMBOLS[i];
  }
  return SYMBOLS[SYMBOLS.length - 1];
}

// ===== ANÁLISE DO RESULTADO =====
function analyzeResult(s0, s1, s2) {
  const allGoat = s0.id === 'goat' && s1.id === 'goat' && s2.id === 'goat';
  const allEqual = s0.id === s1.id && s1.id === s2.id;
  const twoEqual = s0.id === s1.id || s1.id === s2.id || s0.id === s2.id;

  if (allGoat) return { type: 'jackpot' };
  if (allEqual) return { type: 'big' };
  if (twoEqual) return { type: 'small' };
  return { type: 'loss' };
}

// ===== MENSAGENS =====
const MESSAGES = {
  jackpot: ['🏆 JACKPOT DO GOAT22! TRÊS CABRITOS! ISSO É IMPOSSÍVEL!'],
  big: [
    '🎉 TRIPLETA! O Goat22 aprova!',
    '🔥 TRÊS IGUAIS! CHAME O PT',
    '👑 TRÊS IGUAIS! Não perde o aluguel hoje!',
  ],
  small: [
    '😏 QUASE LA ? A BET TA VOLTANDO ',
    '🍀 PAR DO GOAT TA CHEGANDO',
    '⭐ BOLSONARO É A TROPA DO GOAT.',
    '🐐 O Goat22 teve dó de você. Só um par.',
  ],
  loss: [
    '💀 Não deu. −50 pts lLULA TE PEGOU.',
    '😅 VOCE É UM BOSTA NEM SUA FAMILIA TE QUER',
    '🙃 Nada. Zero. Gira de novo, otimista!',
    '🤡 Errou tudo. O Goat22 está rindo.',
    '📉 O gráfico do seu desempenho... só desce.',
    '😬 O Goat22 não quer te dar nada hoje.',
  ],
};

function getMessage(type) {
  const list = MESSAGES[type];
  return list[Math.floor(Math.random() * list.length)];
}

// ===== ATUALIZA UI =====
function renderScoreboard() {
  bancaValEl.textContent = state.banca;
  roundsEl.textContent = state.rounds;
  bestEl.textContent = state.best;

  // Banca baixa: vermelho
  if (state.banca <= 200) {
    bancaValEl.classList.add('banca-low');
  } else {
    bancaValEl.classList.remove('banca-low');
  }
}

function renderHistory() {
  histList.innerHTML = '';
  if (state.history.length === 0) {
    histList.innerHTML = '<li class="history-empty">Nenhuma rodada ainda... Aperta o botão, covarde!</li>';
    return;
  }
  state.history.forEach(item => {
    const li = document.createElement('li');
    const sign = item.pts >= 0 ? '+' : '';
    li.textContent = `${item.symbols} — ${sign}${item.pts} pts`;
    if (item.type === 'jackpot') li.classList.add('h-jackpot');
    else if (item.type === 'big') li.classList.add('h-big');
    else if (item.type === 'small') li.classList.add('h-win');
    histList.appendChild(li);
  });
}

function popBanca() {
  bancaValEl.classList.remove('score-pop');
  void bancaValEl.offsetWidth;
  bancaValEl.classList.add('score-pop');
}

// ===== ANIMAÇÃO DE ROLOS =====
let spinIntervals = [];

function startSpinAnimation() {
  reels.forEach((reel, i) => {
    reel.classList.remove('win');
    reel.classList.add('spinning');
    spinIntervals[i] = setInterval(() => {
      reel.innerHTML = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)].html;
    }, 80);
  });
}

function stopSpinAnimation(finalSymbols, callback) {
  reels.forEach((reel, i) => {
    setTimeout(() => {
      clearInterval(spinIntervals[i]);
      reel.classList.remove('spinning');
      reel.innerHTML = finalSymbols[i].html;
      if (i === reels.length - 1) callback();
    }, i * 220);
  });
}

// ===== RESULTADO NA TELA =====
function showResult(type, message) {
  resultMsg.className = 'result-message type-' + type;
  resultMsg.textContent = message;
}

// ===== MOEDAS DE FUNDO =====
const COIN_EMOJI = '🪙';
let coinRainInterval = null;

function createCoin(large) {
  const coin = document.createElement('span');
  coin.classList.add('coin');
  coin.textContent = COIN_EMOJI;
  const size = large ? (22 + Math.random() * 20) : (12 + Math.random() * 14);
  const opacity = 0.3 + Math.random() * 0.45;
  const dur = large ? (2 + Math.random() * 2) : (5 + Math.random() * 6);
  coin.style.setProperty('--coin-op', opacity);
  coin.style.left = (Math.random() * 100) + 'vw';
  coin.style.fontSize = size + 'px';
  coin.style.animationDuration = dur + 's';
  coin.style.animationDelay = (Math.random() * 0.5) + 's';
  coinsBgEl.appendChild(coin);
  coin.addEventListener('animationend', () => coin.remove(), { once: true });
}

function startCoinRain() {
  // Batch inicial espalhado
  for (let i = 0; i < 10; i++) {
    setTimeout(() => createCoin(false), Math.random() * 4000);
  }
  // Chuva contínua: 1 moeda a cada 700ms
  coinRainInterval = setInterval(() => createCoin(false), 700);
}

function burstCoins(count) {
  for (let i = 0; i < count; i++) {
    setTimeout(() => createCoin(true), Math.random() * 1500);
  }
}

// ===== CONFETTI =====
const CONFETTI_COLORS = ['#FFD700', '#A855F7', '#FF6B00', '#FF3366', '#00FFAA', '#fff'];

function fireConfetti(intense) {
  confettiCt.innerHTML = '';
  const qty = intense ? 120 : 70;
  for (let i = 0; i < qty; i++) {
    const p = document.createElement('div');
    p.classList.add('confetti-piece');
    p.style.left = Math.random() * 100 + 'vw';
    p.style.backgroundColor = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
    p.style.animationDuration = (1.5 + Math.random() * 2) + 's';
    p.style.animationDelay = (Math.random() * 0.8) + 's';
    p.style.width = (6 + Math.random() * 8) + 'px';
    p.style.height = (10 + Math.random() * 10) + 'px';
    confettiCt.appendChild(p);
  }
  setTimeout(() => { confettiCt.innerHTML = ''; }, intense ? 6000 : 4000);
}

// ===== OVERLAY TU É GOAATTT =====
function showGoatOverlay(pts) {
  goatPrizeEl.textContent = `+${pts} PONTOS FICTÍCIOS!`;
  goatOverlay.classList.remove('hidden', 'goat-fadeout');

  fireConfetti(true);
  burstCoins(40);             // chuva intensa de moedas grandes
  reels.forEach(r => r.classList.add('win'));

  // Auto-dismiss após 5 segundos
  setTimeout(() => {
    goatOverlay.classList.add('goat-fadeout');
    setTimeout(() => {
      goatOverlay.classList.add('hidden');
      reels.forEach(r => r.classList.remove('win'));
    }, 600);
  }, 5000);
}

// ===== LOSS OVERLAY =====
function showLoss(message) {
  lossMsgEl.textContent = message;
  imgLoss.style.animation = 'none';
  void imgLoss.offsetWidth;
  imgLoss.style.animation = '';
  lossOverlay.classList.remove('hidden');
}

lossClose.addEventListener('click', () => lossOverlay.classList.add('hidden'));

// ===== BANCA ZERADA =====
function formatCountdown(ms) {
  if (ms <= 0) return '00:00:00';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1_000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function startBrokeCountdown() {
  brokeOverlay.classList.remove('hidden');
  spinBtn.disabled = true;

  if (brokeTimerInterval) clearInterval(brokeTimerInterval);

  brokeTimerInterval = setInterval(() => {
    const elapsed = Date.now() - new Date(state.brokeAt).getTime();
    const remaining = COOLDOWN_MS - elapsed;

    if (remaining <= 0) {
      clearInterval(brokeTimerInterval);
      brokeTimerInterval = null;
      // Restaura banca
      state.banca = BANCA_INICIAL;
      state.brokeAt = null;
      saveState();
      brokeOverlay.classList.add('hidden');
      spinBtn.disabled = false;
      drawNextBet();
      renderScoreboard();
      brokeTimerEl.textContent = '05:00:00';
    } else {
      brokeTimerEl.textContent = formatCountdown(remaining);
    }
  }, 1000);

  // Exibe o tempo imediatamente
  const elapsed = Date.now() - new Date(state.brokeAt).getTime();
  brokeTimerEl.textContent = formatCountdown(Math.max(0, COOLDOWN_MS - elapsed));
}

function triggerBroke() {
  state.banca = 0;
  state.brokeAt = new Date().toISOString();
  saveState();
  renderScoreboard();
  startBrokeCountdown();
}

// ===== GIRO PRINCIPAL =====

// Sorteia e exibe a aposta da próxima rodada
function drawNextBet() {
  currentBet = pickFromPool(LOSS_POOL); // já negativo
  const bancaApostaEl = document.querySelector('.banca-aposta');
  if (bancaApostaEl) bancaApostaEl.innerHTML = `APOSTA: <strong>${Math.abs(currentBet)} pts</strong> por rodada`;
  btnText.textContent = `🎰 GIRAR! (${currentBet} pts)`;
}

function spin() {
  if (isSpinning) return;
  if (state.banca + currentBet < 0) { triggerBroke(); return; }

  isSpinning = true;
  spinBtn.disabled = true;
  btnText.textContent = '🌀 Girando...';
  resultMsg.classList.add('hidden');

  startSpinAnimation();

  setTimeout(() => {
    const finalSymbols = [weightedRandom(), weightedRandom(), weightedRandom()];

    stopSpinAnimation(finalSymbols, () => {
      const result = analyzeResult(...finalSymbols);
      const labelStr = finalSymbols.map(s => s.label).join(' ');

      // Calcula o valor real desta rodada
      let prize;
      if (result.type === 'jackpot') prize = JACKPOT_VALUE;
      else if (result.type === 'big') prize = pickFromPool(BIG_POOL);
      else if (result.type === 'small') prize = pickFromPool(SMALL_POOL);
      else prize = currentBet; // negativo

      // Mensagem com o valor real
      const icons = { jackpot: '🐐', big: '🎉', small: '🍀', loss: '💣' };
      const sign = prize > 0 ? '+' : '';
      const flavor = getMessage(result.type);
      const message = `${icons[result.type]} ${sign}${prize} pts — ${flavor}`;
      // Atualiza estado
      state.banca = Math.max(0, state.banca + prize);
      state.rounds += 1;
      if (prize > state.best) state.best = prize;

      // Histórico (máx 30)
      state.history.unshift({ type: result.type, symbols: labelStr, pts: prize });
      if (state.history.length > 30) state.history.pop();

      saveState();
      renderScoreboard();
      renderHistory();
      popBanca();
      showResult(result.type, message);

      if (result.type === 'loss') {
        setTimeout(() => showLoss(message), 400);
      } else if (result.type !== 'jackpot') {
        reels.forEach(r => r.classList.add('win'));
        setTimeout(() => reels.forEach(r => r.classList.remove('win')), 1500);
      }

      if (result.type === 'jackpot') {
        setTimeout(() => showGoatOverlay(prize), 600);
      }

      isSpinning = false;

      // Verifica banca após rodada
      if (state.banca <= 0) {
        setTimeout(() => triggerBroke(), result.type === 'jackpot' ? 6000 : 800);
      } else {
        drawNextBet();
        spinBtn.disabled = false;
      }
    });
  }, 1800);
}

spinBtn.addEventListener('click', spin);

// ===== INICIALIZAÇÃO =====
const goatSym = SYMBOLS.find(s => s.id === 'goat');
reels.forEach(r => { r.innerHTML = goatSym.html; });

renderScoreboard();
renderHistory();
startCoinRain();
drawNextBet(); // define aposta inicial e texto do botão

// Verifica se a banca estava zerada ao reabrir a página
if (state.brokeAt) {
  const elapsed = Date.now() - new Date(state.brokeAt).getTime();
  if (elapsed < COOLDOWN_MS) {
    startBrokeCountdown();
  } else {
    // Cooldown já terminou enquanto a página estava fechada
    state.banca = BANCA_INICIAL;
    state.brokeAt = null;
    saveState();
    renderScoreboard();
  }
}
