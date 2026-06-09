/**
 * main.js
 * Master JavaScript controller for the arcade home page.
 */

import { Auth } from './js/auth.js';
import { Leaderboard } from './js/leaderboard.js';

// DOM Element Selectors
const authStatusContainer = document.getElementById('auth-status-container');
const logoBtn = document.getElementById('logo-btn');

// Modals
const authModal = document.getElementById('auth-modal');
const authModalClose = document.getElementById('auth-modal-close');
const authModalTitle = document.getElementById('auth-modal-title');
const authForm = document.getElementById('auth-form');
const authUsernameInput = document.getElementById('auth-username');
const authPasswordInput = document.getElementById('auth-password');
const authSubmitBtn = document.getElementById('auth-submit-btn');
const authToggleLink = document.getElementById('auth-toggle-link');
const authToggleContainer = document.getElementById('auth-toggle-container');
const authErrorMsg = document.getElementById('auth-error-msg');

const leaderboardModal = document.getElementById('leaderboard-modal');
const leaderboardBtn = document.getElementById('leaderboard-btn');
const leaderboardModalClose = document.getElementById('leaderboard-modal-close');
const leaderboardTabs = document.querySelectorAll('.leaderboard-tab');
const leaderboardItems = document.getElementById('leaderboard-items');

const toastContainer = document.getElementById('toast-container');

// App State
let isSignUpMode = false;
let currentLeaderboardGame = 'galaga';

// Toast Notification Helper
export function showToast(message, duration = 3000) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideUpFade 0.3s ease-out reverse forwards';
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, duration);
}

// Render Login / Logout Status in Header
function renderHeader() {
    const currentUser = Auth.getCurrentUser();
    
    if (currentUser) {
        authStatusContainer.innerHTML = `
            <div class="user-status">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                <span>${currentUser.username}</span>
            </div>
            <button class="btn-glass" id="logout-btn">Logout</button>
        `;
        
        // Attach logout listener
        document.getElementById('logout-btn').addEventListener('click', () => {
            Auth.logout();
            showToast("Logged out successfully");
            renderHeader();
        });
    } else {
        authStatusContainer.innerHTML = `
            <button class="btn-glass primary" id="login-btn">Login / Sign Up</button>
        `;
        
        // Attach login modal listener
        document.getElementById('login-btn').addEventListener('click', () => {
            openAuthModal(false);
        });
    }
}

// Auth Modal Actions
function openAuthModal(signup = false) {
    isSignUpMode = signup;
    authErrorMsg.textContent = "";
    authUsernameInput.value = "";
    authPasswordInput.value = "";
    
    if (isSignUpMode) {
        authModalTitle.textContent = "Create Account";
        authSubmitBtn.textContent = "Sign Up";
        authToggleContainer.innerHTML = `Already have an account? <a href="#" id="auth-toggle-link">Sign In</a>`;
    } else {
        authModalTitle.textContent = "Sign In";
        authSubmitBtn.textContent = "Sign In";
        authToggleContainer.innerHTML = `Don't have an account? <a href="#" id="auth-toggle-link">Sign Up</a>`;
    }
    
    // Re-bind dynamic toggle link
    document.getElementById('auth-toggle-link').addEventListener('click', (e) => {
        e.preventDefault();
        openAuthModal(!isSignUpMode);
    });
    
    authModal.classList.add('active');
}

function closeAuthModal() {
    authModal.classList.remove('active');
}

// Leaderboard Rendering
function renderLeaderboard(gameId) {
    leaderboardItems.innerHTML = '';
    const scores = Leaderboard.getLeaderboard(gameId);
    
    if (scores.length === 0) {
        leaderboardItems.innerHTML = `<li class="leaderboard-empty">No high scores yet. Be the first!</li>`;
        return;
    }
    
    scores.forEach((entry, index) => {
        const item = document.createElement('li');
        item.className = 'leaderboard-item';
        
        // Format rank display
        let rankBadge = index + 1;
        if (index === 0) rankBadge = '🥇';
        else if (index === 1) rankBadge = '🥈';
        else if (index === 2) rankBadge = '🥉';
        
        // Format score value
        let formattedScore = entry.score;
        if (gameId === 'hangman') {
            formattedScore = `${entry.score} pts`;
        } else if (gameId === 'connect4') {
            formattedScore = `${entry.score} wins`;
        }
        
        item.innerHTML = `
            <div class="leaderboard-rank-name">
                <span class="leaderboard-rank">${rankBadge}</span>
                <span class="leaderboard-name">${entry.username}</span>
            </div>
            <span class="leaderboard-score">${formattedScore}</span>
        `;
        leaderboardItems.appendChild(item);
    });
}

function openLeaderboardModal() {
    renderLeaderboard(currentLeaderboardGame);
    leaderboardModal.classList.add('active');
}

function closeLeaderboardModal() {
    leaderboardModal.classList.remove('active');
}

// Event Listeners Setup
function setupEventListeners() {
    // Logo Click Reloads Homepage
    logoBtn.addEventListener('click', () => {
        window.location.reload();
    });

    // Close Auth Modal
    authModalClose.addEventListener('click', closeAuthModal);
    authModal.addEventListener('click', (e) => {
        if (e.target === authModal) closeAuthModal();
    });

    // Handle Form Submit
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        authErrorMsg.textContent = "";
        
        const username = authUsernameInput.value;
        const password = authPasswordInput.value;
        
        authSubmitBtn.disabled = true;
        authSubmitBtn.textContent = isSignUpMode ? "Registering..." : "Signing In...";
        
        try {
            if (isSignUpMode) {
                await Auth.register(username, password);
                showToast("Account created! Please sign in.");
                openAuthModal(false); // Switch to login
            } else {
                const res = await Auth.login(username, password);
                showToast(`Welcome back, ${res.username}!`);
                closeAuthModal();
                renderHeader();
            }
        } catch (err) {
            authErrorMsg.textContent = err.message || "An error occurred.";
        } finally {
            authSubmitBtn.disabled = false;
            authSubmitBtn.textContent = isSignUpMode ? "Sign Up" : "Sign In";
        }
    });

    // Leaderboard Controls
    leaderboardBtn.addEventListener('click', openLeaderboardModal);
    leaderboardModalClose.addEventListener('click', closeLeaderboardModal);
    leaderboardModal.addEventListener('click', (e) => {
        if (e.target === leaderboardModal) closeLeaderboardModal();
    });

    // Leaderboard Tabs
    leaderboardTabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            leaderboardTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            currentLeaderboardGame = tab.dataset.game;
            renderLeaderboard(currentLeaderboardGame);
        });
    });
}

// Initialize Application
function init() {
    renderHeader();
    setupEventListeners();
    
    // Check if redirecting back from a game to show alert/message
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('registered')) {
        showToast("Registration successful!");
    }
    if (urlParams.has('game_score')) {
        const game = urlParams.get('game');
        const score = urlParams.get('game_score');
        showToast(`Finished playing ${game}! Final score: ${score}`);
        
        // Open leaderboards immediately to show score
        currentLeaderboardGame = game;
        leaderboardTabs.forEach(t => {
            if (t.dataset.game === game) t.classList.add('active');
            else t.classList.remove('active');
        });
        openLeaderboardModal();
    }
}

document.addEventListener('DOMContentLoaded', init);
export { Auth, Leaderboard };
