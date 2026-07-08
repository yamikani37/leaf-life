/** LEAF LIFE — Photosynthesis Survival Game **/

// ---- constants ----
const GLUCOSE_QUIZ_INTERVAL = 100; // trigger quiz every 100 glucose

const W = 860,
  H = 400;

// ---- static quizzes (fallback) ----
const STATIC_QUIZZES = {
  sprout: {
    q: "What gas enters the leaf through the stomata to fuel photosynthesis?",
    options: ["Carbon dioxide", "Nitrogen", "Oxygen"],
    correct: 0,
    explain: "Stomata open to let CO₂ in — it supplies the carbon atoms glucose is built from.",
    unlock: "Deeper Roots — water reserves drain slower."
  },
  mature: {
    q: "Splitting water molecules during the light reactions releases which gas as a byproduct?",
    options: ["Oxygen", "Carbon dioxide", "Hydrogen gas"],
    correct: 0,
    explain: "Photolysis of water releases oxygen — one reason plants are natural air purifiers.",
    unlock: "Wider Leaves — bigger canopy catches more sunlight."
  },
  flowering: {
    q: "Where in the chloroplast does the Calvin cycle assemble glucose?",
    options: ["The stroma", "The thylakoid membrane", "The nucleus"],
    correct: 0,
    explain: "The Calvin cycle runs in the stroma, using CO₂ and energy carriers made by the light reactions.",
    unlock: "Thick Cuticle — hardier against pollution and pests."
  }
};

// ---- educational facts (toasts) ----
const FACTS = {
  sun: { title: "Sunlight Capture", body: "Chlorophyll in the leaves absorbs light energy, powering the light-dependent reactions of photosynthesis." },
  water: { title: "Water Uptake", body: "Roots draw water from the soil. That water is split apart to release electrons that power the light reactions — and oxygen gas as a byproduct." },
  co2: { title: "Carbon Dioxide Intake", body: "Stomata, tiny pores on the leaf surface, open to let CO₂ in — and let oxygen and water vapor back out." },
  glucose: { title: "Glucose Production", body: "In the Calvin cycle, CO₂ combines with energy from the light reactions to build glucose (C₆H₁₂O₆) — the plant's food." },
  cloud: { title: "Cloud Cover", body: "Less light reaching the leaves slows the light-dependent reactions, so sunlight capture drops during cloud cover." },
  drought: { title: "Drought", body: "When water is scarce, stomata close to conserve moisture — but that also blocks CO₂ from entering, slowing photosynthesis." },
  pollution: { title: "Pollution", body: "Airborne pollutants can clog stomata and dirty the air, reducing the clean CO₂ available for photosynthesis." },
  pest: { title: "Pest Damage", body: "Pests chew through leaf tissue, shrinking the surface area available to capture sunlight." },
  overwater: { title: "Root Rot Risk", body: "Too much water floods the soil and drowns root cells, cutting off their oxygen supply." },
  stress: { title: "Stress Response", body: "When sunlight, water, or CO₂ run low, the plant can't keep up glucose production and starts drawing on stored reserves." },
  storage: { title: "Storing Energy", body: "Extra glucose is converted to starch and stored, or used right away to build new roots, stems, and leaves — that's what fuels growth." }
};

// ====================================================================
//  AUDIO (Web Audio)
// ====================================================================
let audioCtx = null,
  masterGain = null,
  soundOn = true,
  ambientStarted = false;

function initAudio() {
  if (audioCtx) return;
  try {
    audioCtx = new(window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = soundOn ? 0.5 : 0;
    masterGain.connect(audioCtx.destination);
    startAmbient();
  } catch (_) { /* audio not available */ }
}

function playTone(freq, dur, type, vol, delay) {
  if (!audioCtx || !soundOn) return;
  type = type || 'sine';
  vol = vol === undefined ? 0.18 : vol;
  delay = delay || 0;
  const t0 = audioCtx.currentTime + delay;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(vol, t0 + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function playChime(type) {
  if (type === 'sun') playTone(880, 0.22, 'triangle', 0.16);
  else if (type === 'water') playTone(520, 0.28, 'sine', 0.16);
  else playTone(360, 0.28, 'sine', 0.16);
}
function playAlert() { playTone(170, 0.4, 'sawtooth', 0.1); }
function playFanfare() {
  playTone(523, 0.15, 'sine', 0.2);
  playTone(659, 0.15, 'sine', 0.2, 0.12);
  playTone(784, 0.3, 'sine', 0.22, 0.24);
}
function playQuizResult(correct) {
  if (correct) {
    playTone(660, 0.15, 'sine', 0.2);
    playTone(880, 0.25, 'sine', 0.22, 0.13);
  } else {
    playTone(220, 0.35, 'sawtooth', 0.14);
  }
}
function startAmbient() {
  if (!audioCtx || ambientStarted) return;
  ambientStarted = true;
  const o1 = audioCtx.createOscillator();
  o1.type = 'sine';
  o1.frequency.value = 110;
  const o2 = audioCtx.createOscillator();
  o2.type = 'sine';
  o2.frequency.value = 164.8;
  const g = audioCtx.createGain();
  g.gain.value = 0.032;
  o1.connect(g);
  o2.connect(g);
  g.connect(masterGain);
  o1.start();
  o2.start();
}

function toggleSound() {
  soundOn = !soundOn;
  if (masterGain) masterGain.gain.value = soundOn ? 0.5 : 0;
  document.getElementById('sound-btn').textContent = soundOn ? '🔊' : '🔇';
}

// Activate audio on first user gesture
window.addEventListener('keydown', initAudio, { once: true });
window.addEventListener('click', initAudio, { once: true });
window.addEventListener('touchstart', initAudio, { once: true });
document.getElementById('sound-btn').addEventListener('click', () => { initAudio();
  toggleSound(); });

// ====================================================================
//  AI QUIZ via Cloudflare Worker Proxy
// ====================================================================
const WORKER_URL = 'https://leaf-life-ai.yami-kan37.workers.dev/ask';

// Fetch a question from your Cloudflare Worker
async function fetchAIQuestion(stage) {
  console.log('🔄 Fetching AI question for stage:', stage);
  try {
    const response = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage })
    });
    if (!response.ok) {
      console.warn('❌ Worker error:', response.status);
      return null;
    }
    const data = await response.json();
    console.log('✅ AI response:', data);
    if (!data.choices || !data.choices[0]) return null;
    const content = data.choices[0].message.content;
    const jsonMatch = content.match(/\{.*\}/s);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.question || !parsed.options || !Array.isArray(parsed.options) || parsed.options.length < 2) return null;
    if (typeof parsed.correctIndex !== 'number') parsed.correctIndex = 0;
    parsed.explain = 'Correct! (AI-generated question)';
    parsed.unlock = 'You learned something new!';
    return parsed;
  } catch (e) {
    console.warn('❌ AI fetch error:', e);
    return null;
  }
}

// ====================================================================
//  LEADERBOARD
// ====================================================================
async function saveScore(name, score, stage) {
  if (typeof window.storage === 'undefined') return false;
  try {
    const key = 'score:' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
    await window.storage.set(key, JSON.stringify({ name: name || 'Anonymous', score: Math.round(score), stage }), true);
    return true;
  } catch (_) { return false; }
}
async function loadLeaderboard() {
  if (typeof window.storage === 'undefined') return null;
  try {
    const list = await window.storage.list('score:', true);
    if (!list || !list.keys) return [];
    const entries = [];
    for (const k of list.keys.slice(0, 60)) {
      try {
        const r = await window.storage.get(k, true);
        if (r && r.value) entries.push(JSON.parse(r.value));
      } catch (_) {}
    }
    entries.sort((a, b) => b.score - a.score);
    return entries.slice(0, 5);
  } catch (_) { return null; }
}
function renderLeaderboard(entries) {
  const list = document.getElementById('leaderboard-list');
  if (entries === null) { list.innerHTML = '<li>Leaderboard unavailable</li>'; return; }
  if (entries.length === 0) { list.innerHTML = '<li>Be the first to save a score!</li>'; return; }
  list.innerHTML = entries.map(e =>
    `<li><span>${escapeHtml(e.name)} <span style="opacity:.6">(${escapeHtml(e.stage||'')})</span></span><b>${e.score}</b></li>`
  ).join('');
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } [c]));
}

// ====================================================================
//  TOAST
// ====================================================================
const seen = {};
function showFact(key, force) {
  if (seen[key] && !force) return;
  seen[key] = true;
  const f = FACTS[key];
  const toast = document.getElementById('toast');
  document.getElementById('toast-title').textContent = f.title;
  document.getElementById('toast-body').textContent = f.body;
  toast.classList.add('show');
  clearTimeout(showFact._t);
  showFact._t = setTimeout(() => toast.classList.remove('show'), 5200);
}

// ====================================================================
//  GAME STATE
// ====================================================================
function freshState() {
  return {
    sun: 60,
    water: 60,
    co2: 60,
    health: 100,
    glucose: 0,
    energy: 0,
    stage: 'seedling',
    started: performance.now(),
    over: false,
    cloudActive: false,
    droughtActive: false,
    pollutionActive: false,
    rootsUnlocked: false,
    leavesUnlocked: false,
    cuticleUnlocked: false,
    sunAlerted: false,
    waterAlerted: false,
    co2Alerted: false,
    lastQuizGlucose: 0   // track last glucose at which a quiz was triggered
  };
}
const state = freshState();

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function refreshHUD() {
  document.getElementById('sun-val').textContent = Math.round(state.sun);
  document.getElementById('water-val').textContent = Math.round(state.water);
  document.getElementById('co2-val').textContent = Math.round(state.co2);
  document.getElementById('health-val').textContent = Math.round(state.health);
  document.getElementById('glucose-val').textContent = Math.round(state.glucose);
  document.getElementById('energy-val').textContent = Math.round(state.energy);
  document.getElementById('sun-fill').style.width = state.sun + '%';
  document.getElementById('water-fill').style.width = state.water + '%';
  document.getElementById('co2-fill').style.width = state.co2 + '%';
  document.getElementById('health-fill').style.width = state.health + '%';
  document.getElementById('energy-fill').style.width = clamp(state.energy, 0, 100) + '%';
  document.getElementById('health-fill').style.background = state.health < 30 ? 'var(--accent-danger)' : 'var(--accent-health)';
  document.getElementById('stage-val').textContent = state.stage.charAt(0).toUpperCase() + state.stage.slice(1);
  document.getElementById('spend-btn').disabled = state.energy < 30 || state.over;
}

document.getElementById('spend-btn').addEventListener('click', () => {
  if (state.energy < 30 || state.over) return;
  state.energy -= 30;
  state.health = clamp(state.health + 20, 0, 100);
  showFact('storage');
  playFanfare();
  refreshHUD();
});

// ====================================================================
//  QUIZ FLOW (AI-first, fallback to static)
// ====================================================================
let gameRef = null;

async function triggerLearningBurst(stageKey) {
  // Try AI first
  let quiz = await fetchAIQuestion(stageKey);
  let source = 'AI';
  if (!quiz) {
    quiz = STATIC_QUIZZES[stageKey];
    source = 'static';
    if (!quiz) return;
  }

  // Pause the Phaser scene
  if (gameRef && gameRef.scene) gameRef.scene.pause('main');

  const overlay = document.getElementById('quiz-overlay');
  const optionsBox = document.getElementById('quiz-options');
  const feedback = document.getElementById('quiz-feedback');
  const continueBtn = document.getElementById('quiz-continue');
  const sourceLabel = document.getElementById('quiz-source');

  sourceLabel.textContent = source === 'AI' ? '🤖 AI‑generated question' : '🌱 Learning Burst';
  document.getElementById('quiz-question').textContent = quiz.q;
  feedback.textContent = '';
  continueBtn.style.display = 'none';
  optionsBox.innerHTML = '';

  // Determine correct index (0-based)
  const correctIndex = quiz.correct || 0;

  quiz.options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className = 'quiz-option';
    btn.textContent = opt;
    btn.addEventListener('click', () => {
      Array.from(optionsBox.children).forEach(c => c.disabled = true);
      const correct = i === correctIndex;
      btn.classList.add(correct ? 'correct' : 'wrong');
      if (!correct) {
        // highlight correct answer
        if (optionsBox.children[correctIndex]) {
          optionsBox.children[correctIndex].classList.add('correct');
        }
      }
      const explainText = quiz.explain || (correct ? 'Correct!' : 'Incorrect. The correct answer is highlighted.');
      feedback.textContent = explainText + (correct ? '  (+15 energy)' : '');
      playQuizResult(correct);
      if (correct) { state.energy = clamp(state.energy + 15, 0, 100);
        refreshHUD(); }
      continueBtn.style.display = 'inline-block';
    });
    optionsBox.appendChild(btn);
  });

  overlay.classList.add('show');

  continueBtn.onclick = () => {
    overlay.classList.remove('show');
    if (gameRef && gameRef.scene) gameRef.scene.resume('main');
  };
}

// ====================================================================
//  PLANT TEXTURE GENERATOR
// ====================================================================
function drawPlantTexture(scene, key, opts) {
  const g = scene.add.graphics();
  const cx = 70,
    groundY = 150;
  g.fillStyle(0x6b4a34, 1);
  g.fillRect(cx - 26, groundY, 52, 20);
  g.fillStyle(0x5a3b28, 1);
  g.fillRect(cx - 26, groundY, 52, 5);
  g.lineStyle(opts.stemW, 0x3d7a45, 1);
  g.beginPath();
  g.moveTo(cx, groundY);
  g.lineTo(cx, groundY - opts.stemH);
  g.strokePath();
  const pairs = opts.leafPairs;
  for (let i = 0; i < pairs; i++) {
    const t = (i + 1) / (pairs + 0.4);
    const ly = groundY - opts.stemH * t;
    const r = opts.leafR * (0.6 + 0.4 * t);
    g.fillStyle(0x4c9a52, 1);
    g.fillEllipse(cx - r * 1.3, ly, r * 1.8, r);
    g.fillEllipse(cx + r * 1.3, ly, r * 1.8, r);
  }
  if (opts.flower) {
    const fy = groundY - opts.stemH - 6;
    g.fillStyle(0xE8A33D, 1);
    for (let a = 0; a < 6; a++) {
      const ang = (Math.PI * 2 / 6) * a;
      g.fillEllipse(cx + Math.cos(ang) * 10, fy + Math.sin(ang) * 10, 10, 6);
    }
    g.fillStyle(0xD4AF37, 1);
    g.fillCircle(cx, fy, 6);
  }
  g.generateTexture(key, 140, 170);
  g.destroy();
}

// ====================================================================
//  PHASER MAIN SCENE
// ====================================================================
class MainScene extends Phaser.Scene {
  constructor() {
    super('main');
  }
  preload() {}
  create() {
    this.rootT = 0;

    // sky
    const sky = this.add.graphics();
    sky.fillGradientStyle(0x264a33, 0x264a33, 0x0f1c13, 0x0f1c13, 1);
    sky.fillRect(0, 0, W, H);

    // clouds
    let g = this.add.graphics();
    g.fillStyle(0xffffff, 0.10);
    g.fillEllipse(45, 20, 90, 26);
    g.fillEllipse(95, 14, 60, 20);
    g.generateTexture('deco_cloud_far', 140, 40);
    g.destroy();
    g = this.add.graphics();
    g.fillStyle(0xffffff, 0.16);
    g.fillEllipse(40, 18, 76, 22);
    g.fillEllipse(80, 12, 50, 16);
    g.generateTexture('deco_cloud_near', 120, 34);
    g.destroy();

    this.farClouds = [
      this.add.image(120, 40, 'deco_cloud_far').setAlpha(0.7),
      this.add.image(480, 25, 'deco_cloud_far').setAlpha(0.5),
      this.add.image(740, 55, 'deco_cloud_far').setAlpha(0.6)
    ];
    this.nearClouds = [
      this.add.image(260, 70, 'deco_cloud_near').setAlpha(0.5),
      this.add.image(650, 85, 'deco_cloud_near').setAlpha(0.4)
    ];

    // soil
    const soil = this.add.graphics();
    soil.fillStyle(0x14251a, 1);
    soil.fillRect(0, H - 45, W, 45);
    soil.fillStyle(0x0e1c12, 1);
    soil.fillRect(0, H - 45, W, 6);
    this.rootsGfx = this.add.graphics();

    // plant textures
    drawPlantTexture(this, 'plant_seedling', { stemH: 18, stemW: 4, leafR: 9, leafPairs: 1, flower: false });
    drawPlantTexture(this, 'plant_sprout', { stemH: 45, stemW: 6, leafR: 15, leafPairs: 2, flower: false });
    drawPlantTexture(this, 'plant_mature', { stemH: 72, stemW: 8, leafR: 21, leafPairs: 3, flower: false });
    drawPlantTexture(this, 'plant_flowering', { stemH: 82, stemW: 9, leafR: 23, leafPairs: 3, flower: true });

    // resources
    g = this.add.graphics();
    g.fillStyle(0xE8A33D, 1);
    g.fillCircle(16, 16, 11);
    g.lineStyle(3, 0xE8A33D, 1);
    for (let a = 0; a < 8; a++) {
      const ang = (Math.PI * 2 / 8) * a;
      g.beginPath();
      g.moveTo(16 + Math.cos(ang) * 14, 16 + Math.sin(ang) * 14);
      g.lineTo(16 + Math.cos(ang) * 19, 16 + Math.sin(ang) * 19);
      g.strokePath();
    }
    g.generateTexture('res_sun', 32, 32);
    g.destroy();
    g = this.add.graphics();
    g.fillStyle(0x4FA8C9, 1);
    g.fillCircle(14, 18, 11);
    g.fillTriangle(14, 0, 5, 16, 23, 16);
    g.generateTexture('res_water', 28, 30);
    g.destroy();
    g = this.add.graphics();
    g.fillStyle(0x2a3d33, 0.9);
    g.fillCircle(16, 16, 13);
    g.lineStyle(2, 0x9B8FB0, 1);
    g.strokeCircle(16, 16, 13);
    g.generateTexture('res_co2', 32, 32);
    g.destroy();
    g = this.add.graphics();
    g.fillStyle(0xB5303A, 1);
    g.fillCircle(12, 12, 10);
    g.lineStyle(1.5, 0x1a0a0a, 1);
    g.beginPath();
    g.moveTo(12, 2);
    g.lineTo(12, 22);
    g.strokePath();
    g.fillStyle(0x1a0a0a, 1);
    g.fillCircle(8, 8, 1.6);
    g.fillCircle(16, 8, 1.6);
    g.fillCircle(8, 16, 1.6);
    g.fillCircle(16, 16, 1.6);
    g.generateTexture('res_pest', 24, 24);
    g.destroy();
    g = this.add.graphics();
    g.fillStyle(0xcfd6cf, 0.55);
    g.fillEllipse(45, 20, 90, 30);
    g.fillEllipse(90, 15, 70, 24);
    g.fillEllipse(10, 22, 60, 22);
    g.generateTexture('cloud_tex', 130, 40);
    g.destroy();

    // particles
    g = this.add.graphics();
    g.fillStyle(0xffe6a3, 1);
    g.fillCircle(4, 4, 4);
    g.generateTexture('particle_spark', 8, 8);
    g.destroy();
    g = this.add.graphics();
    g.fillStyle(0x9fd6ec, 1);
    g.fillCircle(4, 4, 4);
    g.generateTexture('particle_ripple', 8, 8);
    g.destroy();
    g = this.add.graphics();
    g.fillStyle(0xc9c2d8, 1);
    g.fillCircle(4, 4, 4);
    g.generateTexture('particle_bubble', 8, 8);
    g.destroy();

    this.sparkleEmitter = this.add.particles(0, 0, 'particle_spark', {
      speed: { min: 40, max: 100 },
      lifespan: 500,
      scale: { start: 0.9, end: 0 },
      alpha: { start: 1, end: 0 },
      quantity: 0,
      emitting: false
    });
    this.rippleEmitter = this.add.particles(0, 0, 'particle_ripple', {
      speed: { min: 20, max: 60 },
      lifespan: 600,
      scale: { start: 1, end: 0 },
      alpha: { start: 0.9, end: 0 },
      quantity: 0,
      emitting: false
    });
    this.bubbleEmitter = this.add.particles(0, 0, 'particle_bubble', {
      speed: { min: 15, max: 45 },
      lifespan: 550,
      scale: { start: 0.8, end: 0 },
      alpha: { start: 0.85, end: 0 },
      quantity: 0,
      emitting: false
    });

    // plant
    this.plantX = W / 2;
    this.plant = this.physics.add.sprite(this.plantX, H - 45, 'plant_seedling');
    this.plant.setOrigin(0.5, 1);
    this.plant.body.setAllowGravity(false);
    this.plant.body.setSize(110, 90).setOffset(15, 5);

    // keyboard
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keyA = this.input.keyboard.addKey('A');
    this.keyD = this.input.keyboard.addKey('D');

    // touch drag
    this.isDragging = false;
    this.dragPointer = null;
    this.input.on('pointerdown', (pointer) => {
      this.isDragging = true;
      this.dragPointer = pointer;
      this.plantX = clamp(pointer.x, 60, W - 60);
      this.plant.x = this.plantX;
    });
    this.input.on('pointermove', (pointer) => {
      if (this.isDragging && this.dragPointer && pointer.id === this.dragPointer.id) {
        this.plantX = clamp(pointer.x, 60, W - 60);
        this.plant.x = this.plantX;
      }
    });
    this.input.on('pointerup', (pointer) => {
      if (this.isDragging && this.dragPointer && pointer.id === this.dragPointer.id) {
        this.isDragging = false;
        this.dragPointer = null;
      }
    });
    this.input.on('pointerout', (pointer) => {
      if (this.isDragging && this.dragPointer && pointer.id === this.dragPointer.id) {
        this.isDragging = false;
        this.dragPointer = null;
      }
    });

    // groups
    this.sunGroup = this.physics.add.group();
    this.waterGroup = this.physics.add.group();
    this.co2Group = this.physics.add.group();
    this.pestGroup = this.physics.add.group();

    this.physics.add.overlap(this.plant, this.sunGroup, (p, item) => this.catchItem('sun', item));
    this.physics.add.overlap(this.plant, this.waterGroup, (p, item) => this.catchItem('water', item));
    this.physics.add.overlap(this.plant, this.co2Group, (p, item) => this.catchItem('co2', item));
    this.physics.add.overlap(this.plant, this.pestGroup, (p, item) => this.pestHitsPlant(item));

    // spawn timers
    this.time.addEvent({ delay: 1300, loop: true, callback: () => this.spawnResource('sun') });
    this.time.addEvent({ delay: 1550, loop: true, callback: () => this.spawnResource('water') });
    this.time.addEvent({ delay: 1750, loop: true, callback: () => this.spawnResource('co2') });
    this.scheduleNextEvent();

    // banner
    this.banner = this.add.text(W / 2, 26, '', {
      fontFamily: 'monospace',
      fontSize: '15px',
      color: '#EDE6D6',
      backgroundColor: 'rgba(20,30,20,0.6)',
      padding: { x: 10, y: 4 }
    }).setOrigin(0.5).setAlpha(0);

    this.currentStage = 'seedling';
  }

  scheduleNextEvent() {
    const delay = Phaser.Math.Between(14000, 21000);
    this.time.addEvent({ delay, callback: () => { this.triggerRandomEvent();
        this.scheduleNextEvent(); } });
  }

  triggerRandomEvent() {
    if (state.over) return;
    const options = ['cloud', 'drought', 'pollution', 'pest'];
    const choice = options[Phaser.Math.Between(0, options.length - 1)];
    if (choice === 'cloud') this.startCloud();
    else if (choice === 'drought') this.startDrought();
    else if (choice === 'pollution') this.startPollution();
    else this.spawnPest();
  }

  flashBanner(text) {
    this.banner.setText(text);
    this.tweens.killTweensOf(this.banner);
    this.banner.setAlpha(1);
    this.tweens.add({ targets: this.banner, alpha: 0, delay: 2600, duration: 900 });
  }

  startCloud() {
    state.cloudActive = true;
    this.flashBanner('☁ Cloud cover — sunlight is fading');
    showFact('cloud');
    const cloud = this.add.image(-100, 55, 'cloud_tex');
    this.tweens.add({ targets: cloud, x: W + 100, duration: 9000, ease: 'Linear', onComplete: () => cloud.destroy() });
    this.time.delayedCall(8500, () => { state.cloudActive = false; });
  }
  startDrought() {
    state.droughtActive = true;
    this.flashBanner('🏜 Drought — water is scarce');
    showFact('drought');
    this.time.delayedCall(11000, () => { state.droughtActive = false; });
  }
  startPollution() {
    state.pollutionActive = true;
    this.flashBanner('🏭 Pollution — CO₂ intake is harder');
    showFact('pollution');
    this.time.delayedCall(11000, () => { state.pollutionActive = false; });
  }
  spawnPest() {
    this.flashBanner('🐛 A pest is approaching!');
    showFact('pest');
    const startX = Math.random() < 0.5 ? -20 : W + 20;
    const pest = this.pestGroup.create(startX, H - 60, 'res_pest');
    pest.body.setAllowGravity(false);
    pest.setInteractive({ useHandCursor: true });
    pest.on('pointerdown', () => {
      this.flashBanner('🐞 Pest swatted away!');
      playTone(700, 0.12, 'square', 0.12);
      pest.destroy();
    });
    this.tweens.add({
      targets: pest,
      x: this.plant.x,
      duration: 6500,
      ease: 'Sine.easeIn',
      onComplete: () => { if (pest.active) this.pestHitsPlant(pest); }
    });
  }
  pestHitsPlant(pest) {
    if (!pest.active) return;
    const dmg = state.cuticleUnlocked ? 8 : 14;
    state.health = clamp(state.health - dmg, 0, 100);
    this.cameras.main.shake(150, 0.004);
    playAlert();
    pest.destroy();
  }

  spawnResource(type) {
    if (state.over) return;
    if (type === 'sun' && state.cloudActive && Math.random() < 0.65) return;
    if (type === 'water' && state.droughtActive && Math.random() < 0.65) return;
    if (type === 'co2' && state.pollutionActive && Math.random() < (state.cuticleUnlocked ? 0.35 : 0.6)) return;

    const key = type === 'sun' ? 'res_sun' : type === 'water' ? 'res_water' : 'res_co2';
    const group = type === 'sun' ? this.sunGroup : type === 'water' ? this.waterGroup : this.co2Group;
    const x = Phaser.Math.Between(40, W - 40);
    const item = group.create(x, -20, key);
    item.body.setAllowGravity(false);
    item.setVelocityY(Phaser.Math.Between(95, 135));
    item._type = type;
    this.time.delayedCall(6000, () => { if (item.active) item.destroy(); });
  }

  catchItem(type, item) {
    if (!item.active) return;
    const x = item.x,
      y = item.y;
    item.destroy();
    const leafBonus = state.leavesUnlocked ? 4 : 0;
    if (type === 'sun') {
      state.sun = clamp(state.sun + 14 + leafBonus, 0, 100);
      this.sparkleEmitter.explode(7, x, y);
      playChime('sun');
    }
    if (type === 'water') {
      state.water = clamp(state.water + 14, 0, 100);
      this.rippleEmitter.explode(7, x, y);
      playChime('water');
    }
    if (type === 'co2') {
      state.co2 = clamp(state.co2 + 14, 0, 100);
      this.bubbleEmitter.explode(7, x, y);
      playChime('co2');
    }
    showFact(type);
  }

  updatePlantStage() {
    let stage = 'seedling';
    if (state.glucose >= 300) stage = 'flowering';
    else if (state.glucose >= 150) stage = 'mature';
    else if (state.glucose >= 50) stage = 'sprout';
    state.stage = stage;
    if (stage !== this.currentStage) {
      this.currentStage = stage;
      this.plant.setTexture('plant_' + stage);
      this.plant.body.setSize(110, 90).setOffset(15, 5);
      this.tweens.add({ targets: this.plant, scaleX: 1.25, scaleY: 1.25, duration: 220, yoyo: true, ease: 'Sine.easeOut' });
      this.sparkleEmitter.explode(14, this.plant.x, this.plant.y - 60);
      playFanfare();

      if (stage === 'sprout') state.rootsUnlocked = true;
      if (stage === 'mature') state.leavesUnlocked = true;
      if (stage === 'flowering') state.cuticleUnlocked = true;

      const unlockMsg = STATIC_QUIZZES[stage] ? ' — ' + STATIC_QUIZZES[stage].unlock : '';
      this.flashBanner('🌱 Growth stage: ' + stage.charAt(0).toUpperCase() + stage.slice(1) + unlockMsg);

      // Optionally trigger a quiz on stage change (if you want both)
      // this.time.delayedCall(300, () => { if (!state.over) triggerLearningBurst(state.stage); });
    }
  }

  triggerGameOver() {
    state.over = true;
    this.physics.pause();
    const survived = Math.round((performance.now() - state.started) / 1000);
    document.getElementById('final-stats').textContent =
      `Glucose produced: ${Math.round(state.glucose)}  ·  Stage: ${state.stage}  ·  Survived: ${survived}s`;
    document.getElementById('gameover').classList.add('show');
    document.getElementById('leaderboard-list').innerHTML = '<li>Loading…</li>';
    loadLeaderboard().then(renderLeaderboard);
    document.getElementById('save-note').textContent = '';
  }

  update(time, delta) {
    if (state.over) return;
    const dt = delta / 1000;
    this.rootT += dt;

    // clouds
    this.farClouds.forEach((c, i) => { c.x += (6 + i * 2) * dt; if (c.x > W + 80) c.x = -80; });
    this.nearClouds.forEach((c, i) => { c.x += (14 + i * 3) * dt; if (c.x > W + 80) c.x = -80; });

    // roots
    this.rootsGfx.clear();
    this.rootsGfx.lineStyle(2, 0x2c4a35, 0.6);
    for (let i = -1; i <= 1; i++) {
      const baseX = this.plant.x + i * 18;
      const sway = Math.sin(this.rootT * 1.4 + i) * 5;
      this.rootsGfx.beginPath();
      this.rootsGfx.moveTo(baseX, H - 40);
      this.rootsGfx.lineTo(baseX + sway, H - 20);
      this.rootsGfx.strokePath();
    }

    // decay
    state.sun = clamp(state.sun - 3.4 * dt, 0, 100);
    state.water = clamp(state.water - (state.rootsUnlocked ? 1.9 : 2.6) * dt, 0, 100);
    state.co2 = clamp(state.co2 - 2.9 * dt, 0, 100);

    const balanced = state.sun >= 30 && state.water >= 30 && state.co2 >= 30;
    if (balanced) {
      state.glucose += 4.2 * dt;
      state.energy = clamp(state.energy + 4.2 * dt, 0, 100);
      state.sun = clamp(state.sun - 2.4 * dt, 0, 100);
      state.water = clamp(state.water - 1.3 * dt, 0, 100);
      state.co2 = clamp(state.co2 - 1.6 * dt, 0, 100);
      if (state.glucose > 0.5) showFact('glucose');
    }

    const tooLow = state.sun < 12 || state.water < 12 || state.co2 < 12;
    const tooHighWater = state.water > 96;
    const healthRegen = state.cuticleUnlocked ? 4 : 2.5;
    if (tooHighWater) {
      showFact('overwater');
      state.health = clamp(state.health - 4 * dt, 0, 100);
    } else if (tooLow) {
      showFact('stress');
      state.health = clamp(state.health - 6 * dt, 0, 100);
    } else if (balanced) {
      state.health = clamp(state.health + healthRegen * dt, 0, 100);
    }

    // alerts
    if (state.sun < 15 && !state.sunAlerted) { state.sunAlerted = true;
      playAlert(); } else if (state.sun > 25) state.sunAlerted = false;
    if (state.water < 15 && !state.waterAlerted) { state.waterAlerted = true;
      playAlert(); } else if (state.water > 25) state.waterAlerted = false;
    if (state.co2 < 15 && !state.co2Alerted) { state.co2Alerted = true;
      playAlert(); } else if (state.co2 > 25) state.co2Alerted = false;

    this.updatePlantStage();

    // ---------- GLUCOSE QUIZ CHECK ----------
    const glucoseSinceLastQuiz = state.glucose - state.lastQuizGlucose;
    if (glucoseSinceLastQuiz >= GLUCOSE_QUIZ_INTERVAL && state.glucose > 0 && !state.over) {
      state.lastQuizGlucose = state.glucose;
      this.time.delayedCall(300, () => {
        if (!state.over) triggerLearningBurst(state.stage);
      });
    }
    // ----------------------------------------

    // movement (keyboard)
    const speed = 260;
    if (this.cursors.left.isDown || this.keyA.isDown) this.plantX -= speed * dt;
    if (this.cursors.right.isDown || this.keyD.isDown) this.plantX += speed * dt;
    this.plantX = clamp(this.plantX, 60, W - 60);
    this.plant.x = this.plantX;

    refreshHUD();
    if (state.health <= 0) this.triggerGameOver();
  }
}

// ====================================================================
//  PHASER GAME INSTANCE
// ====================================================================
const config = {
  type: Phaser.AUTO,
  width: W,
  height: H,
  parent: 'phaser-target',
  backgroundColor: '#0f1c13',
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: 0 }, debug: false }
  },
  scene: MainScene,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: W,
    height: H
  }
};

let game = new Phaser.Game(config);
gameRef = game;

// ====================================================================
//  RESTART
// ====================================================================
document.getElementById('restart-btn').addEventListener('click', () => {
  Object.assign(state, freshState());
  Object.keys(seen).forEach(k => delete seen[k]);
  document.getElementById('gameover').classList.remove('show');
  game.destroy(true);
  game = new Phaser.Game(config);
  gameRef = game;
});

// ====================================================================
//  SAVE SCORE
// ====================================================================
document.getElementById('save-score-btn').addEventListener('click', async () => {
  const name = document.getElementById('player-name').value.trim() || 'Anonymous';
  const note = document.getElementById('save-note');
  note.textContent = 'Saving…';
  const ok = await saveScore(name, state.glucose, state.stage);
  if (ok) {
    note.textContent = 'Saved! (visible to everyone who plays this)';
    loadLeaderboard().then(renderLeaderboard);
  } else {
    note.textContent = 'Leaderboard storage not available here.';
  }
});

// ====================================================================
//  INIT
// ====================================================================
loadLeaderboard().then(renderLeaderboard);
// updateAIStatus() removed – no longer needed

window.addEventListener('resize', () => {
  if (game && game.scale) game.scale.refresh();
});

console.log('🌿 Leaf Life loaded — drag the plant to catch resources!');