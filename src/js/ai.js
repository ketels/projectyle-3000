import { CONFIG } from './config.js';
import { gameState, rooms } from './gameState.js';
import { distance } from './utils.js';
import { constrainCharacterToRoom } from './physics.js';

// AI difficulty settings
const aiSettings = {
    easy: {
        reactionTime: 30,    // Frames between decisions
        predictionFrames: 5,  // How far ahead to predict
        accuracy: 0.6,        // Shot accuracy
        strategy: 0.3,        // Strategic thinking level
        kickTiming: 0.4       // How well they time kicks
    },
    medium: {
        reactionTime: 15,
        predictionFrames: 15,
        accuracy: 0.8,
        strategy: 0.7,
        kickTiming: 0.7
    },
    hard: {
        reactionTime: 5,
        predictionFrames: 30,
        accuracy: 0.95,
        strategy: 0.95,
        kickTiming: 0.9
    }
};

export function initAI() {
    // Initialize AI state for each player
    for (let playerId = 1; playerId <= 3; playerId++) {
        if (!gameState.aiState[playerId]) {
            gameState.aiState[playerId] = {
                lastDecision: 0,
                target: { x: 0, y: 0 },
                strategy: 'follow',
                stuckCounter: 0,
                lastPos: { x: 0, y: 0 }
            };
        }
    }
}

export function updateAI(playerId) {
    if (gameState.playerTypes[playerId] !== 'ai') return;
    
    const settings = aiSettings[gameState.aiDifficulty || 'medium'];
    const aiState = gameState.aiState[playerId];
    const activeCharacter = getActiveCharacter(playerId);
    if (!activeCharacter) return;
    
    // Make decisions only occasionally (intelligence difference)
    if (gameState.gameTime - aiState.lastDecision >= settings.reactionTime) {
        makeAIDecision(playerId, settings, aiState, activeCharacter);
        aiState.lastDecision = gameState.gameTime;
    }
    
    // But ALWAYS move toward current target every frame (same speed as humans)
    if (aiState.target) {
        moveAITowardTarget(activeCharacter, aiState.target, playerId);
    }
    
    // AI Kicking logic - MORE AGGRESSIVE!
    const distToPuck = distance(activeCharacter, gameState.puck);
    if (distToPuck <= CONFIG.KICK_RANGE && gameState.kickCooldowns[playerId] === 0) {
        // Less strategic delays - kick more often!
        const delayKick = settings.strategy > 0.8 ? shouldDelayKick(playerId, activeCharacter, settings) : false;
        
        if (!delayKick) {
            // Decide whether to kick based on situation
            const shouldKick = shouldAIKick(playerId, activeCharacter, settings);
            if (shouldKick) {
                if (window.tryKick) window.tryKick(playerId);
            }
        }
    }
}

function makeAIDecision(playerId, settings, aiState, activeCharacter) {
    const puckDistance = distance(activeCharacter, gameState.puck);
    const currentRoom = gameState.puck.currentRoom;
    const threatLevel = evaluateThreatLevel(playerId);
    
    // Check for power-up opportunities first (smart AI only)
    const powerUpTarget = shouldGoForPowerUp(playerId, activeCharacter, settings);
    if (powerUpTarget && threatLevel < 0.7) {
        aiState.strategy = 'get_powerup';
        aiState.powerUpTarget = powerUpTarget.box;
    }
    // Enhanced strategy decision based on multiple factors
    else if (Math.random() < settings.strategy) {
        // Smart strategic behavior with threat assessment
        if (threatLevel > 0.8) {
            // High threat - prioritize defense
            aiState.strategy = 'urgent_defend';
        } else if (currentRoom === 'center') {
            // In center room - AGGRESSIVE goal-seeking behavior
            if (puckDistance < 150) {
                // Close to puck - always try to score!
                aiState.strategy = 'push_to_portal';
            } else {
                // Far from puck - aggressively intercept
                aiState.strategy = 'intercept';
            }
        } else if (isMyDefensiveZone(currentRoom, playerId)) {
            // Enhanced defensive decision making
            if (isAloneInDefensiveZone(playerId)) {
                // Alone with only goal - push puck through portal for safety
                aiState.strategy = 'escape_to_portal';
            } else if (puckDistance < 200 && threatLevel > 0.5) {
                aiState.strategy = 'urgent_defend';
            } else if (puckDistance < 150) {
                aiState.strategy = 'clear_puck';
            } else {
                aiState.strategy = 'goalkeeper';
            }
        } else if (puckDistance < 150) {
            // Close to puck - ALWAYS be aggressive!
            const enemyGoal = getBestEnemyGoal(currentRoom, playerId);
            if (enemyGoal) {
                aiState.strategy = 'shoot_on_goal';
            } else {
                // No direct goal available - push toward center to find scoring opportunities
                aiState.strategy = 'attack';
            }
        } else {
            // Far from puck - aggressive intercept, never just "position"
            aiState.strategy = 'intercept';
        }
    } else {
        // Simple AI behavior - just follow the ball
        aiState.strategy = 'follow';
    }
    
    // Set target based on strategy
    setAITarget(playerId, aiState, activeCharacter, settings);
}

function setAITarget(playerId, aiState, activeCharacter, settings) {
    let targetX = activeCharacter.x;
    let targetY = activeCharacter.y;
    
    switch (aiState.strategy) {
        case 'follow':
            // Simple: just go to where ball is now
            targetX = gameState.puck.x;
            targetY = gameState.puck.y;
            break;
            
        case 'intercept':
            // Smart: predict where puck will be
            const prediction = predictPuckPosition(settings.predictionFrames);
            targetX = prediction.x;
            targetY = prediction.y;
            break;
            
        case 'defend':
            const myGoal = getMyGoal(gameState.puck.currentRoom, playerId);
            if (myGoal) {
                // Position between puck and goal
                const dx = gameState.puck.x - myGoal.x;
                const dy = gameState.puck.y - myGoal.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const defensiveDistance = 80;
                
                targetX = myGoal.x + (dx / dist) * defensiveDistance;
                targetY = myGoal.y + (dy / dist) * defensiveDistance;
            }
            break;
            
        case 'attack':
            const enemyGoal = getBestEnemyGoal(gameState.puck.currentRoom, playerId);
            if (enemyGoal) {
                // Smart AI aims better, dumb AI has more spread
                const inaccuracy = (1 - settings.accuracy) * 120;
                targetX = enemyGoal.x + (Math.random() - 0.5) * inaccuracy;
                targetY = enemyGoal.y + (Math.random() - 0.5) * inaccuracy;
            } else {
                // No enemy goal visible, go for ball
                targetX = gameState.puck.x;
                targetY = gameState.puck.y;
            }
            break;
            
        case 'position':
            // No passive positioning - always chase the puck!
            targetX = gameState.puck.x;
            targetY = gameState.puck.y;
            break;
            
        case 'push_to_portal':
            // In center room - find best portal to push puck toward
            const centerRoom = rooms['center'];
            const portals = [];
            
            // Collect all portals except the one leading to our defensive zone
            for (const [targetRoom, tunnel] of Object.entries(centerRoom.connections)) {
                if (targetRoom !== `player${playerId}_zone`) {
                    portals.push({
                        name: targetRoom,
                        x: centerRoom.x + tunnel.x,
                        y: centerRoom.y + tunnel.y,
                        tunnel: tunnel
                    });
                }
            }
            
            // Find the best portal based on AI intelligence
            if (portals.length > 0) {
                let bestPortal;
                
                // ALWAYS prioritize enemy defensive zones for scoring!
                const enemyPortals = portals.filter(p => 
                    p.name.includes('player') && !p.name.includes(`player${playerId}`)
                );
                
                if (enemyPortals.length > 0) {
                    // Choose the closest enemy portal for faster scoring
                    bestPortal = enemyPortals.reduce((closest, portal) => {
                        const distToCurrent = distance(activeCharacter, portal);
                        const distToClosest = distance(activeCharacter, closest);
                        return distToCurrent < distToClosest ? portal : closest;
                    });
                } else {
                    // No enemy portals available, try frantic zone
                    const franticPortal = portals.find(p => p.name === 'frantic_zone');
                    bestPortal = franticPortal || portals[0];
                }
                
                // Position behind puck to push it toward portal
                const puckToPortalX = bestPortal.x - gameState.puck.x;
                const puckToPortalY = bestPortal.y - gameState.puck.y;
                const dist = Math.sqrt(puckToPortalX * puckToPortalX + puckToPortalY * puckToPortalY);
                
                if (dist > 0) {
                    // Get behind the puck relative to the portal
                    targetX = gameState.puck.x - (puckToPortalX / dist) * 50;
                    targetY = gameState.puck.y - (puckToPortalY / dist) * 50;
                }
            }
            break;
            
        case 'get_powerup':
            // Go for power-up
            if (aiState.powerUpTarget) {
                targetX = aiState.powerUpTarget.x;
                targetY = aiState.powerUpTarget.y;
            }
            break;
            
        case 'urgent_defend':
            // Emergency defensive positioning
            const urgentGoal = getMyGoal(gameState.puck.currentRoom, playerId);
            if (urgentGoal) {
                const optimalPos = getOptimalDefensivePosition(playerId, urgentGoal);
                targetX = optimalPos.x;
                targetY = optimalPos.y;
            }
            break;
            
        case 'clear_puck':
            // Get behind puck to clear it away from our goal
            const clearGoal = getMyGoal(gameState.puck.currentRoom, playerId);
            if (clearGoal) {
                const puckToGoalX = clearGoal.x - gameState.puck.x;
                const puckToGoalY = clearGoal.y - gameState.puck.y;
                const dist = Math.sqrt(puckToGoalX * puckToGoalX + puckToGoalY * puckToGoalY);
                
                if (dist > 0) {
                    // Position behind puck relative to our goal
                    targetX = gameState.puck.x - (puckToGoalX / dist) * 40;
                    targetY = gameState.puck.y - (puckToGoalY / dist) * 40;
                }
            }
            break;
            
        case 'shoot_on_goal':
            // Position for optimal shot on enemy goal
            const shootGoal = getBestEnemyGoal(gameState.puck.currentRoom, playerId);
            if (shootGoal) {
                // Get behind puck for a shot
                const puckToGoalX = shootGoal.x - gameState.puck.x;
                const puckToGoalY = shootGoal.y - gameState.puck.y;
                const dist = Math.sqrt(puckToGoalX * puckToGoalX + puckToGoalY * puckToGoalY);
                
                if (dist > 0) {
                    targetX = gameState.puck.x - (puckToGoalX / dist) * 35;
                    targetY = gameState.puck.y - (puckToGoalY / dist) * 35;
                }
            }
            break;
            
        case 'support':
            // Even "support" should be aggressive - go for the puck!
            const supportPrediction = predictPuckPosition(15);
            targetX = supportPrediction.x;
            targetY = supportPrediction.y;
            break;
            
        case 'strategic_position':
            // No passive positioning - always go for intercept!
            const futurePos = predictPuckPosition(20);
            targetX = futurePos.x;
            targetY = futurePos.y;
            break;
            
        case 'goalkeeper':
            // Optimal goalkeeper positioning
            const gkGoal = getMyGoal(gameState.puck.currentRoom, playerId);
            if (gkGoal) {
                const optimalGKPos = getGoalkeeperPosition(playerId, gameState.puck, gkGoal);
                targetX = optimalGKPos.x;
                targetY = optimalGKPos.y;
            }
            break;
            
        case 'escape_to_portal':
            // Push puck through portal when alone in defensive zone
            const escapeRoom = rooms[gameState.puck.currentRoom];
            if (escapeRoom && escapeRoom.connections) {
                // Find the portal (there should only be one in defensive zones)
                const portalEntry = Object.entries(escapeRoom.connections)[0];
                if (portalEntry) {
                    const [portalName, tunnel] = portalEntry;
                    const portalX = escapeRoom.x + tunnel.x;
                    const portalY = escapeRoom.y + tunnel.y;
                    
                    // Get behind puck to push toward portal
                    const puckToPortalX = portalX - gameState.puck.x;
                    const puckToPortalY = portalY - gameState.puck.y;
                    const dist = Math.sqrt(puckToPortalX * puckToPortalX + puckToPortalY * puckToPortalY);
                    
                    if (dist > 0) {
                        targetX = gameState.puck.x - (puckToPortalX / dist) * 40;
                        targetY = gameState.puck.y - (puckToPortalY / dist) * 40;
                    }
                }
            }
            break;
    }
    
    // Store target for continuous movement
    aiState.target = { x: targetX, y: targetY };
}

function moveAITowardTarget(character, target, playerId) {
    const dx = target.x - character.x;
    const dy = target.y - character.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist < 10) {
        // Apply friction when at target
        if (character.momentum) {
            character.momentum.x *= 0.85;
            character.momentum.y *= 0.85;
        }
        return;
    }
    
    // Initialize momentum if not exists
    if (character.momentum === undefined) {
        character.momentum = { x: 0, y: 0 };
    }
    
    const aiState = gameState.aiState[playerId];
    
    // Check if AI is stuck (hasn't moved much)
    const movedDistance = distance(character, aiState.lastPos);
    if (movedDistance < 1) {
        aiState.stuckCounter++;
    } else {
        aiState.stuckCounter = Math.max(0, aiState.stuckCounter - 1);
    }
    
    // EXACT same speed as human players!
    const speedBoost = gameState.powerUps.playerEffects[playerId].speed > 0 ? 1.5 : 1;
    const slowdownFactor = gameState.powerUps.playerEffects[playerId].slowdown > 0 ? 0.5 : 1;
    const speed = CONFIG.PLAYER_SPEED * speedBoost * slowdownFactor;
    
    // Target velocity
    let targetVx = (dx / dist) * speed;
    let targetVy = (dy / dist) * speed;
    
    // Anti-stuck behavior
    if (aiState.stuckCounter > CONFIG.STUCK_THRESHOLD) {
        // Add random movement to escape corners
        const randomAngle = Math.random() * Math.PI * 2;
        const randomForce = CONFIG.ANTI_STUCK_FORCE;
        targetVx += Math.cos(randomAngle) * randomForce;
        targetVy += Math.sin(randomAngle) * randomForce;
        
        // Reset counter after escape attempt
        if (aiState.stuckCounter > CONFIG.STUCK_RESET) {
            aiState.stuckCounter = 0;
        }
    }
    
    // Apply acceleration to momentum (AI uses slightly higher acceleration for responsiveness)
    const acceleration = 0.4;
    character.momentum.x += (targetVx - character.momentum.x) * acceleration;
    character.momentum.y += (targetVy - character.momentum.y) * acceleration;
    
    // Store current position for next frame
    aiState.lastPos = { x: character.x, y: character.y };
    
    // Apply momentum to position
    character.x += character.momentum.x;
    character.y += character.momentum.y;
    
    // Update visual velocity
    character.vx = character.momentum.x * 0.8;
    character.vy = character.momentum.y * 0.8;
    
    // Constrain to current room
    const currentRoom = gameState.puck.currentRoom;
    constrainCharacterToRoom(character, currentRoom);
}

// Helper functions
function getActiveCharacter(playerId) {
    const currentRoom = gameState.puck.currentRoom;
    const character = gameState.playerCharacters[playerId][currentRoom];
    return character && character.active ? character : null;
}

function isMyDefensiveZone(roomName, playerId) {
    return roomName === `player${playerId}_zone`;
}

function getMyGoal(roomName, playerId) {
    const room = rooms[roomName];
    if (!room || !room.goals) return null;
    
    const myGoal = room.goals.find(goal => goal.owner === playerId);
    if (!myGoal) return null;
    
    return {
        x: room.x + myGoal.x,
        y: room.y + myGoal.y
    };
}

function getBestEnemyGoal(roomName, playerId) {
    const room = rooms[roomName];
    if (!room || !room.goals) return null;
    
    const enemyGoals = room.goals.filter(goal => goal.owner !== playerId);
    if (enemyGoals.length === 0) return null;
    
    // Pick closest enemy goal
    const activeChar = getActiveCharacter(playerId);
    let bestGoal = null;
    let bestDistance = Infinity;
    
    enemyGoals.forEach(goal => {
        const goalPos = { x: room.x + goal.x, y: room.y + goal.y };
        const dist = distance(activeChar, goalPos);
        if (dist < bestDistance) {
            bestDistance = dist;
            bestGoal = goalPos;
        }
    });
    
    return bestGoal;
}

function predictPuckPosition(frames) {
    // Enhanced prediction with physics simulation
    let futureX = gameState.puck.x;
    let futureY = gameState.puck.y;
    let vx = gameState.puck.vx;
    let vy = gameState.puck.vy;
    
    // Simulate physics for each frame
    for (let i = 0; i < frames; i++) {
        // Apply friction
        vx *= CONFIG.FRICTION;
        vy *= CONFIG.FRICTION;
        
        // Update position
        futureX += vx;
        futureY += vy;
        
        // Simple wall bounce prediction (room boundaries)
        const room = rooms[gameState.puck.currentRoom];
        if (room) {
            const minX = room.x - room.width/2 + CONFIG.PUCK_RADIUS;
            const maxX = room.x + room.width/2 - CONFIG.PUCK_RADIUS;
            const minY = room.y - room.height/2 + CONFIG.PUCK_RADIUS;
            const maxY = room.y + room.height/2 - CONFIG.PUCK_RADIUS;
            
            if (futureX < minX || futureX > maxX) vx *= -CONFIG.WALL_BOUNCE;
            if (futureY < minY || futureY > maxY) vy *= -CONFIG.WALL_BOUNCE;
        }
    }
    
    return { x: futureX, y: futureY };
}

function isMovingTowardMyGoal(playerId) {
    const myGoal = getMyGoal(gameState.puck.currentRoom, playerId);
    if (!myGoal) return false;
    
    // Check if puck is moving toward my goal
    const futurePos = predictPuckPosition(10);
    const currentDist = distance(gameState.puck, myGoal);
    const futureDist = distance(futurePos, myGoal);
    
    return futureDist < currentDist;
}

function getOtherAIPlayers(excludePlayerId) {
    const aiPlayers = [];
    for (let id = 1; id <= 3; id++) {
        if (id !== excludePlayerId && gameState.playerTypes[id] === 'ai') {
            const char = getActiveCharacter(id);
            if (char) {
                aiPlayers.push({ id, character: char });
            }
        }
    }
    return aiPlayers;
}

function getNearestPowerUp(character) {
    if (!gameState.powerUps.spawned || gameState.powerUps.spawned.length === 0) return null;
    
    let nearest = null;
    let nearestDist = Infinity;
    
    gameState.powerUps.spawned.forEach(powerUp => {
        if (powerUp.room === gameState.puck.currentRoom) {
            const dist = distance(character, powerUp);
            if (dist < nearestDist) {
                nearestDist = dist;
                nearest = { box: powerUp, distance: dist };
            }
        }
    });
    
    return nearest;
}

function shouldGoForPowerUp(playerId, character, settings) {
    const powerUp = getNearestPowerUp(character);
    if (!powerUp) return false;
    
    // Smart AI evaluates if power-up is worth going for
    if (settings.strategy < 0.6) return false; // Only medium/hard AI goes for power-ups
    
    const puckDist = distance(character, gameState.puck);
    const powerUpDist = powerUp.distance;
    
    // Consider power-up if it's closer than puck or if we're not in immediate danger
    if (powerUpDist < puckDist * 0.7) {
        // Check if we already have too many power-ups
        const activeEffects = gameState.powerUps.playerEffects[playerId];
        const activeCount = Object.values(activeEffects).filter(v => v > 0).length;
        
        if (activeCount < 2) {
            // Check if puck is threatening our goal
            if (!isMovingTowardMyGoal(playerId) || puckDist > 200) {
                return powerUp;
            }
        }
    }
    
    return false;
}

function getOptimalDefensivePosition(playerId, myGoal) {
    // Calculate optimal defensive position based on puck trajectory
    const puckToGoalX = myGoal.x - gameState.puck.x;
    const puckToGoalY = myGoal.y - gameState.puck.y;
    const dist = Math.sqrt(puckToGoalX * puckToGoalX + puckToGoalY * puckToGoalY);
    
    if (dist < 0.01) return myGoal; // Puck is at goal
    
    // Position between predicted puck position and goal
    const defensiveRatio = 0.3; // Stay 30% of distance from goal
    const optimalX = myGoal.x - (puckToGoalX / dist) * (dist * defensiveRatio);
    const optimalY = myGoal.y - (puckToGoalY / dist) * (dist * defensiveRatio);
    
    return { x: optimalX, y: optimalY };
}

function evaluateThreatLevel(playerId) {
    // Evaluate how dangerous the current situation is
    const myGoal = getMyGoal(gameState.puck.currentRoom, playerId);
    if (!myGoal) return 0;
    
    const puckDist = distance(gameState.puck, myGoal);
    const puckSpeed = Math.sqrt(gameState.puck.vx * gameState.puck.vx + gameState.puck.vy * gameState.puck.vy);
    const movingToward = isMovingTowardMyGoal(playerId);
    
    let threatLevel = 0;
    
    if (movingToward) {
        threatLevel += 0.5;
        if (puckDist < 200) threatLevel += 0.3;
        if (puckSpeed > 5) threatLevel += 0.2;
    }
    
    return Math.min(threatLevel, 1);
}

function isAloneInDefensiveZone(playerId) {
    const currentRoom = gameState.puck.currentRoom;
    if (!isMyDefensiveZone(currentRoom, playerId)) return false;
    
    // Check if any other players are active in this room
    for (let i = 1; i <= 3; i++) {
        if (i !== playerId) {
            const char = gameState.playerCharacters[i][currentRoom];
            if (char && char.active) {
                return false;
            }
        }
    }
    return true;
}

function getGoalkeeperPosition(playerId, puckPos, goalPos) {
    // Optimal goalkeeper position between puck and goal
    const dx = puckPos.x - goalPos.x;
    const dy = puckPos.y - goalPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist < 0.01) return goalPos;
    
    // Position 80-120 units from goal depending on puck distance
    const optimalDist = Math.min(120, Math.max(80, dist * 0.3));
    
    return {
        x: goalPos.x + (dx / dist) * optimalDist,
        y: goalPos.y + (dy / dist) * optimalDist
    };
}

function shouldDelayKick(playerId, character, settings) {
    // Determine if AI should wait for better kick opportunity
    const currentRoom = gameState.puck.currentRoom;
    const aiState = gameState.aiState[playerId];
    
    // Don't delay if defending urgently
    if (aiState.strategy === 'urgent_defend' || aiState.strategy === 'clear_puck') {
        return false;
    }
    
    // Check kick alignment with intended target
    let targetAlignment = 0;
    if (aiState.strategy === 'shoot_on_goal' || aiState.strategy === 'attack') {
        const enemyGoal = getBestEnemyGoal(currentRoom, playerId);
        if (enemyGoal) {
            targetAlignment = calculateKickAlignment(character, gameState.puck, enemyGoal);
        }
    } else if (aiState.strategy === 'push_to_portal') {
        // Check alignment with best portal
        const room = rooms[currentRoom];
        if (room && room.connections) {
            let bestPortalAlignment = 0;
            for (const [name, tunnel] of Object.entries(room.connections)) {
                const portalPos = { x: room.x + tunnel.x, y: room.y + tunnel.y };
                const alignment = calculateKickAlignment(character, gameState.puck, portalPos);
                bestPortalAlignment = Math.max(bestPortalAlignment, alignment);
            }
            targetAlignment = bestPortalAlignment;
        }
    }
    
    // Delay kick if alignment is poor (less than 70% for smart AI)
    const alignmentThreshold = settings.strategy > 0.7 ? 0.7 : 0.5;
    return targetAlignment < alignmentThreshold;
}

export function shouldAIKick(playerId, character, settings) {
    const currentRoom = gameState.puck.currentRoom;
    const aiState = gameState.aiState[playerId];
    
    // BE MORE AGGRESSIVE - kick more often!
    if (Math.random() > Math.max(0.7, settings.strategy)) return false;
    
    // Enhanced kicking decisions based on current strategy
    switch (aiState.strategy) {
        case 'shoot_on_goal':
        case 'attack':
            // Always kick when in attacking mode and aligned with goal
            const enemyGoal = getBestEnemyGoal(currentRoom, playerId);
            if (enemyGoal) {
                const alignment = calculateKickAlignment(character, gameState.puck, enemyGoal);
                return alignment > 0.4; // Much lower threshold for more aggressive attacking!
            }
            break;
            
        case 'clear_puck':
        case 'urgent_defend':
            // Always kick to clear danger
            return true;
            
        case 'goalkeeper':
            // Goalkeeper kicks if puck is close and moving slowly
            const puckSpeed = Math.sqrt(gameState.puck.vx * gameState.puck.vx + gameState.puck.vy * gameState.puck.vy);
            if (puckSpeed < 3) {
                return true; // Clear slow-moving pucks
            }
            break;
            
        case 'escape_to_portal':
            // Always kick toward portal when escaping
            return true;
            
        case 'push_to_portal':
            // Enhanced portal targeting
            if (currentRoom === 'center') {
                const centerRoom = rooms['center'];
                let bestPortal = null;
                let bestScore = -1;
                
                for (const [targetRoom, tunnel] of Object.entries(centerRoom.connections)) {
                    if (targetRoom !== `player${playerId}_zone`) {
                        const portalX = centerRoom.x + tunnel.x;
                        const portalY = centerRoom.y + tunnel.y;
                        
                        const alignment = calculateKickAlignment(character, gameState.puck, {x: portalX, y: portalY});
                        const distance = Math.sqrt((portalX - character.x)**2 + (portalY - character.y)**2);
                        
                        // Score based on alignment and whether it's an enemy zone
                        let score = alignment;
                        if (targetRoom.includes('player') && !targetRoom.includes(`${playerId}`)) {
                            score *= 1.5; // Prefer enemy zones
                        }
                        
                        // Smart AI considers distance too
                        if (settings.strategy > 0.8) {
                            score *= (1000 - distance) / 1000; // Prefer closer portals
                        }
                        
                        if (score > bestScore && alignment > 0.5) {
                            bestScore = score;
                            bestPortal = { x: portalX, y: portalY, name: targetRoom };
                        }
                    }
                }
                
                return bestPortal !== null;
            }
            break;
    }
    
    // General kicking logic - more aggressive
    if (currentRoom !== 'center') {
        const enemyGoal = getBestEnemyGoal(currentRoom, playerId);
        if (enemyGoal) {
            const alignment = calculateKickAlignment(character, gameState.puck, enemyGoal);
            const puckToGoal = distance(gameState.puck, enemyGoal);
            
            // More aggressive kick thresholds
            let kickThreshold = 0.4;
            if (gameState.powerUps.playerEffects[playerId].speed > 0) {
                kickThreshold = 0.3; // Even more aggressive with speed boost
            }
            
            if (alignment > kickThreshold && puckToGoal > 80) {
                return true;
            }
        }
    } else {
        // In center room - actively kick toward enemy zones
        const room = rooms[currentRoom];
        if (room && room.connections) {
            // Prioritize kicking toward enemy defensive zones
            for (const [zoneName, tunnel] of Object.entries(room.connections)) {
                if (zoneName.includes('player') && !zoneName.includes(`${playerId}`)) {
                    const portalPos = { x: room.x + tunnel.x, y: room.y + tunnel.y };
                    const kickAlignment = calculateKickAlignment(character, gameState.puck, portalPos);
                    
                    // Aggressively kick toward opponent zones
                    if (kickAlignment > 0.5) {
                        return true; // Attack opponent zones
                    }
                }
            }
        }
    }
    
    // Defensive kicks - more aggressive clearing
    if (isMyDefensiveZone(currentRoom, playerId)) {
        const myGoal = getMyGoal(currentRoom, playerId);
        if (myGoal) {
            const puckToMyGoal = distance(gameState.puck, myGoal);
            const threatLevel = evaluateThreatLevel(playerId);
            
            // More frequent defensive clearing
            if (threatLevel > 0.3 || puckToMyGoal < 200) {
                return true;
            }
        }
    }
    
    return false;
}

function calculateKickAlignment(character, puck, target) {
    // Calculate how well aligned character is to kick puck toward target
    const charToPuckX = puck.x - character.x;
    const charToPuckY = puck.y - character.y;
    const puckToTargetX = target.x - puck.x;
    const puckToTargetY = target.y - puck.y;
    
    const charToPuckDist = Math.sqrt(charToPuckX * charToPuckX + charToPuckY * charToPuckY);
    const puckToTargetDist = Math.sqrt(puckToTargetX * puckToTargetX + puckToTargetY * puckToTargetY);
    
    if (charToPuckDist < 0.01 || puckToTargetDist < 0.01) return 0;
    
    // Normalize vectors
    const charToPuckNormX = charToPuckX / charToPuckDist;
    const charToPuckNormY = charToPuckY / charToPuckDist;
    const puckToTargetNormX = puckToTargetX / puckToTargetDist;
    const puckToTargetNormY = puckToTargetY / puckToTargetDist;
    
    // Calculate dot product (how aligned the vectors are)
    const dotProduct = charToPuckNormX * puckToTargetNormX + charToPuckNormY * puckToTargetNormY;
    
    // Return value between 0 and 1 (1 = perfect alignment)
    return Math.max(0, dotProduct);
}