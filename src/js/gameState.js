import { CONFIG } from './config.js';

// Room definitions
export const rooms = {
    center: { 
        x: 0, y: 0, 
        width: CONFIG.ROOM_SIZE, height: CONFIG.ROOM_SIZE,
        connections: {
            player1_zone: { x: 0, y: -CONFIG.ROOM_SIZE/2, width: CONFIG.TUNNEL_WIDTH, height: CONFIG.TUNNEL_WIDTH },
            player2_zone: { x: CONFIG.ROOM_SIZE/2, y: 0, width: CONFIG.TUNNEL_WIDTH, height: CONFIG.TUNNEL_WIDTH },
            player3_zone: { x: -CONFIG.ROOM_SIZE/2, y: 0, width: CONFIG.TUNNEL_WIDTH, height: CONFIG.TUNNEL_WIDTH },
            frantic_zone: { x: 0, y: CONFIG.ROOM_SIZE/2, width: CONFIG.TUNNEL_WIDTH, height: CONFIG.TUNNEL_WIDTH }
        },
        color: '#00ff44',
        type: 'center'
    },
    player1_zone: { 
        x: 0, y: -CONFIG.ROOM_SIZE * CONFIG.ROOM_SPACING, 
        width: CONFIG.ROOM_SIZE, height: CONFIG.ROOM_SIZE,
        connections: {
            center: { x: 0, y: CONFIG.ROOM_SIZE/2, width: CONFIG.TUNNEL_WIDTH, height: CONFIG.TUNNEL_WIDTH }
        },
        color: '#44ff44',
        type: 'defensive',
        owner: 1,
        goalColor: '#ff0080',
        goals: [{ x: 0, y: -CONFIG.ROOM_SIZE/2 + 2, direction: 'top', owner: 1 }]
    },
    player2_zone: { 
        x: CONFIG.ROOM_SIZE * CONFIG.ROOM_SPACING, y: 0, 
        width: CONFIG.ROOM_SIZE, height: CONFIG.ROOM_SIZE,
        connections: {
            center: { x: -CONFIG.ROOM_SIZE/2, y: 0, width: CONFIG.TUNNEL_WIDTH, height: CONFIG.TUNNEL_WIDTH }
        },
        color: '#00ff00',
        type: 'defensive',
        owner: 2,
        goalColor: '#80ff00',
        goals: [{ x: CONFIG.ROOM_SIZE/2 - 2, y: 0, direction: 'right', owner: 2 }]
    },
    player3_zone: { 
        x: -CONFIG.ROOM_SIZE * CONFIG.ROOM_SPACING, y: 0, 
        width: CONFIG.ROOM_SIZE, height: CONFIG.ROOM_SIZE,
        connections: {
            center: { x: CONFIG.ROOM_SIZE/2, y: 0, width: CONFIG.TUNNEL_WIDTH, height: CONFIG.TUNNEL_WIDTH }
        },
        color: '#44ff00',
        type: 'defensive',
        owner: 3,
        goalColor: '#ff8000',
        goals: [{ x: -CONFIG.ROOM_SIZE/2 + 2, y: 0, direction: 'left', owner: 3 }]
    },
    frantic_zone: { 
        x: 0, y: CONFIG.ROOM_SIZE * CONFIG.ROOM_SPACING, 
        width: CONFIG.ROOM_SIZE, height: CONFIG.ROOM_SIZE,
        connections: {
            center: { x: 0, y: -CONFIG.ROOM_SIZE/2, width: CONFIG.TUNNEL_WIDTH, height: CONFIG.TUNNEL_WIDTH }
        },
        color: '#22ff22',
        type: 'frantic',
        goals: [
            { x: -CONFIG.ROOM_SIZE/2, y: 0, direction: 'left', owner: 1 },
            { x: CONFIG.ROOM_SIZE/2, y: 0, direction: 'right', owner: 2 },
            { x: 0, y: CONFIG.ROOM_SIZE/2 - 2, direction: 'bottom', owner: 3 }
        ]
    }
};

// Game state
export const gameState = {
    gameTime: 0,
    isPaused: false,
    camera: { x: 0, y: 0 },
    puck: { 
        x: 0, y: 0, 
        vx: 0, vy: 0, 
        currentRoom: 'center',
        trail: []
    },
    playerScores: { 1: 0, 2: 0, 3: 0 },
    playerTypes: { 1: 'human', 2: 'ai', 3: 'ai' },
    playerColors: { 1: '#ff0080', 2: '#80ff00', 3: '#ff8000' },
    playerCharacters: {
        1: {},
        2: {},
        3: {}
    },
    kickCooldowns: { 1: 0, 2: 0, 3: 0 },
    keys: {},
    bounceEffects: [],
    currentRoom: 'center',
    aiState: {
        1: { lastDecision: 0, target: null, strategy: 'follow', stuckCounter: 0, lastPos: {x: 0, y: 0} },
        2: { lastDecision: 0, target: null, strategy: 'follow', stuckCounter: 0, lastPos: {x: 0, y: 0} },
        3: { lastDecision: 0, target: null, strategy: 'follow', stuckCounter: 0, lastPos: {x: 0, y: 0} }
    },
    portalTransition: {
        active: false,
        progress: 0,
        duration: CONFIG.PORTAL_TRANSITION_DURATION,
        fromPos: { x: 0, y: 0 },
        toPos: { x: 0, y: 0 },
        cooldown: 0
    },
    powerUps: {
        spawned: [],
        playerEffects: {
            1: { magnet: 0, speed: 0, shield: 0, slowdown: 0 },
            2: { magnet: 0, speed: 0, shield: 0, slowdown: 0 },
            3: { magnet: 0, speed: 0, shield: 0, slowdown: 0 }
        },
        globalEffects: { slowdown: 0 }
    },
    faceOff: {
        active: false,
        countdown: 0,
        room: 'center',
        position: { x: 0, y: 0 }
    },
    puckStuck: {
        position: { x: 0, y: 0 },
        timer: 0,
        threshold: 5,
        timeLimit: 180
    }
};

// Add missing properties to gameState
gameState.gameStarted = false;
gameState.humanPlayers = 1;
gameState.aiPlayers = 2;
gameState.aiDifficulty = 'medium';

// Game configuration
export const gameConfig = {
    humanPlayers: 1,
    aiPlayers: 2,
    aiDifficulty: 'medium',
    gameStarted: false
};

// Initialize character positions for all rooms
export function initializeCharacterPositions() {
    const ROOM_SIZE = CONFIG.ROOM_SIZE;
    const ROOM_SPACING = CONFIG.ROOM_SPACING;
    
    // Player 1 positions
    gameState.playerCharacters[1] = {
        center: { x: -100, y: -100, active: false, vx: 0, vy: 0, momentum: { x: 0, y: 0 } },
        player1_zone: { x: 0, y: -ROOM_SIZE * ROOM_SPACING - 100, active: false, vx: 0, vy: 0, momentum: { x: 0, y: 0 } },
        player2_zone: { x: ROOM_SIZE * ROOM_SPACING + 100, y: -100, active: false, vx: 0, vy: 0, momentum: { x: 0, y: 0 } },
        player3_zone: { x: -ROOM_SIZE * ROOM_SPACING - 100, y: -100, active: false, vx: 0, vy: 0, momentum: { x: 0, y: 0 } },
        frantic_zone: { x: -100, y: ROOM_SIZE * ROOM_SPACING + 100, active: false, vx: 0, vy: 0, momentum: { x: 0, y: 0 } }
    };
    
    // Player 2 positions
    gameState.playerCharacters[2] = {
        center: { x: 0, y: 0, active: false, vx: 0, vy: 0, momentum: { x: 0, y: 0 } },
        player1_zone: { x: 0, y: -ROOM_SIZE * ROOM_SPACING, active: false, vx: 0, vy: 0, momentum: { x: 0, y: 0 } },
        player2_zone: { x: ROOM_SIZE * ROOM_SPACING, y: 0, active: false, vx: 0, vy: 0, momentum: { x: 0, y: 0 } },
        player3_zone: { x: -ROOM_SIZE * ROOM_SPACING, y: 0, active: false, vx: 0, vy: 0, momentum: { x: 0, y: 0 } },
        frantic_zone: { x: 0, y: ROOM_SIZE * ROOM_SPACING, active: false, vx: 0, vy: 0, momentum: { x: 0, y: 0 } }
    };
    
    // Player 3 positions
    gameState.playerCharacters[3] = {
        center: { x: 100, y: 100, active: false, vx: 0, vy: 0, momentum: { x: 0, y: 0 } },
        player1_zone: { x: 100, y: -ROOM_SIZE * ROOM_SPACING + 100, active: false, vx: 0, vy: 0, momentum: { x: 0, y: 0 } },
        player2_zone: { x: ROOM_SIZE * ROOM_SPACING - 100, y: 100, active: false, vx: 0, vy: 0, momentum: { x: 0, y: 0 } },
        player3_zone: { x: -ROOM_SIZE * ROOM_SPACING + 100, y: 100, active: false, vx: 0, vy: 0, momentum: { x: 0, y: 0 } },
        frantic_zone: { x: 100, y: ROOM_SIZE * ROOM_SPACING - 100, active: false, vx: 0, vy: 0, momentum: { x: 0, y: 0 } }
    };
}