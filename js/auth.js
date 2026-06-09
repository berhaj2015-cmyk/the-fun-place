/**
 * auth.js
 * Client-side JSON Web Token (JWT) Mock Authentication System
 * Persists users in localStorage and simulates JWT issuance & validation
 */

const JWT_SECRET = "relaxing_sunset_secret_key_12345";

// Base64URL Encoding helper
function base64UrlEncode(str) {
    const base64 = btoa(unescape(encodeURIComponent(str)));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Base64URL Decoding helper
function base64UrlDecode(str) {
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
        base64 += '=';
    }
    return decodeURIComponent(escape(atob(base64)));
}

// Simulates HMAC-SHA256 signature using a deterministic hashing algorithm
function calculateSignature(message, secret) {
    let hash = 0;
    const combined = message + secret;
    for (let i = 0; i < combined.length; i++) {
        const char = combined.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash |= 0; // Convert to 32bit integer
    }
    // Convert to hex-like string and base64Url encode it
    const hexHash = Math.abs(hash).toString(16) + (hash < 0 ? 'n' : 'p');
    return base64UrlEncode(hexHash);
}

/**
 * Generate a JWT token for a user
 * @param {object} payload 
 * @returns {string} JWT Token
 */
function generateJWT(payload) {
    const header = {
        alg: "HS256",
        typ: "JWT"
    };
    
    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(payload));
    const signature = calculateSignature(`${encodedHeader}.${encodedPayload}`, JWT_SECRET);
    
    return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Verify JWT token signature and expiration
 * @param {string} token 
 * @returns {object|null} Decoded payload if valid, else null
 */
function verifyJWT(token) {
    if (!token) return null;
    
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const [encodedHeader, encodedPayload, signature] = parts;
    const computedSignature = calculateSignature(`${encodedHeader}.${encodedPayload}`, JWT_SECRET);
    
    if (signature !== computedSignature) {
        console.warn("JWT Verification Failed: Invalid Signature");
        return null;
    }
    
    try {
        const payload = JSON.parse(base64UrlDecode(encodedPayload));
        
        // Check expiration
        const nowInSeconds = Math.floor(Date.now() / 1000);
        if (payload.exp && nowInSeconds > payload.exp) {
            console.warn("JWT Verification Failed: Token Expired");
            return null;
        }
        
        return payload;
    } catch (e) {
        console.error("Error decoding JWT payload", e);
        return null;
    }
}

// User Registry in localStorage
function getUsers() {
    return JSON.parse(localStorage.getItem('arcade_users') || '[]');
}

function saveUsers(users) {
    localStorage.setItem('arcade_users', JSON.stringify(users));
}

// Authentication API Interface
export const Auth = {
    /**
     * Register a new user
     * @param {string} username 
     * @param {string} password 
     * @returns {Promise<object>}
     */
    async register(username, password) {
        // Simulate network latency
        await new Promise(resolve => setTimeout(resolve, 300));
        
        const cleanUsername = username.trim();
        if (cleanUsername.length < 3) {
            throw new Error("Username must be at least 3 characters long.");
        }
        if (password.length < 6) {
            throw new Error("Password must be at least 6 characters long.");
        }
        
        const users = getUsers();
        const exists = users.find(u => u.username.toLowerCase() === cleanUsername.toLowerCase());
        
        if (exists) {
            throw new Error("Username is already taken.");
        }
        
        // Simple hash simulation (reverse string + length, in real life use bcrypt/argon2)
        // Since we verify locally, we store user with username and simulated hashed password
        const hashedPassword = btoa(password).split('').reverse().join('');
        
        const newUser = {
            id: 'usr_' + Math.random().toString(36).substr(2, 9),
            username: cleanUsername,
            passwordHash: hashedPassword,
            createdAt: new Date().toISOString()
        };
        
        users.push(newUser);
        saveUsers(users);
        
        return { success: true, message: "User registered successfully!" };
    },

    /**
     * Login a user
     * @param {string} username 
     * @param {string} password 
     * @returns {Promise<object>} Token and user info
     */
    async login(username, password) {
        // Simulate network latency
        await new Promise(resolve => setTimeout(resolve, 300));
        
        const cleanUsername = username.trim();
        const users = getUsers();
        const user = users.find(u => u.username.toLowerCase() === cleanUsername.toLowerCase());
        
        if (!user) {
            throw new Error("Invalid username or password.");
        }
        
        const hashedPassword = btoa(password).split('').reverse().join('');
        if (user.passwordHash !== hashedPassword) {
            throw new Error("Invalid username or password.");
        }
        
        // Generate JWT Token valid for 24 hours
        const exp = Math.floor(Date.now() / 1000) + (24 * 60 * 60);
        const token = generateJWT({
            userId: user.id,
            username: user.username,
            exp: exp
        });
        
        // Set active session token in localStorage
        localStorage.setItem('arcade_session_token', token);
        
        return {
            success: true,
            token,
            username: user.username
        };
    },

    /**
     * Logout active session
     */
    logout() {
        localStorage.removeItem('arcade_session_token');
    },

    /**
     * Get active logged in user from localStorage JWT token
     * @returns {object|null} Active user profile or null
     */
    getCurrentUser() {
        const token = localStorage.getItem('arcade_session_token');
        if (!token) return null;
        
        const payload = verifyJWT(token);
        if (!payload) {
            // Token is invalid or expired, clean up
            this.logout();
            return null;
        }
        
        return {
            userId: payload.userId,
            username: payload.username,
            token: token
        };
    },

    /**
     * Validate JWT Token directly (useful for tests)
     * @param {string} token 
     * @returns {object|null}
     */
    validateToken(token) {
        return verifyJWT(token);
    }
};
