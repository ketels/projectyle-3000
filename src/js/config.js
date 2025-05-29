// Game Configuration
export const CONFIG = {
    // Room settings
    ROOM_SIZE: 1000,
    ROOM_SPACING: 1.5,
    CORNER_RADIUS: 50,
    
    // Object sizes
    PUCK_RADIUS: 10,
    PADDLE_RADIUS: 25,
    GOAL_SIZE: 100,
    TUNNEL_WIDTH: 60,
    
    // Physics settings
    PLAYER_SPEED: 5.5,   // Base player movement speed
    MAX_PUCK_SPEED: 10,  // Maximum puck velocity
    FRICTION: 0.98,      // Puck friction (lower = more friction)
    WALL_BOUNCE: 0.77,   // Wall bounce dampening
    KICK_RANGE: 50,
    KICK_FORCE: 8.5,     // Base kick strength
    
    // Visual settings
    TRAIL_LENGTH: 8,
    BOUNCE_EFFECT_DURATION: 15,
    PORTAL_TRANSITION_DURATION: 400,
    PORTAL_COOLDOWN: 60,
    PORTAL_PUSH_DISTANCE: 80,
    
    // AI settings
    STUCK_THRESHOLD: 30,
    STUCK_RESET: 60,
    ANTI_STUCK_FORCE: 2,
    
    // Power-up settings
    POWERUP_SPAWN_CHANCE: 0.0008,  // Spawn probability per frame
    POWERUP_SIZE: 20,
    POWERUP_LIFETIME: 600,     // 10 seconds before disappearing
    POWERUP_DURATION: {
        magnet: 300,      // 5 seconds
        speed: 300,       // 5 seconds
        slowdown: 300,    // 5 seconds
        shield: 300       // 5 seconds
    }
};

// AI difficulty settings
export const AI_SETTINGS = {
    easy: {
        reactionTime: 25,        // Slower decision making
        accuracy: 0.4,           // Poor aim
        strategy: 0.2,           // Mostly just follows ball
        predictionFrames: 0      // No prediction
    },
    medium: {
        reactionTime: 15,        // Normal decision making
        accuracy: 0.7,           // Decent aim
        strategy: 0.6,           // Some strategic thinking
        predictionFrames: 3      // Short prediction
    },
    hard: {
        reactionTime: 8,         // Quick decision making  
        accuracy: 0.9,           // Excellent aim
        strategy: 0.85,          // Very strategic
        predictionFrames: 6      // Good prediction
    }
};

// Player colors
export const PLAYER_COLORS = {
    1: '#ff0080',
    2: '#80ff00',
    3: '#ff8000'
};

// Power-up types and icons
export const POWERUP_TYPES = {
    magnet: { icon: '🧲', color: '#ff00ff' },
    speed: { icon: '⚡', color: '#ffff00' },
    slowdown: { icon: '🐌', color: '#00ffff' },
    shield: { icon: '🛡️', color: '#00ff00' }
};