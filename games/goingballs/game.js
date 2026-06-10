/**
 * game.js
 * Sunset Going Balls
 */

import { Auth } from '../../js/auth.js';
import { Leaderboard } from '../../js/leaderboard.js';

// DOM Elements
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const startScreen = document.getElementById('start-screen');
const chestScreen = document.getElementById('chest-screen');
const gameoverScreen = document.getElementById('gameover-screen');
const playBtn = document.getElementById('play-btn');
const nextLevelBtn = document.getElementById('next-level-btn');
const retryBtn = document.getElementById('retry-btn');
const finalScoreDiv = document.getElementById('final-score');
const submissionStatus = document.getElementById('submission-status');

const hudWorld = document.getElementById('hud-world');
const hudLives = document.getElementById('hud-lives');
const hudKeys = document.getElementById('hud-keys');
const hudCoins = document.getElementById('hud-coins');
const hudGravity = document.getElementById('hud-gravity');
const shopCoinsVal = document.getElementById('shop-coins-val');
const skinsGrid = document.getElementById('skins-grid');
const chestCards = document.querySelectorAll('.chest-card');
const chestKeysLabel = document.getElementById('chest-keys-label');

// Skins Shop Data
const SKINS = [
    { id: "soccer", name: "Soccer Ball", cost: 0, color: "#ffffff", stroke: "#000000" },
    { id: "watermelon", name: "Watermelon", cost: 50, color: "#4caf50", stroke: "#2e7d32" },
    { id: "basketball", name: "Basketball", cost: 100, color: "#ff9800", stroke: "#e65100" },
    { id: "neon", name: "Neon Orb", cost: 200, color: "#00e5ff", stroke: "#e040fb" },
    { id: "sunset", name: "Sunset Swirl", cost: 300, color: "#ff4081", stroke: "#3f51b5" }
];

// World Environments
const WORLDS = [
    { id: 1, name: "Sunset Sky", skyTop: "#fbc2eb", skyBottom: "#a6c1ee", trackCol: "#b39ddb", amp: 100 },
    { id: 2, name: "Snowy Peaks", skyTop: "#e0f2f1", skyBottom: "#80deea", trackCol: "#b2dfdb", amp: 150 },
    { id: 3, name: "Space Grid", skyTop: "#0a0612", skyBottom: "#1a0f2e", trackCol: "#00e5ff", amp: 200 }
];

// Game parameters
const TRACK_LENGTH = -3200; // Finish line y
const TRACK_WIDTH = 150;

// Game State
let isPlaying = false;
let isVictory = false;
let currentWorldIdx = 0;
let lives = 5;
let coinsCollected = 0;
let keysCollected = 0;

// Ball Physics
let ball = {
    x: 400,
    y: 100,
    vx: 0,
    vy: 0,
    rad: 18,
    scale: 1.0,
    yOffset: 0, // falls downwards visually when off track
    isFalling: false
};
let dragStartPos = null;
let isBraking = false;

// Checkpoint state
let lastCheckpoint = { x: 400, y: 100 };
let cameraY = 100;

// Level entities
let coins = []; // { x, y, collected }
let keys = [];  // { x, y, collected }
let obstacles = []; // { x, y, w, h }
let checkpoints = []; // { y, passed }

// Chest Room Rewards
let chestsOpened = [false, false, false];
let chestKeysRemaining = 0;

// Shop Persistence
let totalCoins = parseInt(localStorage.getItem('arcade_coins') || '100');

// Anti-Gravity & Mountain Theme State
let gravityMode = 'normal'; // 'normal' or 'anti-gravity'
let gravityParticles = [];
let geyserParticles = [];

const CEILING_ARCHES = [
    { yStart: -500, yEnd: -900 },
    { yStart: -1300, yEnd: -1700 },
    { yStart: -2100, yEnd: -2500 }
];

let geysers = [
    { y: -350 },
    { y: -1150 },
    { y: -1950 }
];
let boughtSkins = JSON.parse(localStorage.getItem('arcade_bought_skins') || '["soccer"]');
let selectedSkin = localStorage.getItem('arcade_selected_skin') || 'soccer';

// Populate Skins Shop interface
function setupShop() {
    shopCoinsVal.textContent = totalCoins;
    hudCoins.textContent = coinsCollected;
    
    skinsGrid.innerHTML = "";
    SKINS.forEach(skin => {
        const card = document.createElement('div');
        card.className = `skin-card ${selectedSkin === skin.id ? 'selected' : ''}`;
        
        const isOwned = boughtSkins.includes(skin.id);
        let statusHtml = "";
        if (isOwned) {
            statusHtml = `<span class="skin-owned">Selected</span>`;
            if (selectedSkin !== skin.id) statusHtml = `<span class="skin-owned" style="color:#6d5b70;">Owned</span>`;
        } else {
            statusHtml = `<span class="skin-price">🪙 ${skin.cost}</span>`;
        }
        
        // Custom background ball drawer icon
        let bgStyle = "";
        if (skin.id === "soccer") bgStyle = "background:#ffffff; border:1px solid #ccc;";
        else if (skin.id === "watermelon") bgStyle = "background:#4caf50;";
        else if (skin.id === "basketball") bgStyle = "background:#ff9800;";
        else if (skin.id === "neon") bgStyle = "background:linear-gradient(45deg,#00e5ff,#e040fb);";
        else if (skin.id === "sunset") bgStyle = "background:linear-gradient(45deg,#ff4081,#3f51b5);";

        card.innerHTML = `
            <div class="skin-preview-ball" style="${bgStyle}"></div>
            <div class="skin-name">${skin.name}</div>
            ${statusHtml}
        `;
        
        card.addEventListener('click', () => {
            selectSkinItem(skin);
        });
        skinsGrid.appendChild(card);
    });
}

function selectSkinItem(skin) {
    if (boughtSkins.includes(skin.id)) {
        selectedSkin = skin.id;
        localStorage.setItem('arcade_selected_skin', selectedSkin);
        setupShop();
    } else if (totalCoins >= skin.cost) {
        totalCoins -= skin.cost;
        boughtSkins.push(skin.id);
        selectedSkin = skin.id;
        localStorage.setItem('arcade_coins', totalCoins);
        localStorage.setItem('arcade_bought_skins', JSON.stringify(boughtSkins));
        localStorage.setItem('arcade_selected_skin', selectedSkin);
        setupShop();
    }
}

// Checkpoint track path calculator
function getTrackCenterX(y) {
    const world = WORLDS[currentWorldIdx];
    // Winding path equation
    return 400 + Math.sin(y * 0.0025) * world.amp;
}

// Generate coins, barriers, checkpoints procedurally
function generateTrack() {
    coins = [];
    keys = [];
    obstacles = [];
    checkpoints = [];
    
    // Add checkpoints every 600px
    for (let y = -600; y >= TRACK_LENGTH; y -= 600) {
        checkpoints.push({ y, passed: false });
    }
    
    // Generate scattered items along the winding track
    for (let y = -200; y >= TRACK_LENGTH + 100; y -= 80) {
        const tcX = getTrackCenterX(y);
        
        // Spawning coins
        if (Math.random() < 0.28) {
            coins.push({
                x: tcX + (Math.random() - 0.5) * 80,
                y,
                collected: false
            });
        }
        
        // Spawning obstacles and rolling boulders
        if (Math.random() < 0.12 && y < -300) {
            const isBoulder = Math.random() < 0.4;
            obstacles.push({
                x: tcX + (Math.random() > 0.5 ? 30 : -30),
                y,
                w: isBoulder ? 32 : 24,
                h: isBoulder ? 32 : 24,
                isBoulder,
                vx: isBoulder ? (Math.random() - 0.5) * 2.5 : 0,
                vy: isBoulder ? 1.5 : 0 // rolls down the track (positive y velocity since track is drawn negative)
            });
        }
    }
    
    // Distribute 3 key locations
    const keyYPositions = [-800, -1600, -2400];
    keyYPositions.forEach(ky => {
        keys.push({
            x: getTrackCenterX(ky) + (Math.random() - 0.5) * 60,
            y: ky,
            collected: false
        });
    });
}

// Start Level run
function startLevel() {
    isPlaying = true;
    isVictory = false;
    lives = 5;
    keysCollected = 0;
    gravityMode = 'normal';
    gravityParticles = [];
    geyserParticles = [];
    
    if (hudGravity) {
        hudGravity.textContent = "Normal";
        hudGravity.style.color = "#4caf50";
    }
    
    // Keep accumulated coins for score
    hudWorld.textContent = WORLDS[currentWorldIdx].name;
    hudLives.textContent = "⚽".repeat(lives);
    hudKeys.textContent = "🔑 0/3";
    
    ball.x = 400;
    ball.y = 100;
    ball.vx = 0;
    ball.vy = 0;
    ball.scale = 1.0;
    ball.yOffset = 0;
    ball.isFalling = false;
    
    lastCheckpoint = { x: 400, y: 100 };
    cameraY = 220;
    
    generateTrack();
    
    startScreen.classList.add('hidden');
    chestScreen.classList.add('hidden');
    gameoverScreen.classList.add('hidden');
    
    setupShop();
    requestAnimationFrame(gameLoop);
}

// Swipe controls listener
canvas.addEventListener('mousedown', (e) => {
    if (!isPlaying || ball.isFalling) return;
    const rect = canvas.getBoundingClientRect();
    dragStartPos = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
});

// Hold to brake
canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
});

window.addEventListener('mouseup', () => {
    dragStartPos = null;
    isBraking = false;
});

canvas.addEventListener('mousemove', (e) => {
    if (!isPlaying || !dragStartPos || ball.isFalling) return;
    
    const rect = canvas.getBoundingClientRect();
    const curX = e.clientX - rect.left;
    const curY = e.clientY - rect.top;
    
    const dx = curX - dragStartPos.x;
    const dy = curY - dragStartPos.y;
    
    // Apply steering force vector based on drag direction
    ball.vx += dx * 0.04;
    ball.vy += dy * 0.04;
    
    // Clamp velocities to prevent flying out of control
    ball.vx = Math.max(-8, Math.min(8, ball.vx));
    ball.vy = Math.max(-9, Math.min(6, ball.vy));
    
    // Reset starting drag to capture continuous sweeps
    dragStartPos = { x: curX, y: curY };
});

// Touch controls drag steering
let lastTapTime = 0;
canvas.addEventListener('touchstart', (e) => {
    if (!isPlaying || ball.isFalling) return;
    
    // Double tap triggers gravity toggle
    const now = Date.now();
    if (now - lastTapTime < 300) {
        toggleGravity();
    }
    lastTapTime = now;
    
    const t = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    dragStartPos = {
        x: t.clientX - rect.left,
        y: t.clientY - rect.top
    };
});

canvas.addEventListener('touchend', () => {
    dragStartPos = null;
    isBraking = false;
});

canvas.addEventListener('touchmove', (e) => {
    if (!isPlaying || !dragStartPos || ball.isFalling) return;
    
    const t = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const curX = t.clientX - rect.left;
    const curY = t.clientY - rect.top;
    
    const dx = curX - dragStartPos.x;
    const dy = curY - dragStartPos.y;
    
    ball.vx += dx * 0.04;
    ball.vy += dy * 0.04;
    
    ball.vx = Math.max(-8, Math.min(8, ball.vx));
    ball.vy = Math.max(-9, Math.min(6, ball.vy));
    
    dragStartPos = { x: curX, y: curY };
});

// Gravity Toggle
function toggleGravity() {
    if (!isPlaying || ball.isFalling || isVictory) return;
    gravityMode = gravityMode === 'normal' ? 'anti-gravity' : 'normal';
    
    if (hudGravity) {
        hudGravity.textContent = gravityMode === 'normal' ? "Normal" : "Anti-Grav";
        hudGravity.style.color = gravityMode === 'normal' ? "#4caf50" : "#ff4081";
    }
    
    createSparks(ball.x, ball.y, gravityMode === 'normal' ? '#4caf50' : '#ff4081');
}

// Canvas double click gravity toggle
canvas.addEventListener('dblclick', (e) => {
    e.preventDefault();
    toggleGravity();
});

// Key listeners (Space toggles gravity, S/ArrowDown brakes, WASD/Arrows move)
let activeKeys = {};
window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    activeKeys[key] = true;
    activeKeys[e.key] = true;
    if (e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        toggleGravity();
    }
});
window.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    activeKeys[key] = false;
    activeKeys[e.key] = false;
});

// Update physical loops
function update() {
    if (isVictory) return;
    
    if (ball.isFalling) {
        ball.scale -= 0.025;
        if (gravityMode === 'anti-gravity') {
            ball.yOffset -= 6; // float visual path up
        } else {
            ball.yOffset += 6; // fall down visual path
        }
        
        if (ball.scale <= 0) {
            triggerRespawn();
        }
        return;
    }

    // Keyboard inputs movement
    if (isPlaying && !ball.isFalling) {
        const steerSpeed = 0.28;
        if (activeKeys["a"] || activeKeys["arrowleft"]) {
            ball.vx -= steerSpeed;
        }
        if (activeKeys["d"] || activeKeys["arrowright"]) {
            ball.vx += steerSpeed;
        }
        if (activeKeys["w"] || activeKeys["arrowup"]) {
            ball.vy -= steerSpeed; // Accelerate forward (moves in negative Y direction)
        }
        if (activeKeys["s"] || activeKeys["arrowdown"]) {
            isBraking = true;
            ball.vy += steerSpeed * 0.8;
        } else {
            isBraking = false;
        }
        
        // Clamp velocities
        ball.vx = Math.max(-8, Math.min(8, ball.vx));
        ball.vy = Math.max(-9, Math.min(6, ball.vy));
    }

    // Apply friction / brakes
    if (isBraking) {
        ball.vx *= 0.82;
        ball.vy *= 0.82;
    } else {
        // Rolling friction
        ball.vx *= 0.985;
        ball.vy *= 0.985;
    }

    // Move ball
    ball.x += ball.vx;
    ball.y += ball.vy;

    // Constrain forward motion to speed up slightly
    ball.y -= 0.8;

    // Camera follow vertical y
    cameraY += (ball.y + 120 - cameraY) * 0.1;

    // gravity and track arch checks
    const currentArch = CEILING_ARCHES.find(arch => ball.y <= arch.yStart && ball.y >= arch.yEnd);
    const tcX = getTrackCenterX(ball.y);
    const halfWidth = TRACK_WIDTH / 2;

    if (gravityMode === 'anti-gravity') {
        ball.yOffset += (-80 - ball.yOffset) * 0.15;
        
        if (currentArch) {
            if (ball.x < tcX - halfWidth || ball.x > tcX + halfWidth) {
                ball.isFalling = true;
                ball.vx = 0;
                ball.vy = 0;
            }
        } else {
            // float up to sky
            ball.isFalling = true;
            ball.vx = 0;
            ball.vy = 0;
        }
    } else {
        ball.yOffset += (0 - ball.yOffset) * 0.15;
        if (ball.x < tcX - halfWidth || ball.x > tcX + halfWidth) {
            ball.isFalling = true;
            ball.vx = 0;
            ball.vy = 0;
        }
    }

    // Generate upward drifting gravity dust/leaves when gravity is inverted
    if (gravityMode === 'anti-gravity' && Math.random() < 0.25) {
        gravityParticles.push({
            x: ball.x + (Math.random() - 0.5) * 30,
            y: ball.y + ball.yOffset,
            vx: (Math.random() - 0.5) * 0.8,
            vy: -1 - Math.random() * 1.5,
            rad: 1.5 + Math.random() * 2,
            color: '#ff4081',
            alpha: 1.0
        });
    }

    // Update gravity particles
    for (let i = gravityParticles.length - 1; i >= 0; i--) {
        const p = gravityParticles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 0.02;
        if (p.alpha <= 0) gravityParticles.splice(i, 1);
    }

    // Update geysers & geyser triggers
    geysers.forEach(g => {
        // Spawn geyser vapor particles
        if (Math.abs(cameraY - g.y) < 400 && Math.random() < 0.35) {
            const gx = getTrackCenterX(g.y);
            geyserParticles.push({
                x: gx + (Math.random() - 0.5) * 50,
                y: g.y,
                vx: (Math.random() - 0.5) * 0.6,
                vy: -3 - Math.random() * 3,
                rad: 2 + Math.random() * 3,
                alpha: 1.0
            });
        }

        // Lift ball if it enters a geyser
        if (Math.abs(ball.y - g.y) < 30 && Math.abs(ball.x - getTrackCenterX(g.y)) < 40 && gravityMode === 'normal') {
            gravityMode = 'anti-gravity';
            if (hudGravity) {
                hudGravity.textContent = "Anti-Grav";
                hudGravity.style.color = "#ff4081";
            }
            createSparks(ball.x, ball.y, '#ff4081');
        }
    });

    // Update geyser particles
    for (let i = geyserParticles.length - 1; i >= 0; i--) {
        const p = geyserParticles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 0.02;
        if (p.alpha <= 0) geyserParticles.splice(i, 1);
    }

    // Obstacle physics (boulders roll down)
    obstacles.forEach(o => {
        if (o.isBoulder) {
            o.y += o.vy;
            o.x += o.vx;
            const otcX = getTrackCenterX(o.y);
            if (o.x < otcX - halfWidth + 8 || o.x > otcX + halfWidth - 8) {
                o.vx *= -1;
            }
        }
    });

    // Hit Checkpoints
    checkpoints.forEach(cp => {
        if (!cp.passed && ball.y <= cp.y) {
            cp.passed = true;
            lastCheckpoint = { x: getTrackCenterX(cp.y), y: cp.y };
            createSparks(ball.x, ball.y, '#4caf50');
        }
    });

    // Check Finish Line
    if (ball.y <= TRACK_LENGTH) {
        triggerFinish();
        return;
    }

    // Collide Coins
    coins.forEach(c => {
        const isBallOnFloor = ball.yOffset > -40;
        if (isBallOnFloor && !c.collected && Math.hypot(ball.x - c.x, ball.y - c.y) < 22) {
            c.collected = true;
            coinsCollected++;
            totalCoins++;
            localStorage.setItem('arcade_coins', totalCoins);
            hudCoins.textContent = coinsCollected;
            createSparks(c.x, c.y, '#ffd700');
        }
    });

    // Collide Keys
    keys.forEach(k => {
        if (!k.collected && Math.hypot(ball.x - k.x, ball.y - k.y) < 22) {
            k.collected = true;
            keysCollected++;
            hudKeys.textContent = `🔑 ${keysCollected}/3`;
            createSparks(k.x, k.y, '#00e5ff');
        }
    });

    // Collide Obstacles
    obstacles.forEach(o => {
        const bounds = o.w / 2 + ball.rad / 2;
        if (Math.abs(ball.x - o.x) < bounds && Math.abs(ball.y - o.y) < bounds) {
            if (o.isBoulder && ball.yOffset < -40) {
                return;
            }
            ball.isFalling = true;
            ball.vx = 0;
            ball.vy = 0;
            createSparks(ball.x, ball.y, '#e53935');
        }
    });
}

function createSparks(x, y, color) {
    for (let i = 0; i < 15; i++) {
        gravityParticles.push({
            x,
            y,
            vx: (Math.random() - 0.5) * 4,
            vy: (Math.random() - 0.5) * 4,
            rad: 2 + Math.random() * 2.5,
            color,
            alpha: 1.0
        });
    }
}

function triggerRespawn() {
    lives--;
    hudLives.textContent = "⚽".repeat(lives);
    gravityMode = 'normal';
    if (hudGravity) {
        hudGravity.textContent = "Normal";
        hudGravity.style.color = "#4caf50";
    }
    
    if (lives <= 0) {
        endGame();
    } else {
        ball.x = lastCheckpoint.x;
        ball.y = lastCheckpoint.y;
        ball.vx = 0;
        ball.vy = 0;
        ball.scale = 1.0;
        ball.yOffset = 0;
        ball.isFalling = false;
        cameraY = lastCheckpoint.y + 120;
    }
}

// Crossed finish line: open Chest overlay
function triggerFinish() {
    isVictory = true;
    isPlaying = false;
    
    chestsOpened = [false, false, false];
    chestKeysRemaining = keysCollected;
    
    // Draw initial closed chests
    chestCards.forEach((c, idx) => {
        c.className = "chest-card";
        c.innerHTML = "📦";
    });
    
    chestKeysLabel.textContent = `You have ${chestKeysRemaining} keys remaining`;
    
    setTimeout(() => {
        chestScreen.classList.remove('hidden');
    }, 500);
}

// Chest click event
chestCards.forEach(card => {
    card.addEventListener('click', () => {
        const idx = parseInt(card.dataset.idx);
        if (chestKeysRemaining > 0 && !chestsOpened[idx]) {
            chestsOpened[idx] = true;
            chestKeysRemaining--;
            
            card.className = "chest-card opened";
            // Random prize
            const prizes = [15, 30, 50, 80];
            const prize = prizes[Math.floor(Math.random() * prizes.length)];
            
            totalCoins += prize;
            localStorage.setItem('arcade_coins', totalCoins);
            
            card.innerHTML = `🎁<span class="chest-reward-label">+${prize} coins</span>`;
            
            chestKeysLabel.textContent = `You have ${chestKeysRemaining} keys remaining`;
            setupShop();
        }
    });
});

// Proceed to next level
nextLevelBtn.addEventListener('click', () => {
    currentWorldIdx = (currentWorldIdx + 1) % WORLDS.length;
    startLevel();
});

// Out of lives game over
async function endGame() {
    isPlaying = false;
    gameoverScreen.classList.remove('hidden');
    finalScoreDiv.textContent = `${coinsCollected} coins`;
    
    setupShop();
    
    const currentUser = Auth.getCurrentUser();
    if (currentUser) {
        submissionStatus.innerHTML = `<span style="color:#6d5b70;">Submitting coins score...</span>`;
        try {
            await Leaderboard.submitScore('goingballs', coinsCollected);
            submissionStatus.innerHTML = `<span style="color:#2e7d32; font-weight:600;">✨ Score of ${coinsCollected} saved to Leaderboard!</span>`;
        } catch (e) {
            submissionStatus.innerHTML = `<span style="color:#e53935;">Error saving score: ${e.message}</span>`;
        }
    } else {
        submissionStatus.innerHTML = `<i>Login on the homepage to register your ball runs!</i>`;
    }
}

// Draw canvas components
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const world = WORLDS[currentWorldIdx];
    const HORIZON_Y = 160;

    // 3D Perspective Projection helper
    function project(worldX, worldY, height = 0) {
        const z = cameraY - worldY;
        if (z < -150) return null; // Behind camera view bounds
        
        const fov = 350;
        const scale = fov / (fov + Math.max(0.1, z));
        
        // Track centers relative projection
        const camTrackX = getTrackCenterX(cameraY);
        const dx = worldX - camTrackX;
        
        const screenX = 400 + dx * scale;
        // Ground is at 430px vertical
        const screenY = HORIZON_Y + (430 - HORIZON_Y + height) * scale;
        
        return { x: screenX, y: screenY, scale };
    }

    // 1. Draw Sky background gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, HORIZON_Y);
    skyGrad.addColorStop(0, world.skyTop);
    skyGrad.addColorStop(1, world.skyBottom);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, canvas.width, HORIZON_Y);

    // 2. Draw Horizon Sun (using the sunset theme colors)
    ctx.save();
    const sunGrad = ctx.createRadialGradient(400, HORIZON_Y, 0, 400, HORIZON_Y, 80);
    sunGrad.addColorStop(0, '#ffe082');
    sunGrad.addColorStop(0.3, '#ff4081');
    sunGrad.addColorStop(1, 'rgba(255,64,129,0)');
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(400, HORIZON_Y, 80, 0, Math.PI, true);
    ctx.fill();
    ctx.restore();

    // 3. Parallax Mountain Silhouettes Background
    const parallaxOffset = -getTrackCenterX(cameraY) * 0.15;
    ctx.save();
    ctx.fillStyle = '#4c3563'; // deep sunset mountain color
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.moveTo(0, HORIZON_Y);
    for (let x = -80; x <= canvas.width + 80; x += 60) {
        const mx = x + (parallaxOffset % 60);
        // Draw jagged peaks
        const my = HORIZON_Y - 30 + (Math.sin(x * 0.05) * 15) + (Math.cos(x * 0.03) * 10);
        ctx.lineTo(mx, my);
    }
    ctx.lineTo(canvas.width, HORIZON_Y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Fill Ground Under horizon with dark volcanic color
    ctx.fillStyle = '#160a21';
    ctx.fillRect(0, HORIZON_Y, canvas.width, canvas.height - HORIZON_Y);

    // 4. Draw winding track platforms in 3D perspective
    let leftPoints = [];
    let rightPoints = [];
    const step = 25;

    for (let y = Math.floor(cameraY / step) * step + 150; y >= cameraY - 850; y -= step) {
        const cx = getTrackCenterX(y);
        const pLeft = project(cx - TRACK_WIDTH / 2, y, 0);
        const pRight = project(cx + TRACK_WIDTH / 2, y, 0);
        if (pLeft && pRight) {
            leftPoints.push(pLeft);
            rightPoints.unshift(pRight);
        }
    }

    if (leftPoints.length > 0) {
        ctx.save();
        ctx.fillStyle = world.trackCol;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(leftPoints[0].x, leftPoints[0].y);
        for (let i = 1; i < leftPoints.length; i++) ctx.lineTo(leftPoints[i].x, leftPoints[i].y);
        for (let i = 0; i < rightPoints.length; i++) ctx.lineTo(rightPoints[i].x, rightPoints[i].y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        // Neon border guide rails
        ctx.save();
        ctx.strokeStyle = '#ff4081'; // neon sunset pink
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(leftPoints[0].x, leftPoints[0].y);
        for (let i = 1; i < leftPoints.length; i++) ctx.lineTo(leftPoints[i].x, leftPoints[i].y);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(rightPoints[0].x, rightPoints[0].y);
        for (let i = 1; i < rightPoints.length; i++) ctx.lineTo(rightPoints[i].x, rightPoints[i].y);
        ctx.stroke();
        ctx.restore();

        // Zebra stripes on track for motion feedback
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 2;
        for (let i = 0; i < leftPoints.length; i++) {
            if (i % 2 === 0) {
                ctx.beginPath();
                ctx.moveTo(leftPoints[i].x, leftPoints[i].y);
                ctx.lineTo(rightPoints[rightPoints.length - 1 - i].x, rightPoints[rightPoints.length - 1 - i].y);
                ctx.stroke();
            }
        }
        ctx.restore();
    }

    // 5. Draw Ceiling Arches (anti-gravity paths) in 3D
    CEILING_ARCHES.forEach(arch => {
        let archLeft = [];
        let archRight = [];
        const archHeight = -130;
        
        for (let y = arch.yStart; y >= arch.yEnd; y -= step) {
            if (y > cameraY + 150 || y < cameraY - 850) continue;
            const cx = getTrackCenterX(y);
            const pLeft = project(cx - TRACK_WIDTH / 2, y, archHeight);
            const pRight = project(cx + TRACK_WIDTH / 2, y, archHeight);
            if (pLeft && pRight) {
                archLeft.push(pLeft);
                archRight.unshift(pRight);
            }
        }
        
        if (archLeft.length > 0) {
            ctx.save();
            ctx.fillStyle = 'rgba(255, 64, 129, 0.18)'; // neon pink glass ceiling
            ctx.strokeStyle = '#ff4081';
            ctx.lineWidth = 2.5;
            
            ctx.beginPath();
            ctx.moveTo(archLeft[0].x, archLeft[0].y);
            for (let i = 1; i < archLeft.length; i++) ctx.lineTo(archLeft[i].x, archLeft[i].y);
            for (let i = 0; i < archRight.length; i++) ctx.lineTo(archRight[i].x, archRight[i].y);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            
            // Pillars connecting ceiling to ground at gates
            const startPLeft = project(getTrackCenterX(arch.yStart) - TRACK_WIDTH/2, arch.yStart, 0);
            const startPRight = project(getTrackCenterX(arch.yStart) + TRACK_WIDTH/2, arch.yStart, 0);
            const endPLeft = project(getTrackCenterX(arch.yEnd) - TRACK_WIDTH/2, arch.yEnd, 0);
            const endPRight = project(getTrackCenterX(arch.yEnd) + TRACK_WIDTH/2, arch.yEnd, 0);
            
            ctx.strokeStyle = 'rgba(255, 64, 129, 0.5)';
            ctx.lineWidth = 3;
            if (startPLeft && archLeft[0]) {
                ctx.beginPath();
                ctx.moveTo(startPLeft.x, startPLeft.y);
                ctx.lineTo(archLeft[0].x, archLeft[0].y);
                ctx.stroke();
            }
            if (startPRight && archRight[archRight.length - 1]) {
                ctx.beginPath();
                ctx.moveTo(startPRight.x, startPRight.y);
                ctx.lineTo(archRight[archRight.length - 1].x, archRight[archRight.length - 1].y);
                ctx.stroke();
            }
            if (endPLeft && archLeft[archLeft.length - 1]) {
                ctx.beginPath();
                ctx.moveTo(endPLeft.x, endPLeft.y);
                ctx.lineTo(archLeft[archLeft.length - 1].x, archLeft[archLeft.length - 1].y);
                ctx.stroke();
            }
            if (endPRight && archRight[0]) {
                ctx.beginPath();
                ctx.moveTo(endPRight.x, endPRight.y);
                ctx.lineTo(archRight[0].x, archRight[0].y);
                ctx.stroke();
            }
            ctx.restore();
        }
    });

    // 6. Draw Geysers
    geysers.forEach(g => {
        if (g.y > cameraY + 150 || g.y < cameraY - 850) return;
        const p = project(getTrackCenterX(g.y), g.y, 0);
        if (p) {
            ctx.save();
            ctx.fillStyle = '#ff7096';
            ctx.beginPath();
            ctx.ellipse(p.x, p.y, 22 * p.scale, 6 * p.scale, 0, 0, Math.PI*2);
            ctx.fill();
            ctx.restore();
        }
    });

    // 7. Draw Checkpoints
    checkpoints.forEach(cp => {
        if (cp.y > cameraY + 150 || cp.y < cameraY - 850) return;
        const tcX = getTrackCenterX(cp.y);
        const pLeft = project(tcX - TRACK_WIDTH/2 + 5, cp.y, 0);
        const pRight = project(tcX + TRACK_WIDTH/2 - 5, cp.y, 0);
        
        if (pLeft && pRight) {
            ctx.save();
            // Checkpoint ground bar
            ctx.strokeStyle = cp.passed ? '#4caf50' : '#ffffff';
            ctx.lineWidth = 5 * pLeft.scale;
            ctx.beginPath();
            ctx.moveTo(pLeft.x, pLeft.y);
            ctx.lineTo(pRight.x, pRight.y);
            ctx.stroke();
            
            // Checkpoint frame gate arch
            const pLeftTop = project(tcX - TRACK_WIDTH/2 + 5, cp.y, -50);
            const pRightTop = project(tcX + TRACK_WIDTH/2 - 5, cp.y, -50);
            if (pLeftTop && pRightTop) {
                ctx.strokeStyle = cp.passed ? '#4caf50' : 'rgba(255,255,255,0.7)';
                ctx.lineWidth = 3.5 * pLeft.scale;
                ctx.beginPath();
                ctx.moveTo(pLeft.x, pLeft.y);
                ctx.lineTo(pLeftTop.x, pLeftTop.y);
                ctx.lineTo(pRightTop.x, pRightTop.y);
                ctx.lineTo(pRight.x, pRight.y);
                ctx.stroke();
            }
            ctx.restore();
        }
    });

    // 8. Draw Finish Checkered Banner
    const fnX = getTrackCenterX(TRACK_LENGTH);
    const pLeftFn = project(fnX - TRACK_WIDTH/2, TRACK_LENGTH, 0);
    const pRightFn = project(fnX + TRACK_WIDTH/2, TRACK_LENGTH, 0);
    if (pLeftFn && pRightFn) {
        ctx.save();
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 7 * pLeftFn.scale;
        ctx.beginPath();
        ctx.moveTo(pLeftFn.x, pLeftFn.y);
        ctx.lineTo(pRightFn.x, pRightFn.y);
        ctx.stroke();
        
        const pLeftFnTop = project(fnX - TRACK_WIDTH/2, TRACK_LENGTH, -60);
        const pRightFnTop = project(fnX + TRACK_WIDTH/2, TRACK_LENGTH, -60);
        if (pLeftFnTop && pRightFnTop) {
            ctx.strokeStyle = '#ffd700';
            ctx.lineWidth = 3.5 * pLeftFn.scale;
            ctx.beginPath();
            ctx.moveTo(pLeftFn.x, pLeftFn.y);
            ctx.lineTo(pLeftFnTop.x, pLeftFnTop.y);
            ctx.lineTo(pRightFnTop.x, pRightFnTop.y);
            ctx.lineTo(pRightFn.x, pRightFn.y);
            ctx.stroke();
            
            // Checkered layout
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(pLeftFnTop.x, pLeftFnTop.y, pRightFnTop.x - pLeftFnTop.x, 14 * pLeftFn.scale);
            ctx.fillStyle = '#000000';
            const numSquares = 12;
            const wSq = (pRightFnTop.x - pLeftFnTop.x) / numSquares;
            for (let i = 0; i < numSquares; i++) {
                if (i % 2 === 0) {
                    ctx.fillRect(pLeftFnTop.x + i * wSq, pLeftFnTop.y, wSq, 14 * pLeftFn.scale);
                }
            }
        }
        ctx.restore();
    }

    // 9. Draw Coins
    coins.forEach(c => {
        if (c.collected || c.y > cameraY + 150 || c.y < cameraY - 850) return;
        const p = project(c.x, c.y, -12);
        if (p) {
            const size = 8 * p.scale;
            ctx.save();
            ctx.fillStyle = '#ffd700';
            ctx.strokeStyle = '#ffb300';
            ctx.lineWidth = 1.5 * p.scale;
            ctx.beginPath();
            ctx.ellipse(p.x, p.y, size * 0.7, size, 0, 0, Math.PI*2);
            ctx.fill();
            ctx.stroke();
            ctx.restore();
        }
    });

    // 10. Draw Keys
    keys.forEach(k => {
        if (k.collected || k.y > cameraY + 150 || k.y < cameraY - 850) return;
        const p = project(k.x, k.y, -16);
        if (p) {
            const size = 8 * p.scale;
            ctx.save();
            ctx.strokeStyle = '#00e5ff';
            ctx.fillStyle = '#e040fb';
            ctx.lineWidth = 2 * p.scale;
            ctx.shadowBlur = 6;
            ctx.shadowColor = '#00e5ff';
            ctx.beginPath();
            ctx.arc(p.x - size/2, p.y, size * 0.6, 0, Math.PI*2);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(p.x + size/4, p.y);
            ctx.lineTo(p.x + size * 1.25, p.y);
            ctx.lineTo(p.x + size * 1.25, p.y + size/2);
            ctx.stroke();
            ctx.restore();
        }
    });

    // 11. Draw Static obstacles & Boulders
    obstacles.forEach(o => {
        if (o.y > cameraY + 150 || o.y < cameraY - 850) return;
        const p = project(o.x, o.y, o.isBoulder ? -o.h/2 : 0);
        if (p) {
            const w = o.w * p.scale;
            const h = o.h * p.scale;
            ctx.save();
            if (o.isBoulder) {
                ctx.translate(p.x, p.y);
                const rotationAngle = (Date.now() / 150) % (Math.PI*2);
                ctx.rotate(rotationAngle);
                
                ctx.fillStyle = '#78909c';
                ctx.strokeStyle = '#37474f';
                ctx.lineWidth = 2.5 * p.scale;
                ctx.beginPath();
                ctx.arc(0, 0, w/2, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                
                // cracks
                ctx.strokeStyle = '#546e7a';
                ctx.beginPath();
                ctx.moveTo(-w/4, -w/4);
                ctx.lineTo(w/8, w/8);
                ctx.moveTo(w/5, -w/8);
                ctx.lineTo(-w/6, w/5);
                ctx.stroke();
            } else {
                ctx.fillStyle = '#ff3d00';
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2 * p.scale;
                ctx.fillRect(p.x - w/2, p.y - h, w, h);
                ctx.strokeRect(p.x - w/2, p.y - h, w, h);
            }
            ctx.restore();
        }
    });

    // 12. Draw Particles (Gravity & Geyser)
    gravityParticles.forEach(p => {
        if (p.y > cameraY + 150 || p.y < cameraY - 850) return;
        const proj = project(p.x, p.y, p.z || 0);
        if (proj) {
            ctx.save();
            ctx.fillStyle = p.color || 'rgba(255, 64, 129, ' + p.alpha + ')';
            ctx.globalAlpha = p.alpha;
            ctx.beginPath();
            ctx.arc(proj.x, proj.y, p.rad * proj.scale, 0, Math.PI*2);
            ctx.fill();
            ctx.restore();
        }
    });

    geyserParticles.forEach(p => {
        if (p.y > cameraY + 150 || p.y < cameraY - 850) return;
        const proj = project(p.x, p.y, p.z || 0);
        if (proj) {
            ctx.save();
            ctx.fillStyle = 'rgba(255, 112, 150, ' + p.alpha + ')';
            ctx.beginPath();
            ctx.arc(proj.x, proj.y, p.rad * proj.scale, 0, Math.PI*2);
            ctx.fill();
            ctx.restore();
        }
    });

    // 13. Draw Player Ball in 3D Third-Person Perspective
    const pBall = project(ball.x, ball.y, ball.yOffset);
    if (pBall) {
        const radius = ball.rad * pBall.scale;
        
        // Ball Shadow
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        const shadowH = (gravityMode === 'anti-gravity') ? -130 : 0;
        const pShadow = project(ball.x, ball.y, shadowH);
        if (pShadow) {
            ctx.beginPath();
            ctx.ellipse(pShadow.x, pShadow.y, radius * 1.1, radius * 0.35, 0, 0, Math.PI*2);
            ctx.fill();
        }
        ctx.restore();
        
        // Ball Shape
        ctx.save();
        ctx.translate(pBall.x, pBall.y);
        ctx.scale(ball.scale, ball.scale);
        
        let ballColor = "#ffffff";
        let strokeCol = "#000000";
        const skin = SKINS.find(s => s.id === selectedSkin);
        if (skin) {
            ballColor = skin.color;
            strokeCol = skin.stroke;
        }

        if (gravityMode === 'anti-gravity') {
            ctx.shadowBlur = 20;
            ctx.shadowColor = '#ff4081';
            ballColor = '#ff4081';
            strokeCol = '#ffffff';
        }

        ctx.fillStyle = ballColor;
        ctx.strokeStyle = strokeCol;
        ctx.lineWidth = 3 * pBall.scale;
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Rotate detail patterns to simulate roll momentum
        const rollRotation = (ball.y * 0.05) % (Math.PI * 2);
        ctx.rotate(rollRotation);

        if (selectedSkin === "soccer") {
            ctx.fillStyle = strokeCol;
            ctx.beginPath();
            ctx.arc(0, 0, radius * 0.25, 0, Math.PI*2);
            ctx.fill();
            for (let a = 0; a < Math.PI*2; a += Math.PI/3) {
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(Math.cos(a) * radius, Math.sin(a) * radius);
                ctx.stroke();
            }
        } else if (selectedSkin === "watermelon") {
            ctx.strokeStyle = strokeCol;
            ctx.lineWidth = 2 * pBall.scale;
            ctx.beginPath();
            ctx.arc(0, 0, radius - 4, -Math.PI/3, Math.PI/3);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(0, 0, radius - 4, Math.PI*0.7, Math.PI * 1.3);
            ctx.stroke();
        } else if (selectedSkin === "basketball") {
            ctx.strokeStyle = strokeCol;
            ctx.lineWidth = 1.5 * pBall.scale;
            ctx.beginPath();
            ctx.moveTo(-radius, 0);
            ctx.lineTo(radius, 0);
            ctx.moveTo(0, -radius);
            ctx.lineTo(0, radius);
            ctx.stroke();
        } else if (selectedSkin === "neon") {
            ctx.fillStyle = "#ffffff";
            ctx.beginPath();
            ctx.arc(-radius * 0.2, -radius * 0.2, radius * 0.25, 0, Math.PI*2);
            ctx.fill();
        } else if (selectedSkin === "sunset") {
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 2 * pBall.scale;
            ctx.beginPath();
            ctx.arc(0, 0, radius/2, 0, Math.PI, true);
            ctx.stroke();
        }

        ctx.restore();
    }
}

function drawCloud(x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.arc(x + r * 0.7, y - r * 0.2, r * 0.8, 0, Math.PI * 2);
    ctx.arc(x - r * 0.7, y - r * 0.1, r * 0.7, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fill();
}

// Tick loop
function gameLoop() {
    if (isPlaying) {
        update();
        draw();
        requestAnimationFrame(gameLoop);
    }
}

// Bind Button Listeners
playBtn.addEventListener('click', startLevel);
retryBtn.addEventListener('click', startLevel);

// Initial draw background on load
startLevel();
isPlaying = false; // Pause immediately to show start screen
draw();
