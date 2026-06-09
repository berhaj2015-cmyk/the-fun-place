/**
 * game.js
 * Sunset Connect 4 - Pass and play and AI matches
 */

import { Auth } from '../../js/auth.js';
import { Leaderboard } from '../../js/leaderboard.js';

// DOM Elements
const canvas = document.getElementById('connect-canvas');
const ctx = canvas.getContext('2d');
const startScreen = document.getElementById('start-screen');
const gameoverScreen = document.getElementById('gameover-screen');
const playBtn = document.getElementById('play-btn');
const retryBtn = document.getElementById('retry-btn');
const gameoverTitle = document.getElementById('gameover-title');
const gameoverSubtitle = document.getElementById('gameover-subtitle');
const streakScoreDiv = document.getElementById('streak-score');
const submissionStatus = document.getElementById('submission-status');

const hudGameMode = document.getElementById('hud-game-mode');
const hudStreak = document.getElementById('hud-streak');
const turnCard = document.getElementById('turn-card');
const turnToken = document.getElementById('turn-token');
const turnText = document.getElementById('turn-text');

const modeAiBtn = document.getElementById('mode-ai');
const modeLocalBtn = document.getElementById('mode-local');
const instructionsList = document.getElementById('instructions-list');

// Canvas dimensions and board layouts
const COLS = 7;
const ROWS = 6;
const CELL_SIZE = 64;
const BOARD_WIDTH = COLS * CELL_SIZE;
const BOARD_HEIGHT = ROWS * CELL_SIZE;
const BOARD_X = (canvas.width - BOARD_WIDTH) / 2;
const BOARD_Y = (canvas.height - BOARD_HEIGHT) / 2 + 10;

// Game State
let isPlaying = false;
let gameMode = 'ai'; // 'ai' or 'local'
let board = [];      // 2D Array [col][row]: 0 = empty, 1 = Pink, 2 = Blue
let currentPlayer = 1; // 1 = Pink, 2 = Blue
let winStreak = 0;
let hoverCol = -1;
let animatingPieces = [];
let winningLine = null; // Coordinates of winning 4 tokens
let boardLocked = false; // Prevents clicking during animations/AI turns

// Initial Board Reset
function resetBoard() {
    board = Array(COLS).fill(null).map(() => Array(ROWS).fill(0));
    animatingPieces = [];
    winningLine = null;
    currentPlayer = 1;
    boardLocked = false;
    updateTurnIndicator();
}

// Mode Buttons Switch
modeAiBtn.addEventListener('click', () => {
    gameMode = 'ai';
    modeAiBtn.classList.add('selected');
    modeLocalBtn.classList.remove('selected');
    hudGameMode.textContent = "Player vs AI";
    instructionsList.innerHTML = `
        <li>You play as <strong style="color:#ff7096">Pink</strong>. The AI plays as <strong style="color:#82baff">Blue</strong>.</li>
        <li>Hover over a column and click to drop a token.</li>
        <li>Connect <strong>4 tokens in a row</strong> vertically, horizontally, or diagonally.</li>
        <li>Block your opponent from completing their lines!</li>
        <li>Beat the AI to increase your win streak. If you lose, your streak resets.</li>
    `;
});

modeLocalBtn.addEventListener('click', () => {
    gameMode = 'local';
    modeLocalBtn.classList.add('selected');
    modeAiBtn.classList.remove('selected');
    hudGameMode.textContent = "2-Player Local";
    instructionsList.innerHTML = `
        <li>Player 1 plays as <strong style="color:#ff7096">Pink</strong>.</li>
        <li>Player 2 plays as <strong style="color:#82baff">Blue</strong>.</li>
        <li>Pass the device and take turns clicking on columns to drop tokens.</li>
        <li>Connect <strong>4 tokens in a row</strong> vertically, horizontally, or diagonally.</li>
        <li>Leaderboard streaks are only earned in vs AI mode.</li>
    `;
});

// Update turn UI displays
function updateTurnIndicator() {
    if (currentPlayer === 1) {
        turnToken.className = "token-preview token-pink";
        turnText.textContent = gameMode === 'ai' ? "Your Turn (Pink)" : "Player 1's Turn (Pink)";
    } else {
        turnToken.className = "token-preview token-blue";
        turnText.textContent = gameMode === 'ai' ? "AI is thinking..." : "Player 2's Turn (Blue)";
    }
}

// Check for Win state
function checkWin(tempBoard = board) {
    // 1. Horizontal
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS - 3; c++) {
            const val = tempBoard[c][r];
            if (val !== 0 && val === tempBoard[c+1][r] && val === tempBoard[c+2][r] && val === tempBoard[c+3][r]) {
                return { winner: val, line: [{c, r}, {c: c+1, r}, {c: c+2, r}, {c: c+3, r}] };
            }
        }
    }
    // 2. Vertical
    for (let c = 0; c < COLS; c++) {
        for (let r = 0; r < ROWS - 3; r++) {
            const val = tempBoard[c][r];
            if (val !== 0 && val === tempBoard[c][r+1] && val === tempBoard[c][r+2] && val === tempBoard[c][r+3]) {
                return { winner: val, line: [{c, r}, {c, r+1}, {c, r+2}, {c, r+3}] };
            }
        }
    }
    // 3. Diagonal Up-Right
    for (let c = 0; c < COLS - 3; c++) {
        for (let r = 3; r < ROWS; r++) {
            const val = tempBoard[c][r];
            if (val !== 0 && val === tempBoard[c+1][r-1] && val === tempBoard[c+2][r-2] && val === tempBoard[c+3][r-3]) {
                return { winner: val, line: [{c, r}, {c: c+1, r-1}, {c: c+2, r-2}, {c: c+3, r-3}] };
            }
        }
    }
    // 4. Diagonal Down-Right
    for (let c = 0; c < COLS - 3; c++) {
        for (let r = 0; r < ROWS - 3; r++) {
            const val = tempBoard[c][r];
            if (val !== 0 && val === tempBoard[c+1][r+1] && val === tempBoard[c+2][r+2] && val === tempBoard[c+3][r+3]) {
                return { winner: val, line: [{c, r}, {c: c+1, r+1}, {c: c+2, r+2}, {c: c+3, r+3}] };
            }
        }
    }
    
    return null;
}

// Check if board is fully loaded (Draw)
function checkDraw() {
    for (let c = 0; c < COLS; c++) {
        if (board[c][0] === 0) return false;
    }
    return true;
}

// Drop piece action
function dropPiece(col, player) {
    // Find bottom-most empty slot
    let targetRow = -1;
    for (let r = ROWS - 1; r >= 0; r--) {
        if (board[col][r] === 0) {
            targetRow = r;
            break;
        }
    }
    
    if (targetRow === -1) return false; // Column full
    
    boardLocked = true;
    
    // Setup target Y coordinates
    const targetY = BOARD_Y + (targetRow * CELL_SIZE) + CELL_SIZE / 2;
    const startY = BOARD_Y - CELL_SIZE / 2;
    const startX = BOARD_X + (col * CELL_SIZE) + CELL_SIZE / 2;
    
    // Add to animating pieces list
    animatingPieces.push({
        col,
        row: targetRow,
        x: startX,
        y: startY,
        targetY,
        player,
        vy: 0,
        gravity: 0.65,
        bounce: 0.25,
        bounceCount: 0
    });
    
    return true;
}

// AI logic picks a move
function makeAiMove() {
    if (!isPlaying || boardLocked) return;
    
    let selectedCol = -1;
    
    // Helper to see if a drop causes a win on a temporary board copy
    function getTempBoardWithMove(col, player) {
        const copy = board.map(arr => [...arr]);
        for (let r = ROWS - 1; r >= 0; r--) {
            if (copy[col][r] === 0) {
                copy[col][r] = player;
                return copy;
            }
        }
        return null;
    }
    
    // Step 1: Check if AI (Player 2) can win immediately
    for (let c = 0; c < COLS; c++) {
        if (board[c][0] !== 0) continue; // column full
        const temp = getTempBoardWithMove(c, 2);
        if (temp && checkWin(temp)?.winner === 2) {
            selectedCol = c;
            break;
        }
    }
    
    // Step 2: Block player (Player 1) from winning immediately
    if (selectedCol === -1) {
        for (let c = 0; c < COLS; c++) {
            if (board[c][0] !== 0) continue;
            const temp = getTempBoardWithMove(c, 1);
            if (temp && checkWin(temp)?.winner === 1) {
                selectedCol = c;
                break;
            }
        }
    }
    
    // Step 3: Prefer center column, then adjacent ones
    if (selectedCol === -1) {
        const preferredCols = [3, 2, 4, 1, 5, 0, 6];
        for (let c of preferredCols) {
            if (board[c][0] === 0) {
                // Do not choose a column that gives the player a win on their next turn
                const tempAi = getTempBoardWithMove(c, 2);
                // Check cell directly above it
                let givesWin = false;
                let targetRow = -1;
                for (let r = ROWS - 1; r >= 0; r--) {
                    if (board[c][r] === 0) {
                        targetRow = r;
                        break;
                    }
                }
                if (targetRow > 0) {
                    // Simulates player dropping in the slot above
                    const nextTemp = tempAi.map(arr => [...arr]);
                    nextTemp[c][targetRow - 1] = 1;
                    if (checkWin(nextTemp)?.winner === 1) {
                        givesWin = true;
                    }
                }
                
                if (!givesWin) {
                    selectedCol = c;
                    break;
                }
            }
        }
    }
    
    // Step 4: Fallback to any valid column
    if (selectedCol === -1) {
        const validCols = [];
        for (let c = 0; c < COLS; c++) {
            if (board[c][0] === 0) validCols.push(c);
        }
        if (validCols.length > 0) {
            selectedCol = validCols[Math.floor(Math.random() * validCols.length)];
        }
    }
    
    if (selectedCol !== -1) {
        // AI Drops piece after small delay
        setTimeout(() => {
            dropPiece(selectedCol, 2);
        }, 600);
    }
}

// Mouse Event Handlers
canvas.addEventListener('mousemove', (e) => {
    if (!isPlaying || boardLocked || (gameMode === 'ai' && currentPlayer === 2)) {
        hoverCol = -1;
        return;
    }
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    
    if (mouseX >= BOARD_X && mouseX <= BOARD_X + BOARD_WIDTH) {
        hoverCol = Math.floor((mouseX - BOARD_X) / CELL_SIZE);
        // clamp column range
        hoverCol = Math.max(0, Math.min(COLS - 1, hoverCol));
        
        // Disable hover indicator if column full
        if (board[hoverCol][0] !== 0) hoverCol = -1;
    } else {
        hoverCol = -1;
    }
});

canvas.addEventListener('mouseleave', () => {
    hoverCol = -1;
});

canvas.addEventListener('click', (e) => {
    if (!isPlaying || boardLocked || hoverCol === -1) return;
    if (gameMode === 'ai' && currentPlayer === 2) return;
    
    const col = hoverCol;
    hoverCol = -1; // disable hover
    
    const success = dropPiece(col, currentPlayer);
    if (success && gameMode === 'local') {
        // Just triggers drop, switch turn happens inside animator settlement
    }
});

// Update board physics and animations
function update() {
    for (let i = animatingPieces.length - 1; i >= 0; i--) {
        const p = animatingPieces[i];
        
        // Apply physics
        p.vy += p.gravity;
        p.y += p.vy;
        
        // Reached target slot row
        if (p.y >= p.targetY) {
            p.y = p.targetY;
            
            // Handle bounce physics
            if (p.bounceCount < 2) {
                p.vy = -p.vy * p.bounce;
                p.bounceCount++;
            } else {
                // Settled
                board[p.col][p.row] = p.player;
                animatingPieces.splice(i, 1);
                
                // Check for Game Ends
                const winData = checkWin();
                if (winData) {
                    winningLine = winData.line;
                    endGame(winData.winner);
                } else if (checkDraw()) {
                    endGame(0);
                } else {
                    // Switch turn
                    currentPlayer = currentPlayer === 1 ? 2 : 1;
                    updateTurnIndicator();
                    boardLocked = false;
                    
                    // Trigger AI moves
                    if (gameMode === 'ai' && currentPlayer === 2) {
                        makeAiMove();
                    }
                }
            }
        }
    }
}

// Render game graphics
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 1. Draw Column Hover Highlight
    if (hoverCol !== -1 && isPlaying && !boardLocked) {
        ctx.fillStyle = 'rgba(255, 133, 162, 0.15)';
        ctx.fillRect(BOARD_X + hoverCol * CELL_SIZE, BOARD_Y, CELL_SIZE, BOARD_HEIGHT);
    }
    
    // 2. Draw Falling pieces (drawn behind board)
    animatingPieces.forEach(p => {
        ctx.save();
        ctx.fillStyle = p.player === 1 ? '#ff85a2' : '#a2d2ff';
        ctx.strokeStyle = p.player === 1 ? '#ff7096' : '#82baff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, CELL_SIZE / 2 - 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    });
    
    // 3. Draw Placed pieces (drawn behind board)
    for (let c = 0; c < COLS; c++) {
        for (let r = 0; r < ROWS; r++) {
            const p = board[c][r];
            if (p !== 0) {
                const x = BOARD_X + c * CELL_SIZE + CELL_SIZE / 2;
                const y = BOARD_Y + r * CELL_SIZE + CELL_SIZE / 2;
                
                // Highlight winning tokens
                let isWinningToken = false;
                if (winningLine) {
                    isWinningToken = winningLine.some(coord => coord.c === c && coord.r === r);
                }
                
                ctx.save();
                ctx.fillStyle = p === 1 ? '#ff85a2' : '#a2d2ff';
                ctx.strokeStyle = p === 1 ? '#ff7096' : '#82baff';
                ctx.lineWidth = 2;
                
                if (isWinningToken) {
                    // Pulsing golden shadow border
                    ctx.shadowBlur = 15;
                    ctx.shadowColor = '#ffd700';
                    ctx.strokeStyle = '#ffd700';
                    ctx.lineWidth = 4;
                }
                
                ctx.beginPath();
                ctx.arc(x, y, CELL_SIZE / 2 - 5, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                ctx.restore();
            }
        }
    }
    
    // 4. Draw Connect 4 Board Plate (covers pieces, transparent circular holes)
    ctx.save();
    
    // Canvas Masking Trick:
    // Create a path of the outer board plate, then cut circular holes out of it
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)'; // glass board color
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 3;
    
    // Begin mask drawing
    ctx.beginPath();
    ctx.roundRect(BOARD_X - 10, BOARD_Y - 10, BOARD_WIDTH + 20, BOARD_HEIGHT + 20, 20);
    ctx.fill();
    ctx.stroke();
    
    // Cut out circular slots using destination-out composite mode
    ctx.globalCompositeOperation = 'destination-out';
    
    for (let c = 0; c < COLS; c++) {
        for (let r = 0; r < ROWS; r++) {
            const x = BOARD_X + c * CELL_SIZE + CELL_SIZE / 2;
            const y = BOARD_Y + r * CELL_SIZE + CELL_SIZE / 2;
            
            ctx.beginPath();
            ctx.arc(x, y, CELL_SIZE / 2 - 6, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    // Restore default composite operation
    ctx.globalCompositeOperation = 'source-over';
    
    // Add inner shadow rim overlay for 3D depth inside holes
    ctx.strokeStyle = 'rgba(45, 30, 47, 0.1)';
    ctx.lineWidth = 2;
    for (let c = 0; c < COLS; c++) {
        for (let r = 0; r < ROWS; r++) {
            const x = BOARD_X + c * CELL_SIZE + CELL_SIZE / 2;
            const y = BOARD_Y + r * CELL_SIZE + CELL_SIZE / 2;
            ctx.beginPath();
            ctx.arc(x, y, CELL_SIZE / 2 - 6, 0, Math.PI * 2);
            ctx.stroke();
        }
    }
    
    ctx.restore();
    
    // 5. Draw winning connection line
    if (winningLine && winningLine.length > 0) {
        ctx.save();
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ffd700';
        
        const first = winningLine[0];
        const last = winningLine[winningLine.length - 1];
        
        const fx = BOARD_X + first.c * CELL_SIZE + CELL_SIZE / 2;
        const fy = BOARD_Y + first.r * CELL_SIZE + CELL_SIZE / 2;
        const lx = BOARD_X + last.c * CELL_SIZE + CELL_SIZE / 2;
        const ly = BOARD_Y + last.r * CELL_SIZE + CELL_SIZE / 2;
        
        ctx.beginPath();
        ctx.moveTo(fx, fy);
        ctx.lineTo(lx, ly);
        ctx.stroke();
        ctx.restore();
    }
}

// Tick loop
function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// Reset win streak count
function resetStreak() {
    winStreak = 0;
    hudStreak.textContent = winStreak;
}

// Start game flow
function startGame() {
    resetBoard();
    startScreen.classList.add('hidden');
    gameoverScreen.classList.add('hidden');
    isPlaying = true;
    
    // If AI goes first (currently Player 1 starts, so Player starts)
    updateTurnIndicator();
}

// Match ends
async function endGame(winner) {
    isPlaying = false;
    boardLocked = true;
    
    setTimeout(async () => {
        gameoverScreen.classList.remove('hidden');
        
        // Establish texts
        if (winner === 0) {
            gameoverTitle.textContent = "It's a Draw";
            gameoverTitle.style.color = "#6d5b70";
            gameoverSubtitle.textContent = "The board is completely full!";
            if (gameMode === 'ai') {
                resetStreak(); // Draw resets AI streak
            }
        } else if (winner === 1) {
            gameoverTitle.textContent = gameMode === 'ai' ? "You Won! ✨" : "Player 1 Wins!";
            gameoverTitle.style.color = "#2e7d32";
            gameoverSubtitle.textContent = gameMode === 'ai' ? "You connected 4 successfully!" : "Pink connects 4 first!";
            
            if (gameMode === 'ai') {
                winStreak++;
                hudStreak.textContent = winStreak;
            }
        } else {
            gameoverTitle.textContent = gameMode === 'ai' ? "AI Computer Won" : "Player 2 Wins!";
            gameoverTitle.style.color = "#e53935";
            gameoverSubtitle.textContent = gameMode === 'ai' ? "AI connected 4 first!" : "Blue connects 4 first!";
            
            if (gameMode === 'ai') {
                resetStreak();
            }
        }
        
        // Streak display
        streakScoreDiv.textContent = `AI Win Streak: ${winStreak}`;
        if (gameMode === 'local') {
            streakScoreDiv.textContent = "Local Match (No streaks)";
        }
        
        // Submitting scores
        const currentUser = Auth.getCurrentUser();
        if (gameMode === 'ai' && winner === 1) {
            if (currentUser) {
                submissionStatus.innerHTML = `<span style="color:#6d5b70;">Submitting streak score to Leaderboard...</span>`;
                try {
                    await Leaderboard.submitScore('connect4', winStreak);
                    submissionStatus.innerHTML = `<span style="color:#2e7d32; font-weight:600;">✨ High streak of ${winStreak} saved to Leaderboard!</span>`;
                } catch (e) {
                    submissionStatus.innerHTML = `<span style="color:#e53935;">Error submitting score: ${e.message}</span>`;
                }
            } else {
                submissionStatus.innerHTML = `<i>Login on the homepage to register your win streaks!</i>`;
            }
        } else if (gameMode === 'ai' && winner === 2) {
            submissionStatus.innerHTML = `<i>Win streak reset to 0. Better luck next time!</i>`;
        } else {
            submissionStatus.innerHTML = ``;
        }
    }, 1000);
}

// Bind Button Listeners
playBtn.addEventListener('click', startGame);
retryBtn.addEventListener('click', startGame);

// Run initialization
resetBoard();
requestAnimationFrame(gameLoop);
resetStreak();
