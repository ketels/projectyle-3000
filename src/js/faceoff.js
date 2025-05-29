import { gameState, rooms } from './gameState.js';
import { constrainCharacterToRoom } from './physics.js';

export function startFaceOff(room, customPosition) {
    const targetRoom = room || gameState.puck.currentRoom || 'center';
    const roomData = rooms[targetRoom];
    
    gameState.faceOff.active = true;
    gameState.faceOff.countdown = 180; // 3 seconds
    gameState.faceOff.room = targetRoom;
    gameState.faceOff.position = customPosition || { x: roomData.x, y: roomData.y };
    
    // Place puck at face-off position
    gameState.puck.x = gameState.faceOff.position.x;
    gameState.puck.y = gameState.faceOff.position.y;
    gameState.puck.vx = 0;
    gameState.puck.vy = 0;
    gameState.puck.currentRoom = targetRoom;
    
    // Update current room
    gameState.currentRoom = targetRoom;
    
    // Position players in triangle around puck
    positionPlayersForFaceOff();
}

export function positionPlayersForFaceOff() {
    const faceOffDistance = 150; // Distance from puck
    const room = gameState.faceOff.room;
    
    // Position active characters in equilateral triangle
    for (let playerId = 1; playerId <= 3; playerId++) {
        const character = gameState.playerCharacters[playerId][room];
        if (character) {
            const angle = ((playerId - 1) * 120 - 90) * Math.PI / 180; // -90, 30, 150 degrees
            character.x = gameState.faceOff.position.x + Math.cos(angle) * faceOffDistance;
            character.y = gameState.faceOff.position.y + Math.sin(angle) * faceOffDistance;
            character.vx = 0;
            character.vy = 0;
            if (character.momentum) {
                character.momentum.x = 0;
                character.momentum.y = 0;
            }
            
            // Ensure character is within room bounds
            constrainCharacterToRoom(character, room);
        }
    }
    
    if (window.updateActiveCharacters) window.updateActiveCharacters();
}

export function updateFaceOff() {
    if (!gameState.faceOff.active) return;
    
    gameState.faceOff.countdown--;
    
    // During countdown, prevent all movement and kicks
    if (gameState.faceOff.countdown > 0) {
        // Keep puck frozen
        gameState.puck.vx = 0;
        gameState.puck.vy = 0;
        
        // Keep players at their positions
        if (gameState.faceOff.countdown % 20 === 0) { // Re-position every 20 frames
            positionPlayersForFaceOff();
        }
    } else {
        // Face-off complete, resume normal play
        gameState.faceOff.active = false;
        
        // Make sure active characters are updated properly
        if (window.updateActiveCharacters) window.updateActiveCharacters();
        if (window.updateRoomIndicator) window.updateRoomIndicator();
    }
}