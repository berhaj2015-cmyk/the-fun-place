/**
 * game.js
 * Blossom Hangman - Word guessing with drifting cherry blossom petals
 */

import { Auth } from '../../js/auth.js';
import { Leaderboard } from '../../js/leaderboard.js';

// DOM Selectors
const canvas = document.getElementById('hangman-canvas');
const ctx = canvas.getContext('2d');
const startScreen = document.getElementById('start-screen');
const gameoverScreen = document.getElementById('gameover-screen');
const playBtn = document.getElementById('play-btn');
const retryBtn = document.getElementById('retry-btn');
const finalScoreSpan = document.getElementById('final-score');
const revealWordSpan = document.getElementById('reveal-word');
const submissionStatus = document.getElementById('submission-status');

const hudWords = document.getElementById('hud-words');
const hudScore = document.getElementById('hud-score');
const hudPetals = document.getElementById('hud-petals');

const wordSlotsContainer = document.getElementById('word-slots-container');
const wordHintText = document.getElementById('word-hint-text');
const keyboardContainer = document.getElementById('keyboard-container');

// Word list dictionary
const WORDS_DB = [
    { word: "serene", hint: "Calm, peaceful, and untroubled" },
    { word: "breeze", hint: "A light, gentle, and refreshing wind" },
    { word: "sunset", hint: "The daily descent of the sun below the horizon" },
    { word: "lotus", hint: "A beautiful aquatic flower representing peace" },
    { word: "meadow", hint: "A tranquil field of grasses and wildflowers" },
    { word: "forest", hint: "A peaceful woodland covered in rich greenery" },
    { word: "slumber", hint: "A deep, calm, and restorative sleep" },
    { word: "zen", hint: "A state of mindful calm and intuitive focus" },
    { word: "peace", hint: "A state of harmony and freedom from noise" },
    { word: "gentle", hint: "Mild, soft, and soothing in nature" },
    { word: "ocean", hint: "A vast, rhythmic body of salt water" },
    { word: "mist", hint: "A soft cloud of tiny water droplets floating near the ground" },
    { word: "ripple", hint: "A tiny wave spreading calmly across water" },
    { word: "glow", hint: "A steady, warm, and comforting light" },
    { word: "garden", hint: "A quiet, cultivated plot of flowers and plants" },
    { word: "bamboo", hint: "A tall, flexible, and resilient grass of eastern origin" },
    { word: "cozy", hint: "Giving a feeling of comfort, warmth, and relaxation" },
    { word: "pillow", hint: "A soft support for the head during rest" },
    { word: "dusk", hint: "The tranquil stage of twilight just before dark" }
];

// Game State
let isPlaying = false;
let score = 0;
let solvedWordsCount = 0;
let incorrectGuesses = 0;
let currentWordObj = null;
let guessedLetters = new Set();
let remainingWords = [...WORDS_DB];

// Petals simulation properties
// 6 starting anchors on the branch
const petalAnchors = [
    { x: 130, y: 110, angle: -0.2, sizeX: 8, sizeY: 12 },
    { x: 165, y: 85, angle: 0.3, sizeX: 7, sizeY: 10 },
    { x: 190, y: 95, angle: -0.5, sizeX: 9, sizeY: 11 },
    { x: 210, y: 70, angle: 0.1, sizeX: 8, sizeY: 12 },
    { x: 240, y: 80, angle: 0.6, sizeX: 7, sizeY: 10 },
    { x: 255, y: 55, angle: -0.1, sizeX: 8, sizeY: 11 }
];
let activePetals = [true, true, true, true, true, true]; // reflects which are still on tree
let fallingPetals = [];

// Initialize or select word
function selectNewWord() {
    if (remainingWords.length === 0) {
        // Recycle list if all used
        remainingWords = [...WORDS_DB];
    }
    
    const index = Math.floor(Math.random() * remainingWords.length);
    currentWordObj = remainingWords[index];
    remainingWords.splice(index, 1); // remove so we don't repeat immediately
    
    guessedLetters.clear();
    incorrectGuesses = 0;
    activePetals = [true, true, true, true, true, true];
    
    renderWordSlots();
    renderKeyboard();
    updateHUD();
}

// Render spaces/slots
function renderWordSlots() {
    wordSlotsContainer.innerHTML = '';
    const word = currentWordObj.word;
    
    for (let char of word) {
        const slot = document.createElement('div');
        slot.className = 'word-slot';
        
        if (guessedLetters.has(char)) {
            slot.textContent = char;
        } else {
            slot.textContent = '';
        }
        
        wordSlotsContainer.appendChild(slot);
    }
    
    wordHintText.textContent = `Hint: ${currentWordObj.hint}`;
}

// Render letter keyboard
function renderKeyboard() {
    keyboardContainer.innerHTML = '';
    const letters = "abcdefghijklmnopqrstuvwxyz";
    
    for (let letter of letters) {
        const btn = document.createElement('button');
        btn.className = 'key-btn';
        btn.textContent = letter;
        btn.dataset.letter = letter;
        
        // Mark disabled if already guessed
        if (guessedLetters.has(letter)) {
            btn.disabled = true;
            if (currentWordObj.word.includes(letter)) {
                btn.classList.add('correct');
            } else {
                btn.classList.add('incorrect');
            }
        }
        
        btn.addEventListener('click', () => handleGuess(letter));
        keyboardContainer.appendChild(btn);
    }
}

// Process user guess
function handleGuess(letter) {
    if (!isPlaying || guessedLetters.has(letter) || incorrectGuesses >= 6) return;
    
    guessedLetters.add(letter);
    const isCorrect = currentWordObj.word.includes(letter);
    
    // Disable key btn in GUI
    const btn = keyboardContainer.querySelector(`button[data-letter="${letter}"]`);
    if (btn) {
        btn.disabled = true;
        btn.classList.add(isCorrect ? 'correct' : 'incorrect');
    }
    
    if (isCorrect) {
        score += 10;
        updateHUD();
        renderWordSlots();
        
        // Check if full word solved
        const isSolved = [...currentWordObj.word].every(char => guessedLetters.has(char));
        if (isSolved) {
            score += 50; // solve bonus
            solvedWordsCount++;
            updateHUD();
            triggerSuccessAnimation();
        }
    } else {
        // Trigger petal drop
        triggerPetalDrop(5 - incorrectGuesses); // Petals drop from right to left
        incorrectGuesses++;
        updateHUD();
        
        if (incorrectGuesses >= 6) {
            triggerFailAnimation();
        }
    }
}

// Success word flow
function triggerSuccessAnimation() {
    // Flash slots green briefly
    const slots = document.querySelectorAll('.word-slot');
    slots.forEach(s => {
        s.style.color = '#1b5e20';
        s.style.borderBottomColor = '#1b5e20';
    });
    
    // Disable inputs
    const btns = keyboardContainer.querySelectorAll('.key-btn');
    btns.forEach(b => b.disabled = true);
    
    setTimeout(() => {
        selectNewWord();
    }, 1500);
}

// Fail word flow
function triggerFailAnimation() {
    // Disable inputs
    const btns = keyboardContainer.querySelectorAll('.key-btn');
    btns.forEach(b => b.disabled = true);
    
    setTimeout(() => {
        endGame();
    }, 1800);
}

// Launch petal physics falling animation
function triggerPetalDrop(petalIndex) {
    if (petalIndex < 0 || petalIndex >= 6) return;
    
    activePetals[petalIndex] = false;
    const anchor = petalAnchors[petalIndex];
    
    fallingPetals.push({
        x: anchor.x,
        y: anchor.y,
        vx: Math.random() * 0.6 - 0.3, // slow drift left/right
        vy: 0.8 + Math.random() * 0.4, // falling speed
        angle: anchor.angle,
        rotSpeed: Math.random() * 0.05 - 0.025,
        wobble: Math.random() * Math.PI,
        sizeX: anchor.sizeX,
        sizeY: anchor.sizeY,
        alpha: 1.0
    });
}

// Canvas Rendering Loop
function drawBranch() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 1. Draw a beautiful branch
    ctx.save();
    ctx.shadowBlur = 8;
    ctx.shadowColor = 'rgba(74, 48, 32, 0.15)';
    ctx.strokeStyle = '#5a3d28'; // branch brown
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    
    ctx.beginPath();
    ctx.moveTo(0, 200); // bottom left anchor
    ctx.quadraticCurveTo(80, 160, 150, 110);
    ctx.quadraticCurveTo(200, 80, 260, 60);
    ctx.stroke();
    
    // Small twigs off main branch
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(110, 140);
    ctx.quadraticCurveTo(130, 110, 160, 95);
    ctx.moveTo(180, 95);
    ctx.quadraticCurveTo(210, 70, 230, 75);
    ctx.stroke();
    ctx.restore();
    
    // 2. Draw active petals attached to the tree
    ctx.save();
    ctx.fillStyle = '#ffb3c1'; // pink petals
    ctx.strokeStyle = '#ff85a2';
    ctx.lineWidth = 1;
    ctx.shadowBlur = 4;
    ctx.shadowColor = 'rgba(255, 133, 162, 0.4)';
    
    for (let i = 0; i < 6; i++) {
        if (activePetals[i]) {
            const anchor = petalAnchors[i];
            drawPetal(anchor.x, anchor.y, anchor.sizeX, anchor.sizeY, anchor.angle);
        }
    }
    ctx.restore();
    
    // 3. Update and draw falling petals
    ctx.save();
    ctx.fillStyle = '#ffb3c1';
    ctx.strokeStyle = '#ff85a2';
    ctx.lineWidth = 1;
    
    for (let i = fallingPetals.length - 1; i >= 0; i--) {
        const p = fallingPetals[i];
        
        // Physics update
        p.y += p.vy;
        p.wobble += 0.05;
        p.x += Math.sin(p.wobble) * 0.5 + p.vx; // wobbling swing path
        p.angle += p.rotSpeed;
        
        // Ground collision & fade
        if (p.y > canvas.height - 15) {
            p.y = canvas.height - 15;
            p.vy = 0;
            p.vx = 0;
            p.rotSpeed = 0;
            p.alpha -= 0.012; // slowly fade on ground
        }
        
        if (p.alpha <= 0) {
            fallingPetals.splice(i, 1);
            continue;
        }
        
        // Draw falling petal
        ctx.globalAlpha = p.alpha;
        drawPetal(p.x, p.y, p.sizeX, p.sizeY, p.angle);
    }
    ctx.restore();
}

function drawPetal(x, y, rx, ry, rotation) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    
    ctx.beginPath();
    // Elliptical petal shape
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    // Small line detail down the center of petal
    ctx.strokeStyle = '#ff6b8b';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(0, ry);
    ctx.lineTo(0, -ry * 0.2);
    ctx.stroke();
    
    ctx.restore();
}

// Tick loop for drawing animation
function animationLoop() {
    drawBranch();
    requestAnimationFrame(animationLoop);
}

// Update HUD Labels
function updateHUD() {
    hudWords.textContent = solvedWordsCount;
    hudScore.textContent = score;
    hudPetals.textContent = `🌸 ${6 - incorrectGuesses}/6`;
}

// Init keyboard controls (physical keys)
function setupPhysicalKeyboard() {
    window.addEventListener('keydown', (e) => {
        if (!isPlaying || incorrectGuesses >= 6) return;
        const letter = e.key.toLowerCase();
        if (letter.length === 1 && letter >= 'a' && letter <= 'z') {
            handleGuess(letter);
        }
    });
}

// Start game flow
function startGame() {
    score = 0;
    solvedWordsCount = 0;
    fallingPetals = [];
    activePetals = [true, true, true, true, true, true];
    remainingWords = [...WORDS_DB];
    
    startScreen.classList.add('hidden');
    gameoverScreen.classList.add('hidden');
    isPlaying = true;
    
    selectNewWord();
    updateHUD();
}

// End Game
async function endGame() {
    isPlaying = false;
    gameoverScreen.classList.remove('hidden');
    finalScoreSpan.textContent = score;
    revealWordSpan.textContent = currentWordObj.word;
    
    const currentUser = Auth.getCurrentUser();
    if (currentUser) {
        submissionStatus.innerHTML = `<span style="color: #635067;">Saving score for <b>${currentUser.username}</b>...</span>`;
        try {
            await Leaderboard.submitScore('hangman', score);
            submissionStatus.innerHTML = `<span style="color: #2e7d32; font-weight: 600;">✨ High score successfully saved to Leaderboard!</span>`;
        } catch (err) {
            submissionStatus.innerHTML = `<span style="color: #e53935;">Error saving score: ${err.message}</span>`;
        }
    } else {
        submissionStatus.innerHTML = `<i>Login on the homepage to register your scores!</i>`;
    }
}

// Bind Button Listeners
playBtn.addEventListener('click', startGame);
retryBtn.addEventListener('click', startGame);

// Initialize animations
requestAnimationFrame(animationLoop);
setupPhysicalKeyboard();
updateHUD();
drawBranch();
