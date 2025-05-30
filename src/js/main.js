import { CONFIG } from './config.js';
import { gameState, rooms } from './gameState.js';
import { 
    updatePuck, 
    updatePortalTransition, 
    constrainCharacterToRoom, 
    checkGoals, 
    tryKick, 
    updateCooldowns,
    updateBounceEffects,
    createBounceEffect,
    checkPuckStuck
} from './physics.js';
import { initAI, updateAI } from './ai.js';
import { spawnPowerUp, updatePowerUps, updatePowerUpDisplay } from './powerups.js';
import { startFaceOff, updateFaceOff } from './faceoff.js';
import { initInput, updatePlayerMovement } from './input.js';
import { initCanvas, render } from './rendering.js';

let canvas, ctx;

// Initialize game
export function init() {
    // Reset puck
    gameState.puck.x = 0;
    gameState.puck.y = 0;
    gameState.puck.vx = 0;
    gameState.puck.vy = 0;
    gameState.puck.currentRoom = 'center';
    gameState.puck.trail = [];
    
    // Initialize character positions
    initializeCharacterPositions();
    
    gameState.currentRoom = 'center';
    updateActiveCharacters();
    updateRoomIndicator();
    updatePuckDisplay();
    
    // Initialize AI
    initAI();
    
    // Start with face-off in center
    startFaceOff('center');
}

function initializeCharacterPositions() {
    const ROOM_SPACING = CONFIG.ROOM_SPACING;
    const ROOM_SIZE = CONFIG.ROOM_SIZE;
    
    // Reset character positions - adjusted for new room spacing (with Z-coordinates)
    gameState.playerCharacters[1].center = { x: -100, y: -100, z: 8, active: false, vx: 0, vy: 0 };
    gameState.playerCharacters[1].player1_zone = { x: 0, y: -ROOM_SIZE * ROOM_SPACING - 100, z: 8, active: false, vx: 0, vy: 0 };
    gameState.playerCharacters[1].player2_zone = { x: ROOM_SIZE * ROOM_SPACING + 100, y: -100, z: 8, active: false, vx: 0, vy: 0 };
    gameState.playerCharacters[1].player3_zone = { x: -ROOM_SIZE * ROOM_SPACING - 100, y: -100, z: 8, active: false, vx: 0, vy: 0 };
    gameState.playerCharacters[1].frantic_zone = { x: -100, y: ROOM_SIZE * ROOM_SPACING + 100, z: 8, active: false, vx: 0, vy: 0 };
    
    gameState.playerCharacters[2].center = { x: 0, y: 0, z: 8, active: false, vx: 0, vy: 0 };
    gameState.playerCharacters[2].player1_zone = { x: 0, y: -ROOM_SIZE * ROOM_SPACING, z: 8, active: false, vx: 0, vy: 0 };
    gameState.playerCharacters[2].player2_zone = { x: ROOM_SIZE * ROOM_SPACING, y: 0, z: 8, active: false, vx: 0, vy: 0 };
    gameState.playerCharacters[2].player3_zone = { x: -ROOM_SIZE * ROOM_SPACING, y: 0, z: 8, active: false, vx: 0, vy: 0 };
    gameState.playerCharacters[2].frantic_zone = { x: 0, y: ROOM_SIZE * ROOM_SPACING, z: 8, active: false, vx: 0, vy: 0 };
    
    gameState.playerCharacters[3].center = { x: 100, y: 100, z: 8, active: false, vx: 0, vy: 0 };
    gameState.playerCharacters[3].player1_zone = { x: 100, y: -ROOM_SIZE * ROOM_SPACING + 100, z: 8, active: false, vx: 0, vy: 0 };
    gameState.playerCharacters[3].player2_zone = { x: ROOM_SIZE * ROOM_SPACING - 100, y: 100, z: 8, active: false, vx: 0, vy: 0 };
    gameState.playerCharacters[3].player3_zone = { x: -ROOM_SIZE * ROOM_SPACING + 100, y: 100, z: 8, active: false, vx: 0, vy: 0 };
    gameState.playerCharacters[3].frantic_zone = { x: 100, y: ROOM_SIZE * ROOM_SPACING - 100, z: 8, active: false, vx: 0, vy: 0 };
}

// Update which characters are active based on puck location
export function updateActiveCharacters() {
    const currentRoom = gameState.puck.currentRoom;
    
    // Deactivate all characters first
    for (let playerId = 1; playerId <= 3; playerId++) {
        for (let roomName in gameState.playerCharacters[playerId]) {
            gameState.playerCharacters[playerId][roomName].active = false;
        }
    }
    
    // Activate characters in the current room
    for (let playerId = 1; playerId <= 3; playerId++) {
        if (gameState.playerCharacters[playerId][currentRoom]) {
            gameState.playerCharacters[playerId][currentRoom].active = true;
        }
    }
    
    updateActivePlayerDisplay();
}

function updatePuckDisplay() {
    const puckX = Math.round(gameState.puck.x);
    const puckY = Math.round(gameState.puck.y);
    document.getElementById('puckPosition').textContent = `${puckX},${puckY}`;
}

function updateActivePlayerDisplay() {
    const currentRoom = gameState.puck.currentRoom;
    const roomNames = {
        center: 'Center',
        player1_zone: 'Player 1 Zone',
        player2_zone: 'Player 2 Zone', 
        player3_zone: 'Player 3 Zone',
        frantic_zone: 'FRANTIC ZONE!'
    };
    document.getElementById('activePlayers').textContent = roomNames[currentRoom] || currentRoom;
}

export function updateRoomIndicator() {
    const roomNames = {
        center: 'Center',
        player1_zone: 'Player 1 Zone',
        player2_zone: 'Player 2 Zone', 
        player3_zone: 'Player 3 Zone',
        frantic_zone: 'FRANTIC ZONE!'
    };
    document.getElementById('currentRoom').textContent = roomNames[gameState.currentRoom] || gameState.currentRoom;
}

export function updateScoreDisplay() {
    document.getElementById('score1').textContent = gameState.playerScores[1];
    document.getElementById('score2').textContent = gameState.playerScores[2];
    document.getElementById('score3').textContent = gameState.playerScores[3];
}

// Update game logic
function update() {
    if (!gameState.gameStarted || gameState.isPaused) return;
    
    gameState.gameTime++;
    
    // Update face-off if active
    updateFaceOff();
    
    // Update cooldowns and effects
    updateCooldowns();
    updateBounceEffects();
    
    // Update portal transition
    updatePortalTransition();
    
    // Update power-ups
    spawnPowerUp();
    updatePowerUps();
    updatePowerUpDisplay();
    
    // Move characters (human input + AI) - skip during face-off
    if (!gameState.faceOff.active) {
        const baseSpeed = CONFIG.PLAYER_SPEED;
        
        // Update each player
        for (let playerId = 1; playerId <= 3; playerId++) {
            if (gameState.playerTypes[playerId] === 'human') {
                updateHumanPlayer(playerId, baseSpeed);
            } else {
                updateAI(playerId);
            }
        }
    }
    
    // Update puck physics (skip during portal transition or face-off)
    if (!gameState.portalTransition.active && !gameState.faceOff.active) {
        updatePuck();
        if (checkPuckStuck()) {
            startFaceOff(gameState.puck.currentRoom);
        }
    }
    
    // Update camera
    const targetCameraX = gameState.puck.x - canvas.width / 2;
    const targetCameraY = gameState.puck.y - canvas.height / 2;
    gameState.camera.x += (targetCameraX - gameState.camera.x) * 0.08;
    gameState.camera.y += (targetCameraY - gameState.camera.y) * 0.08;
    
    // Update puck position display
    updatePuckDisplay();
    
    // Check for goals
    checkGoals();
}

function updateHumanPlayer(playerId, baseSpeed) {
    for (let roomName in gameState.playerCharacters[playerId]) {
        const character = gameState.playerCharacters[playerId][roomName];
        if (!character.active) continue;
        
        const { moveX, moveY } = updatePlayerMovement(playerId, gameState.keys);
        
        // Initialize momentum if not exists
        if (character.momentum === undefined) {
            character.momentum = { x: 0, y: 0 };
        }
        
        const speedBoost = gameState.powerUps.playerEffects[playerId].speed > 0 ? 1.5 : 1;
        const slowdownFactor = gameState.powerUps.playerEffects[playerId].slowdown > 0 ? 0.5 : 1;
        const speed = baseSpeed * speedBoost * slowdownFactor;
        
        // Apply acceleration to momentum
        const acceleration = 0.3; // How quickly player accelerates
        const friction = 0.85; // How quickly player slows down
        
        if (moveX !== 0 || moveY !== 0) {
            // Normalize diagonal movement
            const length = Math.sqrt(moveX * moveX + moveY * moveY);
            const targetVx = (moveX / length) * speed;
            const targetVy = (moveY / length) * speed;
            
            // Accelerate toward target velocity
            character.momentum.x += (targetVx - character.momentum.x) * acceleration;
            character.momentum.y += (targetVy - character.momentum.y) * acceleration;
        } else {
            // Apply friction when not moving
            character.momentum.x *= friction;
            character.momentum.y *= friction;
        }
        
        // Apply momentum to position
        character.x += character.momentum.x;
        character.y += character.momentum.y;
        
        // Update visual velocity
        character.vx = character.momentum.x * 0.8;
        character.vy = character.momentum.y * 0.8;
        
        constrainCharacterToRoom(character, roomName);
    }
}

// Menu system
function initMenu() {
    const humanButtons = document.querySelectorAll('[data-humans]');
    const difficultyButtons = document.querySelectorAll('[data-difficulty]');
    const startButton = document.getElementById('startButton');
    
    humanButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            humanButtons.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            gameState.humanPlayers = parseInt(btn.dataset.humans);
            gameState.aiPlayers = 3 - gameState.humanPlayers;
            updatePlayerTypes();
        });
    });
    
    difficultyButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            difficultyButtons.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            gameState.aiDifficulty = btn.dataset.difficulty;
            const displayNames = { easy: 'Dum', medium: 'Meh', hard: 'Genial' };
            document.getElementById('difficultyDisplay').textContent = displayNames[gameState.aiDifficulty];
        });
    });
    
    startButton.addEventListener('click', startGame);
}

function updatePlayerTypes() {
    for (let i = 1; i <= 3; i++) {
        gameState.playerTypes[i] = i <= gameState.humanPlayers ? 'human' : 'ai';
        const aiIndicator = document.getElementById(`ai${i}`);
        aiIndicator.textContent = gameState.playerTypes[i] === 'ai' ? '(AI)' : '';
    }
}

function startGame() {
    gameState.gameStarted = true;
    document.getElementById('startMenu').style.display = 'none';
    updatePlayerTypes();
    init();
}

export function showMenu() {
    gameState.gameStarted = false;
    document.getElementById('startMenu').style.display = 'flex';
}

// Game loop
function gameLoop() {
    update();
    render();
    requestAnimationFrame(gameLoop);
}

// Initialize everything
window.addEventListener('DOMContentLoaded', () => {
    const canvasData = initCanvas();
    canvas = canvasData.canvas;
    ctx = canvasData.ctx;
    
    initMenu();
    initInput();
    updatePlayerTypes();
    gameLoop();
});

// Export functions needed by other modules
window.initGame = init;
window.showGameMenu = showMenu;
window.updateActiveCharacters = updateActiveCharacters;
window.updateRoomIndicator = updateRoomIndicator;
window.updateScoreDisplay = updateScoreDisplay;
window.createBounceEffect = createBounceEffect;
window.startFaceOff = startFaceOff;
window.tryKick = tryKick;