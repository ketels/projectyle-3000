import { CONFIG } from './config.js';
import { gameState, rooms } from './gameState.js';
import { distance } from './utils.js';

// Constants
const FRICTION = CONFIG.FRICTION;
const MAX_SPEED = CONFIG.MAX_PUCK_SPEED;
const PUCK_RADIUS = CONFIG.PUCK_RADIUS;
const PADDLE_RADIUS = CONFIG.PADDLE_RADIUS;

// Helper functions
export function isPointInRoom(x, y, roomName) {
    const room = rooms[roomName];
    return Math.abs(x - room.x) <= room.width/2 && 
           Math.abs(y - room.y) <= room.height/2;
}

export function isPointInTunnel(x, y) {
    for (const [roomName, room] of Object.entries(rooms)) {
        for (const [connectionName, tunnel] of Object.entries(room.connections)) {
            const tunnelX = room.x + tunnel.x;
            const tunnelY = room.y + tunnel.y;
            
            if (Math.abs(x - tunnelX) <= tunnel.width/2 && 
                Math.abs(y - tunnelY) <= tunnel.height/2) {
                return true;
            }
        }
    }
    return false;
}

export function constrainCharacterToRoom(character, roomName) {
    const room = rooms[roomName];
    const cornerRadius = CONFIG.CORNER_RADIUS;
    
    const left = room.x - room.width/2 + PADDLE_RADIUS;
    const right = room.x + room.width/2 - PADDLE_RADIUS;
    const top = room.y - room.height/2 + PADDLE_RADIUS;
    const bottom = room.y + room.height/2 - PADDLE_RADIUS;
    
    // First constrain to basic rectangle
    character.x = Math.max(left, Math.min(right, character.x));
    character.y = Math.max(top, Math.min(bottom, character.y));
    
    // Check rounded corners
    const corners = [
        { x: left + cornerRadius, y: top + cornerRadius },    // Top-left
        { x: right - cornerRadius, y: top + cornerRadius },   // Top-right
        { x: left + cornerRadius, y: bottom - cornerRadius },  // Bottom-left
        { x: right - cornerRadius, y: bottom - cornerRadius }  // Bottom-right
    ];
    
    // Check each corner
    for (let i = 0; i < corners.length; i++) {
        const corner = corners[i];
        const inCornerX = (i % 2 === 0) ? character.x < corner.x : character.x > corner.x;
        const inCornerY = (i < 2) ? character.y < corner.y : character.y > corner.y;
        
        if (inCornerX && inCornerY) {
            const dist = distance(character, corner);
            if (dist > cornerRadius) {
                // Push character out of rounded corner
                const angle = Math.atan2(character.y - corner.y, character.x - corner.x);
                character.x = corner.x + Math.cos(angle) * cornerRadius;
                character.y = corner.y + Math.sin(angle) * cornerRadius;
            }
        }
    }
}

export function updatePuck() {
    // Apply friction
    gameState.puck.vx *= FRICTION;
    gameState.puck.vy *= FRICTION;
    
    // Apply gravity to Z-axis
    gameState.puck.vz -= gameState.puck.gravity;
    gameState.puck.z += gameState.puck.vz;
    
    // Bounce on ground (much less bouncy)
    if (gameState.puck.z <= 0) {
        gameState.puck.z = 0;
        gameState.puck.vz *= -0.3; // Much less bounce
        
        // Stop very small bounces
        if (Math.abs(gameState.puck.vz) < 1.0) {
            gameState.puck.vz = 0;
        }
    }
    
    // Limit max speed
    const speed = Math.sqrt(gameState.puck.vx ** 2 + gameState.puck.vy ** 2);
    if (speed > MAX_SPEED) {
        gameState.puck.vx = (gameState.puck.vx / speed) * MAX_SPEED;
        gameState.puck.vy = (gameState.puck.vy / speed) * MAX_SPEED;
    }
    
    // Update trail
    gameState.puck.trail.push({x: gameState.puck.x, y: gameState.puck.y});
    if (gameState.puck.trail.length > CONFIG.TRAIL_LENGTH) {
        gameState.puck.trail.shift();
    }
    
    // Step-wise movement to prevent tunneling through walls
    const steps = Math.ceil(Math.sqrt(gameState.puck.vx ** 2 + gameState.puck.vy ** 2) / PUCK_RADIUS);
    const stepX = gameState.puck.vx / steps;
    const stepY = gameState.puck.vy / steps;
    
    for (let i = 0; i < steps; i++) {
        // Store previous position
        const prevX = gameState.puck.x;
        const prevY = gameState.puck.y;
        
        // Move one step
        gameState.puck.x += stepX;
        gameState.puck.y += stepY;
        
        // Check for wall nudging (very small push when touching walls)
        checkWallNudge();
        
        // Check if we're still in a valid position
        const currentRoom = gameState.puck.currentRoom;
        const room = rooms[currentRoom];
        
        if (room && !isPointInTunnel(gameState.puck.x, gameState.puck.y)) {
            const cornerRadius = CONFIG.CORNER_RADIUS;
            const left = room.x - room.width/2 + PUCK_RADIUS;
            const right = room.x + room.width/2 - PUCK_RADIUS;
            const top = room.y - room.height/2 + PUCK_RADIUS;
            const bottom = room.y + room.height/2 - PUCK_RADIUS;
            
            let hitWall = false;
            
            // Basic rectangular bounds
            if (gameState.puck.x < left || gameState.puck.x > right) {
                gameState.puck.x = prevX;
                gameState.puck.vx *= -CONFIG.WALL_BOUNCE;
                hitWall = true;
            }
            
            if (gameState.puck.y < top || gameState.puck.y > bottom) {
                gameState.puck.y = prevY;
                gameState.puck.vy *= -CONFIG.WALL_BOUNCE;
                hitWall = true;
            }
            
            // Check rounded corners
            if (!hitWall) {
                const corners = [
                    { x: left + cornerRadius, y: top + cornerRadius },    // Top-left
                    { x: right - cornerRadius, y: top + cornerRadius },   // Top-right
                    { x: left + cornerRadius, y: bottom - cornerRadius },  // Bottom-left
                    { x: right - cornerRadius, y: bottom - cornerRadius }  // Bottom-right
                ];
                
                for (let j = 0; j < corners.length; j++) {
                    const corner = corners[j];
                    const inCornerX = (j % 2 === 0) ? gameState.puck.x < corner.x : gameState.puck.x > corner.x;
                    const inCornerY = (j < 2) ? gameState.puck.y < corner.y : gameState.puck.y > corner.y;
                    
                    if (inCornerX && inCornerY) {
                        const dist = distance(gameState.puck, corner);
                        if (dist > cornerRadius) {
                            // Bounce off rounded corner
                            const angle = Math.atan2(gameState.puck.y - corner.y, gameState.puck.x - corner.x);
                            gameState.puck.x = corner.x + Math.cos(angle) * cornerRadius;
                            gameState.puck.y = corner.y + Math.sin(angle) * cornerRadius;
                            
                            // Reflect velocity
                            const normal = { x: Math.cos(angle), y: Math.sin(angle) };
                            const dot = gameState.puck.vx * normal.x + gameState.puck.vy * normal.y;
                            gameState.puck.vx -= 2 * dot * normal.x;
                            gameState.puck.vy -= 2 * dot * normal.y;
                            gameState.puck.vx *= CONFIG.WALL_BOUNCE;
                            gameState.puck.vy *= CONFIG.WALL_BOUNCE;
                            
                            hitWall = true;
                            break;
                        }
                    }
                }
            }
            
            if (hitWall) {
                createBounceEffect(gameState.puck.x, gameState.puck.y);
                break; // Stop moving this frame
            }
        }
    }
    
    // Update puck's current room
    updatePuckRoom();
    
    // Check collisions with ALL characters
    for (let playerId = 1; playerId <= 3; playerId++) {
        for (let roomName in gameState.playerCharacters[playerId]) {
            const character = gameState.playerCharacters[playerId][roomName];
            
            const dx = gameState.puck.x - character.x;
            const dy = gameState.puck.y - character.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // Magnet effect - pull puck closer and match player velocity
            if (character.active && gameState.powerUps.playerEffects[playerId].magnet > 0 && distance < 120) {
                const magnetForce = 0.35;
                const dampingForce = 0.85; // Reduce puck velocity to prevent orbiting
                
                // Pull toward player
                gameState.puck.vx -= (dx / distance) * magnetForce;
                gameState.puck.vy -= (dy / distance) * magnetForce;
                
                // Add player's velocity to puck (so it follows player movement)
                gameState.puck.vx += character.vx * 0.3;
                gameState.puck.vy += character.vy * 0.3;
                
                // Apply damping to reduce excessive speed and orbiting
                gameState.puck.vx *= dampingForce;
                gameState.puck.vy *= dampingForce;
            }
            
            if (distance < PUCK_RADIUS + PADDLE_RADIUS) {
                const force = 0.3;
                const normalX = dx / distance;
                const normalY = dy / distance;
                
                // Softer bounce if magnet is active
                const bounceFactor = gameState.powerUps.playerEffects[playerId].magnet > 0 ? 0.05 : 1;
                
                gameState.puck.vx += normalX * force * bounceFactor;
                gameState.puck.vy += normalY * force * bounceFactor;
                
                const overlap = PUCK_RADIUS + PADDLE_RADIUS - distance;
                gameState.puck.x += normalX * overlap;
                gameState.puck.y += normalY * overlap;
            }
        }
    }
    
    handlePuckBoundaries();
}

export function updatePuckRoom() {
    // Don't update room during portal transition
    if (gameState.portalTransition.active) return;
    
    // Update cooldown
    if (gameState.portalTransition.cooldown > 0) {
        gameState.portalTransition.cooldown--;
    }
    
    gameState.puck.lastRoom = gameState.puck.currentRoom;
    
    // Check if puck is entering a tunnel/portal
    const currentRoom = rooms[gameState.puck.currentRoom];
    if (currentRoom && currentRoom.connections && gameState.portalTransition.cooldown === 0) {
        for (const [targetRoomName, tunnel] of Object.entries(currentRoom.connections)) {
            const tunnelX = currentRoom.x + tunnel.x;
            const tunnelY = currentRoom.y + tunnel.y;
            
            if (Math.abs(gameState.puck.x - tunnelX) <= tunnel.width/2 && 
                Math.abs(gameState.puck.y - tunnelY) <= tunnel.height/2) {
                // Puck entered a portal!
                startPortalTransition(gameState.puck.currentRoom, targetRoomName);
                return;
            }
        }
    }
    
    // Normal room boundary checking
    for (const [roomName, room] of Object.entries(rooms)) {
        if (isPointInRoom(gameState.puck.x, gameState.puck.y, roomName)) {
            if (gameState.puck.currentRoom !== roomName) {
                gameState.puck.currentRoom = roomName;
                gameState.currentRoom = roomName;
                if (window.updateActiveCharacters) window.updateActiveCharacters();
                if (window.updateRoomIndicator) window.updateRoomIndicator();
            }
            return;
        }
    }
    
    if (!isPointInTunnel(gameState.puck.x, gameState.puck.y)) {
        const room = rooms[gameState.puck.lastRoom];
        const left = room.x - room.width/2 + PUCK_RADIUS;
        const right = room.x + room.width/2 - PUCK_RADIUS;
        const top = room.y - room.height/2 + PUCK_RADIUS;
        const bottom = room.y + room.height/2 - PUCK_RADIUS;
        
        gameState.puck.x = Math.max(left, Math.min(right, gameState.puck.x));
        gameState.puck.y = Math.max(top, Math.min(bottom, gameState.puck.y));
    }
}

export function startPortalTransition(fromRoom, toRoom) {
    const targetRoom = rooms[toRoom];
    const sourceRoom = rooms[fromRoom];
    
    // Find the matching tunnel in the target room
    let exitTunnel = null;
    for (const [connName, tunnel] of Object.entries(targetRoom.connections)) {
        if (connName === fromRoom) {
            exitTunnel = tunnel;
            break;
        }
    }
    
    if (!exitTunnel) return;
    
    // Calculate exit position - push puck away from portal to avoid re-entry
    const exitX = targetRoom.x + exitTunnel.x;
    const exitY = targetRoom.y + exitTunnel.y;
    
    // Calculate direction away from portal
    let pushX = 0, pushY = 0;
    const pushDistance = 80; // Distance to push puck from portal
    
    // Determine push direction based on which wall the portal is on
    if (Math.abs(exitTunnel.x) > Math.abs(exitTunnel.y)) {
        // Portal is on left/right wall
        pushX = exitTunnel.x > 0 ? -pushDistance : pushDistance;
    } else {
        // Portal is on top/bottom wall
        pushY = exitTunnel.y > 0 ? -pushDistance : pushDistance;
    }
    
    // Start the transition
    gameState.portalTransition = {
        active: true,
        startTime: Date.now(),
        duration: 400,
        fromRoom: fromRoom,
        toRoom: toRoom,
        fromPos: { x: gameState.puck.x, y: gameState.puck.y },
        toPos: { x: exitX + pushX, y: exitY + pushY },
        cooldown: 0 // Will be set when transition completes
    };
    
    // Preserve velocity direction but reduce magnitude during transition
    gameState.puck.vx *= 0.5;
    gameState.puck.vy *= 0.5;
}

export function updatePortalTransition() {
    if (!gameState.portalTransition.active) return;
    
    const elapsed = Date.now() - gameState.portalTransition.startTime;
    const progress = Math.min(elapsed / gameState.portalTransition.duration, 1);
    
    if (progress >= 1) {
        // Transition complete
        gameState.puck.x = gameState.portalTransition.toPos.x;
        gameState.puck.y = gameState.portalTransition.toPos.y;
        gameState.puck.currentRoom = gameState.portalTransition.toRoom;
        gameState.currentRoom = gameState.portalTransition.toRoom;
        gameState.portalTransition.active = false;
        
        // Set cooldown to prevent immediate re-entry (about 1 second)
        gameState.portalTransition.cooldown = 60;
        
        if (window.updateActiveCharacters) window.updateActiveCharacters();
        if (window.updateRoomIndicator) window.updateRoomIndicator();
    }
}

function checkWallNudge() {
    const currentRoom = gameState.puck.currentRoom;
    const room = rooms[currentRoom];
    if (!room) return;
    
    const cornerRadius = CONFIG.CORNER_RADIUS;
    const left = room.x - room.width/2 + PUCK_RADIUS;
    const right = room.x + room.width/2 - PUCK_RADIUS;
    const top = room.y - room.height/2 + PUCK_RADIUS;
    const bottom = room.y + room.height/2 - PUCK_RADIUS;
    
    // Small nudge away from walls when very close
    const nudgeForce = 1; // 1 pixel push
    
    if (Math.abs(gameState.puck.x - left) < 2 && !isPointInTunnel(gameState.puck.x, gameState.puck.y)) {
        gameState.puck.x += nudgeForce;
    }
    if (Math.abs(gameState.puck.x - right) < 2 && !isPointInTunnel(gameState.puck.x, gameState.puck.y)) {
        gameState.puck.x -= nudgeForce;
    }
    if (Math.abs(gameState.puck.y - top) < 2 && !isPointInTunnel(gameState.puck.x, gameState.puck.y)) {
        gameState.puck.y += nudgeForce;
    }
    if (Math.abs(gameState.puck.y - bottom) < 2 && !isPointInTunnel(gameState.puck.x, gameState.puck.y)) {
        gameState.puck.y -= nudgeForce;
    }
}

function handlePuckBoundaries() {
    for (const [roomName, room] of Object.entries(rooms)) {
        if (isPointInRoom(gameState.puck.x, gameState.puck.y, roomName)) {
            const left = room.x - room.width/2;
            const right = room.x + room.width/2;
            const top = room.y - room.height/2;
            const bottom = room.y + room.height/2;
            
            if (gameState.puck.x - PUCK_RADIUS <= left) {
                if (!hasTunnelAt(room, 'left', gameState.puck.y)) {
                    gameState.puck.vx = Math.abs(gameState.puck.vx) * 0.7;
                    gameState.puck.x = left + PUCK_RADIUS;
                }
            }
            
            if (gameState.puck.x + PUCK_RADIUS >= right) {
                if (!hasTunnelAt(room, 'right', gameState.puck.y)) {
                    gameState.puck.vx = -Math.abs(gameState.puck.vx) * 0.7;
                    gameState.puck.x = right - PUCK_RADIUS;
                }
            }
            
            if (gameState.puck.y - PUCK_RADIUS <= top) {
                if (!hasTunnelAt(room, 'top', gameState.puck.x)) {
                    gameState.puck.vy = Math.abs(gameState.puck.vy) * 0.7;
                    gameState.puck.y = top + PUCK_RADIUS;
                }
            }
            
            if (gameState.puck.y + PUCK_RADIUS >= bottom) {
                if (!hasTunnelAt(room, 'bottom', gameState.puck.x)) {
                    gameState.puck.vy = -Math.abs(gameState.puck.vy) * 0.7;
                    gameState.puck.y = bottom - PUCK_RADIUS;
                }
            }
            
            break;
        }
    }
}

function hasTunnelAt(room, direction, coordinate) {
    if (!room.connections) return false;
    
    for (const [connectionName, tunnel] of Object.entries(room.connections)) {
        const tunnelX = room.x + tunnel.x;
        const tunnelY = room.y + tunnel.y;
        
        switch (direction) {
            case 'left':
            case 'right':
                if (Math.abs(coordinate - tunnelY) <= tunnel.height/2) {
                    return true;
                }
                break;
            case 'top':
            case 'bottom':
                if (Math.abs(coordinate - tunnelX) <= tunnel.width/2) {
                    return true;
                }
                break;
        }
    }
    return false;
}

export function checkGoals() {
    for (const [roomName, room] of Object.entries(rooms)) {
        if (room.goals && isPointInRoom(gameState.puck.x, gameState.puck.y, roomName)) {
            for (const goal of room.goals) {
                let inGoal = false;
                const goalX = room.x + goal.x;
                const goalY = room.y + goal.y;
                
                switch (goal.direction) {
                    case 'top':
                        inGoal = gameState.puck.y <= goalY + 15 && 
                                Math.abs(gameState.puck.x - goalX) <= CONFIG.GOAL_SIZE/2;
                        break;
                    case 'right':
                        inGoal = gameState.puck.x >= goalX - 15 && 
                                Math.abs(gameState.puck.y - goalY) <= CONFIG.GOAL_SIZE/2;
                        break;
                    case 'bottom':
                        inGoal = gameState.puck.y >= goalY - 15 && 
                                Math.abs(gameState.puck.x - goalX) <= CONFIG.GOAL_SIZE/2;
                        break;
                    case 'left':
                        inGoal = gameState.puck.x <= goalX + 15 && 
                                Math.abs(gameState.puck.y - goalY) <= CONFIG.GOAL_SIZE/2;
                        break;
                }
                
                if (inGoal) {
                    // Check if goal is protected by shield
                    if (gameState.powerUps.playerEffects[goal.owner].shield > 0) {
                        // Bounce the puck away instead of scoring
                        gameState.puck.vx *= -1;
                        gameState.puck.vy *= -1;
                        createBounceEffect(goalX, goalY);
                    } else {
                        // Normal scoring
                        for (let playerId = 1; playerId <= 3; playerId++) {
                            if (playerId !== goal.owner) {
                                gameState.playerScores[playerId]++;
                            }
                        }
                        if (window.updateScoreDisplay) window.updateScoreDisplay();
                        
                        setTimeout(() => {
                            if (window.startFaceOff) window.startFaceOff('center');
                        }, 1000);
                    }
                    
                    return;
                }
            }
        }
    }
}

export function tryKick(playerId) {
    // No kicks during face-off
    if (gameState.faceOff.active) return false;
    
    // Check cooldown
    if (gameState.kickCooldowns[playerId] > 0) return false;
    
    const activeCharacter = getActiveCharacter(playerId);
    if (!activeCharacter) return false;
    
    // Check if close enough to puck
    const dist = distance(activeCharacter, gameState.puck);
    if (dist > CONFIG.KICK_RANGE) return false;
    
    // Calculate kick direction (away from player)
    const dx = gameState.puck.x - activeCharacter.x;
    const dy = gameState.puck.y - activeCharacter.y;
    const kickDist = Math.sqrt(dx * dx + dy * dy);
    
    if (kickDist < 5) return false; // Too close, no direction
    
    // Calculate player's speed for variable kick strength
    let playerSpeed = 0;
    if (activeCharacter.momentum) {
        playerSpeed = Math.sqrt(activeCharacter.momentum.x * activeCharacter.momentum.x + 
                              activeCharacter.momentum.y * activeCharacter.momentum.y);
    } else if (activeCharacter.vx !== undefined && activeCharacter.vy !== undefined) {
        // For AI players who don't use momentum system
        playerSpeed = Math.sqrt(activeCharacter.vx * activeCharacter.vx + 
                              activeCharacter.vy * activeCharacter.vy);
    }
    
    // Calculate relative velocity between player and puck
    const relativeVx = activeCharacter.momentum ? activeCharacter.momentum.x : (activeCharacter.vx || 0);
    const relativeVy = activeCharacter.momentum ? activeCharacter.momentum.y : (activeCharacter.vy || 0);
    const relativeDotProduct = (dx * relativeVx + dy * relativeVy) / kickDist;
    
    // Base kick force + bonus based on player speed and direction
    const speedBonus = Math.max(0, relativeDotProduct) * 0.5; // Bonus if moving toward puck
    const kickStrength = 1 + (playerSpeed / CONFIG.PLAYER_SPEED) * 0.5 + speedBonus;
    
    // Apply variable kick force
    const forceX = (dx / kickDist) * CONFIG.KICK_FORCE * kickStrength;
    const forceY = (dy / kickDist) * CONFIG.KICK_FORCE * kickStrength;
    
    gameState.puck.vx += forceX;
    gameState.puck.vy += forceY;
    
    // Add Z-velocity for 3D effect (lift the puck)
    const horizontalForce = Math.sqrt(forceX * forceX + forceY * forceY);
    gameState.puck.vz += horizontalForce * 0.15; // Lift proportional to kick strength
    
    // Set cooldown
    gameState.kickCooldowns[playerId] = 15; // Reduced cooldown for more responsive kicking
    
    // Visual effect - make player glow briefly
    if (activeCharacter) {
        activeCharacter.kickEffect = 10;
        // Stronger kicks get stronger visual effect
        activeCharacter.kickStrength = kickStrength;
    }
    
    return true;
}

function getActiveCharacter(playerId) {
    const currentRoom = gameState.puck.currentRoom;
    return gameState.playerCharacters[playerId][currentRoom];
}

export function updateCooldowns() {
    for (let playerId = 1; playerId <= 3; playerId++) {
        if (gameState.kickCooldowns[playerId] > 0) {
            gameState.kickCooldowns[playerId]--;
        }
    }
    
    // Update kick effects
    for (let playerId = 1; playerId <= 3; playerId++) {
        for (let roomName in gameState.playerCharacters[playerId]) {
            const character = gameState.playerCharacters[playerId][roomName];
            if (character.kickEffect > 0) {
                character.kickEffect--;
            }
        }
    }
}

export function createBounceEffect(x, y) {
    gameState.bounceEffects.push({
        x: x,
        y: y,
        life: 15, // frames to live
        maxLife: 15,
        size: 20
    });
}

export function updateBounceEffects() {
    for (let i = gameState.bounceEffects.length - 1; i >= 0; i--) {
        const effect = gameState.bounceEffects[i];
        effect.life--;
        
        if (effect.life <= 0) {
            gameState.bounceEffects.splice(i, 1);
        }
    }
}

export function checkPuckStuck() {
    const currentPos = { x: gameState.puck.x, y: gameState.puck.y };
    const lastPos = gameState.puckStuck.position;
    const moved = distance(currentPos, lastPos);
    
    if (moved < gameState.puckStuck.threshold) {
        gameState.puckStuck.timer++;
        
        if (gameState.puckStuck.timer >= gameState.puckStuck.timeLimit) {
            // Puck is stuck, start face-off in current room
            // startFaceOff(gameState.puck.currentRoom); // This will be imported from another module
            gameState.puckStuck.timer = 0;
            return true; // Return true to indicate face-off should start
        }
    } else {
        // Puck moved, reset timer
        gameState.puckStuck.timer = 0;
        gameState.puckStuck.position = { x: currentPos.x, y: currentPos.y };
    }
    
    return false;
}