/**
 * game.js
 * Galaga Space Zen - Gameplay and canvas rendering
 */

import { Auth } from '../../js/auth.js';
import { Leaderboard } from '../../js/leaderboard.js';

// DOM Selectors
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const startScreen = document.getElementById('start-screen');
const gameoverScreen = document.getElementById('gameover-screen');
const playBtn = document.getElementById('play-btn');
const retryBtn = document.getElementById('retry-btn');
const finalScoreSpan = document.getElementById('final-score');
const submissionStatus = document.getElementById('submission-status');

const hudLevel = document.getElementById('hud-level');
const hudScore = document.getElementById('hud-score');
const hudLives = document.getElementById('hud-lives');

// Game constants
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 490;
const SHIP_WIDTH = 44;
const SHIP_HEIGHT = 40;
const BASE_TARGET_SPEED = 1.0;
const TARGET_SPAWN_COUNT = 5;

// Game State
let isPlaying = false;
let score = 0;
let level = 1;
let lives = 3;
let keys = {};
let ship = {
    x: CANVAS_WIDTH / 2 - SHIP_WIDTH / 2,
    y: CANVAS_HEIGHT - 60,
    width: SHIP_WIDTH,
    height: SHIP_HEIGHT,
    speed: 6.5
};

let bullets = [];
let targets = [];
let particles = [];
let stars = [];
let lastShotTime = 0;
let lastLevelUpTime = 0;
let levelUpBannerAlpha = 0;

// Initialize parallax stars background
function initStars() {
    stars = [];
    for (let i = 0; i < 60; i++) {
        stars.push({
            x: Math.random() * CANVAS_WIDTH,
            y: Math.random() * CANVAS_HEIGHT,
            size: Math.random() * 1.8 + 0.5,
            speed: Math.random() * 0.4 + 0.1,
            brightness: Math.random(),
            fadeDir: Math.random() > 0.5 ? 0.02 : -0.02
        });
    }
}

// Spawning target bubbles
function spawnWave() {
    targets = [];
    const waveCount = TARGET_SPAWN_COUNT + (level * 2);
    const speedMultiplier = 1.0 + (level - 1) * 0.22;
    
    // Spawn targets in organized starting columns above viewport
    for (let i = 0; i < waveCount; i++) {
        const radius = Math.random() * 10 + 16; // soft sizes
        // Grid-based initial layout to look aesthetic
        const cols = Math.min(8, waveCount);
        const colWidth = CANVAS_WIDTH / (cols + 1);
        const col = i % cols;
        const row = Math.floor(i / cols);
        
        const x = colWidth * (col + 1) + (Math.random() * 20 - 10);
        const y = -60 - (row * 60) - (Math.random() * 30);
        
        // Choose beautiful pastel colors for targets
        const colorChoices = [
            'rgba(179, 197, 255, 0.75)', // Lavender Blue
            'rgba(255, 202, 212, 0.75)', // Peach
            'rgba(222, 192, 241, 0.75)', // Purple
            'rgba(162, 210, 255, 0.75)'  // Sky Blue
        ];
        const color = colorChoices[Math.floor(Math.random() * colorChoices.length)];
        
        targets.push({
            x,
            y,
            radius,
            speed: (BASE_TARGET_SPEED + Math.random() * 0.4) * speedMultiplier,
            color,
            pulse: Math.random() * Math.PI // for subtle size waving animation
        });
    }
}

// Particle explosion
function createExplosion(x, y, color) {
    const particleCount = 12;
    for (let i = 0; i < particleCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 2.5 + 1;
        particles.push({
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            radius: Math.random() * 2 + 1.5,
            color,
            alpha: 1.0,
            decay: Math.random() * 0.03 + 0.015
        });
    }
}

// Input Handlers
window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
});
window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
});

// Update HUD displays
function updateHUD() {
    hudLevel.textContent = level;
    hudScore.textContent = score;
    hudLives.textContent = '💖'.repeat(Math.max(0, lives)) + (lives < 3 ? '💔'.repeat(3 - Math.max(0, lives)) : '');
}

// Reset Game State
function resetGame() {
    score = 0;
    level = 1;
    lives = 3;
    ship.x = CANVAS_WIDTH / 2 - SHIP_WIDTH / 2;
    bullets = [];
    targets = [];
    particles = [];
    initStars();
    spawnWave();
    updateHUD();
}

// Start Game Play
function startGame() {
    resetGame();
    startScreen.classList.add('hidden');
    gameoverScreen.classList.add('hidden');
    isPlaying = true;
}

// Game Over Transition
async function gameOver() {
    isPlaying = false;
    gameoverScreen.classList.remove('hidden');
    finalScoreSpan.textContent = score;
    
    const currentUser = Auth.getCurrentUser();
    if (currentUser) {
        submissionStatus.innerHTML = `<span style="color: #635067;">Saving score for <b>${currentUser.username}</b>...</span>`;
        try {
            await Leaderboard.submitScore('galaga', score);
            submissionStatus.innerHTML = `<span style="color: #2e7d32; font-weight: 600;">✨ High score successfully saved to Leaderboard!</span>`;
        } catch (err) {
            submissionStatus.innerHTML = `<span style="color: #e53935;">Error saving score: ${err.message}</span>`;
        }
    } else {
        submissionStatus.innerHTML = `<i>Login on the homepage to register your scores!</i>`;
    }
}

// Update game mechanics
function update() {
    if (!isPlaying) return;
    
    // 1. Ship movement
    if (keys['ArrowLeft'] || keys['KeyA']) {
        ship.x -= ship.speed;
        if (ship.x < 10) ship.x = 10;
    }
    if (keys['ArrowRight'] || keys['KeyD']) {
        ship.x += ship.speed;
        if (ship.x > CANVAS_WIDTH - ship.width - 10) ship.x = CANVAS_WIDTH - ship.width - 10;
    }
    
    // 2. Shooting stardust
    if (keys['Space']) {
        const now = Date.now();
        if (now - lastShotTime > 220) { // Throttled fire rate
            bullets.push({
                x: ship.x + ship.width / 2,
                y: ship.y - 4,
                radius: 3,
                speed: 7.5
            });
            lastShotTime = now;
        }
    }
    
    // 3. Update stars background
    stars.forEach(star => {
        star.y += star.speed;
        if (star.y > CANVAS_HEIGHT) {
            star.y = 0;
            star.x = Math.random() * CANVAS_WIDTH;
        }
        // Twinkling effect
        star.brightness += star.fadeDir;
        if (star.brightness > 1 || star.brightness < 0.2) {
            star.fadeDir = -star.fadeDir;
        }
    });
    
    // 4. Update bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
        bullets[i].y -= bullets[i].speed;
        if (bullets[i].y < 0) {
            bullets.splice(i, 1);
        }
    }
    
    // 5. Update targets
    for (let i = targets.length - 1; i >= 0; i--) {
        const t = targets[i];
        t.y += t.speed;
        t.pulse += 0.03;
        
        // Target hits bottom - lose life
        if (t.y - t.radius > CANVAS_HEIGHT) {
            targets.splice(i, 1);
            lives--;
            updateHUD();
            createExplosion(t.x, CANVAS_HEIGHT - 10, 'rgba(255, 100, 100, 0.4)');
            
            if (lives <= 0) {
                gameOver();
                return;
            }
            continue;
        }
        
        // Target collides with ship - lose life
        const shipCenterX = ship.x + ship.width / 2;
        const shipCenterY = ship.y + ship.height / 2;
        const distToShip = Math.hypot(t.x - shipCenterX, t.y - shipCenterY);
        
        if (distToShip < t.radius + Math.min(ship.width, ship.height) / 2) {
            targets.splice(i, 1);
            lives--;
            updateHUD();
            createExplosion(t.x, t.y, 'rgba(255, 133, 162, 0.8)');
            
            if (lives <= 0) {
                gameOver();
                return;
            }
            continue;
        }
        
        // Bullet collisions
        for (let j = bullets.length - 1; j >= 0; j--) {
            const b = bullets[j];
            const distToBullet = Math.hypot(t.x - b.x, t.y - b.y);
            
            if (distToBullet < t.radius + b.radius) {
                // POP!
                createExplosion(t.x, t.y, t.color);
                bullets.splice(j, 1);
                targets.splice(i, 1);
                
                score += 100;
                updateHUD();
                break;
            }
        }
    }
    
    // 6. Update particles
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= p.decay;
        if (p.alpha <= 0) {
            particles.splice(i, 1);
        }
    }
    
    // Check level clear / wave cleared
    if (targets.length === 0 && isPlaying) {
        level++;
        updateHUD();
        lastLevelUpTime = Date.now();
        levelUpBannerAlpha = 1.0;
        spawnWave();
    }
}

// Render game graphics
function draw() {
    // Clear canvas
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // 1. Draw stars background
    stars.forEach(star => {
        ctx.fillStyle = `rgba(255, 255, 255, ${star.brightness})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
    });
    
    if (!isPlaying) return;
    
    // 2. Draw Ship (glowing pastel ship with exhaust flame)
    ctx.save();
    ctx.translate(ship.x + ship.width / 2, ship.y + ship.height / 2);
    
    // Ship Flame (pulsing exhaust)
    const flameHeight = 10 + Math.sin(Date.now() / 40) * 4;
    const flameGrad = ctx.createLinearGradient(0, ship.height / 2, 0, ship.height / 2 + flameHeight);
    flameGrad.addColorStop(0, 'rgba(255, 133, 162, 1)');
    flameGrad.addColorStop(1, 'rgba(179, 197, 255, 0)');
    ctx.fillStyle = flameGrad;
    ctx.beginPath();
    ctx.moveTo(-6, ship.height / 2 - 5);
    ctx.lineTo(6, ship.height / 2 - 5);
    ctx.lineTo(0, ship.height / 2 + flameHeight);
    ctx.closePath();
    ctx.fill();
    
    // Main Ship Body (Pastel Pink Zen Wing design)
    ctx.fillStyle = '#ff85a2';
    ctx.shadowBlur = 10;
    ctx.shadowColor = 'rgba(255, 133, 162, 0.6)';
    ctx.beginPath();
    ctx.moveTo(0, -ship.height / 2); // nose cone
    ctx.lineTo(ship.width / 2, ship.height / 2); // right wing tip
    ctx.lineTo(ship.width / 4, ship.height / 3); // right wing notch
    ctx.lineTo(-ship.width / 4, ship.height / 3); // left wing notch
    ctx.lineTo(-ship.width / 2, ship.height / 2); // left wing tip
    ctx.closePath();
    ctx.fill();
    
    // Ship Cockpit canopy (Pastel light blue glass)
    ctx.fillStyle = '#dec0f1';
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.moveTo(0, -ship.height / 4);
    ctx.lineTo(6, ship.height / 6);
    ctx.lineTo(-6, ship.height / 6);
    ctx.closePath();
    ctx.fill();
    
    ctx.restore();
    
    // 3. Draw Bullets (stardust beam)
    bullets.forEach(b => {
        ctx.fillStyle = '#ffd166';
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#ffd166';
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.shadowBlur = 0; // reset
    
    // 4. Draw Targets (glassmorphic bubbles)
    targets.forEach(t => {
        const sizeOffset = Math.sin(t.pulse) * 1.5;
        const size = t.radius + sizeOffset;
        
        ctx.save();
        ctx.beginPath();
        ctx.arc(t.x, t.y, size, 0, Math.PI * 2);
        ctx.fillStyle = t.color;
        
        // Add subtle shadow to bubbles
        ctx.shadowBlur = 6;
        ctx.shadowColor = t.color.replace('0.75', '0.3');
        ctx.fill();
        
        // Add glossy shine reflection inside bubble
        ctx.beginPath();
        ctx.arc(t.x - size * 0.32, t.y - size * 0.32, size * 0.2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.fill();
        ctx.restore();
    });
    
    // 5. Draw Particles
    particles.forEach(p => {
        ctx.save();
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    });
    
    // 6. Level Up Banner Display
    if (levelUpBannerAlpha > 0) {
        ctx.save();
        levelUpBannerAlpha -= 0.015;
        ctx.globalAlpha = levelUpBannerAlpha;
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.fillRect(0, CANVAS_HEIGHT / 2 - 45, CANVAS_WIDTH, 80);
        
        ctx.font = 'bold 2rem Outfit, sans-serif';
        ctx.fillStyle = '#ff85a2';
        ctx.textAlign = 'center';
        ctx.shadowBlur = 12;
        ctx.shadowColor = 'rgba(255, 133, 162, 0.5)';
        ctx.fillText(`Wave ${level} Cleared`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 2);
        
        ctx.font = '500 1.1rem Quicksand, sans-serif';
        ctx.fillStyle = '#2d1e2f';
        ctx.shadowBlur = 0;
        ctx.fillText(`Entering Wave ${level}...`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 25);
        ctx.restore();
    }
}

// Main Game Loop
function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}

// Set up UI listeners
playBtn.addEventListener('click', startGame);
retryBtn.addEventListener('click', startGame);

// Start Loop
initStars();
requestAnimationFrame(loop);
updateHUD();
