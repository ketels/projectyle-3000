import { CONFIG } from './config.js';
import { gameState, rooms } from './gameState.js';
import { distance } from './utils.js';

export function spawnPowerUp() {
    if (Math.random() < CONFIG.POWERUP_SPAWN_CHANCE && gameState.powerUps.spawned.length < 3) {
        const types = ['magnet', 'speed', 'slowdown', 'shield'];
        const type = types[Math.floor(Math.random() * types.length)];
        const room = rooms[gameState.currentRoom];
        
        // Spawn in a random position within the current room
        const x = room.x + (Math.random() - 0.5) * (room.width - 100);
        const y = room.y + (Math.random() - 0.5) * (room.height - 100);
        
        gameState.powerUps.spawned.push({
            type: type,
            x: x,
            y: y,
            room: gameState.currentRoom,
            rotation: 0,
            pulsePhase: 0,
            lifetime: CONFIG.POWERUP_LIFETIME
        });
    }
}

export function updatePowerUps() {
    // Update spawned power-ups and remove expired ones
    for (let i = gameState.powerUps.spawned.length - 1; i >= 0; i--) {
        const powerUp = gameState.powerUps.spawned[i];
        powerUp.rotation += 0.02;
        powerUp.pulsePhase += 0.1;
        powerUp.lifetime--;
        
        // Remove if expired
        if (powerUp.lifetime <= 0) {
            gameState.powerUps.spawned.splice(i, 1);
        }
    }
    
    // Check for power-up collection
    for (let playerId = 1; playerId <= 3; playerId++) {
        const character = getActiveCharacter(playerId);
        if (!character) continue;
        
        for (let i = gameState.powerUps.spawned.length - 1; i >= 0; i--) {
            const powerUp = gameState.powerUps.spawned[i];
            if (powerUp.room === gameState.currentRoom && 
                distance(character, powerUp) < CONFIG.PADDLE_RADIUS + CONFIG.POWERUP_SIZE) {
                
                // Collect power-up
                applyPowerUp(playerId, powerUp.type);
                gameState.powerUps.spawned.splice(i, 1);
            }
        }
    }
    
    // Update active effects durations
    for (let playerId = 1; playerId <= 3; playerId++) {
        const effects = gameState.powerUps.playerEffects[playerId];
        for (let effect in effects) {
            if (effects[effect] > 0) {
                effects[effect]--;
            }
        }
    }
}

export function applyPowerUp(playerId, type) {
    switch (type) {
        case 'magnet':
        case 'speed':
        case 'shield':
            gameState.powerUps.playerEffects[playerId][type] = CONFIG.POWERUP_DURATION[type];
            break;
        case 'slowdown':
            // Slowdown affects opponents, not the player who picks it up
            for (let i = 1; i <= 3; i++) {
                if (i !== playerId) {
                    gameState.powerUps.playerEffects[i].slowdown = CONFIG.POWERUP_DURATION.slowdown;
                }
            }
            break;
    }
}

export function updatePowerUpDisplay() {
    const icons = {
        magnet: '🧲',
        speed: '⚡',
        shield: '🛡️'
    };
    
    for (let playerId = 1; playerId <= 3; playerId++) {
        const effects = gameState.powerUps.playerEffects[playerId];
        const element = document.getElementById(`powerup${playerId}`);
        let display = '';
        
        // Check each effect
        for (let effect in effects) {
            if (effects[effect] > 0) {
                const seconds = Math.ceil(effects[effect] / 60);
                display += `${icons[effect] || effect} ${seconds}s `;
            }
        }
        
        // Slowdown is now a player effect
        if (effects.slowdown > 0) {
            const seconds = Math.ceil(effects.slowdown / 60);
            display += `🐌 ${seconds}s `;
        }
        
        element.textContent = display.trim();
    }
}

function getActiveCharacter(playerId) {
    const currentRoom = gameState.puck.currentRoom;
    return gameState.playerCharacters[playerId][currentRoom];
}