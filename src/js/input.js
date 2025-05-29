import { gameState } from './gameState.js';
import { tryKick } from './physics.js';

export function initInput() {
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
}

function handleKeyDown(e) {
    if (!gameState.gameStarted) return;
    
    gameState.keys[e.key.toLowerCase()] = true;
    
    // Kick controls - mapped to be near movement keys
    if (e.key === ' ' && gameState.playerTypes[1] === 'human') { // Space for Player 1 (arrows)
        e.preventDefault();
        tryKick(1);
    }
    if (e.key === 'Shift' && e.location === 1 && gameState.playerTypes[2] === 'human') { // Left Shift for Player 2 (WASD)
        e.preventDefault();
        tryKick(2);
    }
    if (e.key.toLowerCase() === 'h' && gameState.playerTypes[3] === 'human') { // H for Player 3 (IJKL)
        e.preventDefault();
        tryKick(3);
    }
    
    if (e.key.toLowerCase() === 'r') {
        e.preventDefault();
        if (window.initGame) window.initGame();
    }
    if (e.key === 'Escape') {
        e.preventDefault();
        gameState.isPaused = !gameState.isPaused;
    }
    if (e.key.toLowerCase() === 'm') {
        e.preventDefault();
        if (window.showGameMenu) window.showGameMenu();
    }
}

function handleKeyUp(e) {
    gameState.keys[e.key.toLowerCase()] = false;
}

export function updatePlayerMovement(playerId, keys) {
    const characters = gameState.playerCharacters[playerId];
    
    for (let roomName in characters) {
        const character = characters[roomName];
        if (!character.active) continue;
        
        let moveX = 0, moveY = 0;
        
        // Get movement based on player controls
        switch (playerId) {
            case 1: // Arrow keys
                if (gameState.keys['arrowup']) moveY -= 1;
                if (gameState.keys['arrowdown']) moveY += 1;
                if (gameState.keys['arrowleft']) moveX -= 1;
                if (gameState.keys['arrowright']) moveX += 1;
                break;
            case 2: // WASD
                if (gameState.keys['w']) moveY -= 1;
                if (gameState.keys['s']) moveY += 1;
                if (gameState.keys['a']) moveX -= 1;
                if (gameState.keys['d']) moveX += 1;
                break;
            case 3: // IJKL
                if (gameState.keys['i']) moveY -= 1;
                if (gameState.keys['k']) moveY += 1;
                if (gameState.keys['j']) moveX -= 1;
                if (gameState.keys['l']) moveX += 1;
                break;
        }
        
        return { moveX, moveY };
    }
    
    return { moveX: 0, moveY: 0 };
}