/**
 * leaderboard.js
 * Manages game high scores in localStorage
 * Integrates with auth.js to authenticate submittals
 */

import { Auth } from './auth.js';

// Retrieve full leaderboard object
function getLeaderboardsData() {
    return JSON.parse(localStorage.getItem('arcade_leaderboards') || '{}');
}

// Save full leaderboard object
function saveLeaderboardsData(data) {
    localStorage.setItem('arcade_leaderboards', JSON.stringify(data));
}

// Seed default mock scores for visual completeness if empty
function seedLeaderboardIfEmpty(gameId) {
    const data = getLeaderboardsData();
    if (data[gameId] && data[gameId].length > 0) return;
    
    const defaultScores = {
        galaga: [
            { username: "SolarSurfer", score: 8500, date: new Date(Date.now() - 86400000 * 3).toISOString() },
            { username: "CosmicZen", score: 5200, date: new Date(Date.now() - 86400000 * 2).toISOString() },
            { username: "StarChaser", score: 3100, date: new Date(Date.now() - 86400000 * 1).toISOString() }
        ],
        hangman: [
            { username: "WordSmith", score: 120, date: new Date(Date.now() - 86400000 * 4).toISOString() },
            { username: "BreezeWalker", score: 80, date: new Date(Date.now() - 86400000 * 2).toISOString() },
            { username: "LotusGuesser", score: 50, date: new Date(Date.now() - 86400000 * 1).toISOString() }
        ],
        connect4: [
            { username: "GridMaster", score: 15, date: new Date(Date.now() - 86400000 * 3).toISOString() },
            { username: "SoftDrop", score: 9, date: new Date(Date.now() - 86400000 * 1).toISOString() }
        ]
    };
    
    data[gameId] = defaultScores[gameId] || [];
    saveLeaderboardsData(data);
}

export const Leaderboard = {
    /**
     * Get the leaderboard for a specific game
     * @param {string} gameId 
     * @returns {Array} Array of score objects
     */
    getLeaderboard(gameId) {
        seedLeaderboardIfEmpty(gameId);
        const data = getLeaderboardsData();
        return data[gameId] || [];
    },

    /**
     * Submit a score to the leaderboard. Requires JWT authentication.
     * @param {string} gameId 
     * @param {number} score 
     * @returns {Promise<object>} Status report
     */
    async submitScore(gameId, score) {
        // Simulate network latency
        await new Promise(resolve => setTimeout(resolve, 200));
        
        const currentUser = Auth.getCurrentUser();
        if (!currentUser) {
            throw new Error("You must be logged in to submit high scores.");
        }
        
        // Fetch existing data
        const data = getLeaderboardsData();
        if (!data[gameId]) {
            data[gameId] = [];
        }
        
        // Check if user already has a score on this board and update it if higher
        const userScoreIndex = data[gameId].findIndex(entry => entry.username === currentUser.username);
        
        const newEntry = {
            username: currentUser.username,
            score: Number(score),
            date: new Date().toISOString()
        };
        
        if (userScoreIndex !== -1) {
            // Update only if new score is higher
            if (score > data[gameId][userScoreIndex].score) {
                data[gameId][userScoreIndex] = newEntry;
            }
        } else {
            // Add new entry
            data[gameId].push(newEntry);
        }
        
        // Sort descending by score
        data[gameId].sort((a, b) => b.score - a.score);
        
        // Keep only top 10 scores
        data[gameId] = data[gameId].slice(0, 10);
        
        saveLeaderboardsData(data);
        
        return { 
            success: true, 
            message: "Score submitted successfully!",
            leaderboard: data[gameId]
        };
    }
};
