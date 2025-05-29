import { CONFIG } from './config.js';
import { gameState, rooms } from './gameState.js';
import { distance, adjustBrightness } from './utils.js';

let renderCtx;

export function initCanvas() {
    const canvas = document.getElementById('gameCanvas');
    renderCtx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    window.addEventListener('resize', () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    });
    
    return { canvas, ctx: renderCtx };
}

export function render() {
    if (!gameState.gameStarted) return;
    
    const canvas = renderCtx.canvas;
    const gradient = renderCtx.createRadialGradient(canvas.width/2, canvas.height/2, 0, canvas.width/2, canvas.height/2, Math.max(canvas.width, canvas.height)/2);
    gradient.addColorStop(0, '#0f0f23');
    gradient.addColorStop(1, '#0a0a0a');
    renderCtx.fillStyle = gradient;
    renderCtx.fillRect(0, 0, canvas.width, canvas.height);
    
    renderCtx.save();
    renderCtx.translate(-gameState.camera.x, -gameState.camera.y);
    
    drawRooms();
    drawTunnels();
    drawPowerUps();
    drawPuckTrail();
    drawAllCharacters();
    drawBounceEffects();   // Draw bounce effects after characters
    drawPuck();           // Draw puck LAST so it's always visible on top
    
    if (gameState.isPaused) {
        renderCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        renderCtx.fillRect(gameState.camera.x, gameState.camera.y, canvas.width, canvas.height);
        
        renderCtx.fillStyle = '#00ffff';
        renderCtx.font = '48px Arial';
        renderCtx.textAlign = 'center';
        renderCtx.fillText('PAUSAD', gameState.camera.x + canvas.width/2, gameState.camera.y + canvas.height/2);
    }
    
    // Draw face-off countdown
    if (gameState.faceOff.active && gameState.faceOff.countdown > 0) {
        const seconds = Math.ceil(gameState.faceOff.countdown / 60);
        
        // Draw countdown circle
        renderCtx.strokeStyle = '#00ffff';
        renderCtx.lineWidth = 3;
        renderCtx.beginPath();
        renderCtx.arc(gameState.puck.x, gameState.puck.y, 200, 0, Math.PI * 2);
        renderCtx.stroke();
        
        // Draw countdown number
        renderCtx.fillStyle = '#00ffff';
        renderCtx.font = 'bold 72px Arial';
        renderCtx.textAlign = 'center';
        renderCtx.textBaseline = 'middle';
        renderCtx.fillText(seconds, gameState.puck.x, gameState.puck.y - 250);
        
        // Draw "FACE-OFF" text
        renderCtx.font = 'bold 36px Arial';
        renderCtx.fillText('FACE-OFF', gameState.puck.x, gameState.puck.y - 320);
    }
    
    renderCtx.restore();
}

function drawRooms() {
    Object.entries(rooms).forEach(([roomName, room]) => {
        const cornerRadius = CONFIG.CORNER_RADIUS;
        const x = room.x - room.width/2;
        const y = room.y - room.height/2;
        const width = room.width;
        const height = room.height;
        
        // Draw room with rounded corners
        renderCtx.beginPath();
        renderCtx.moveTo(x + cornerRadius, y);
        renderCtx.lineTo(x + width - cornerRadius, y);
        renderCtx.quadraticCurveTo(x + width, y, x + width, y + cornerRadius);
        renderCtx.lineTo(x + width, y + height - cornerRadius);
        renderCtx.quadraticCurveTo(x + width, y + height, x + width - cornerRadius, y + height);
        renderCtx.lineTo(x + cornerRadius, y + height);
        renderCtx.quadraticCurveTo(x, y + height, x, y + height - cornerRadius);
        renderCtx.lineTo(x, y + cornerRadius);
        renderCtx.quadraticCurveTo(x, y, x + cornerRadius, y);
        renderCtx.closePath();
        
        // Fill with solid color
        renderCtx.fillStyle = room.color + '30'; // Semi-transparent solid color
        renderCtx.fill();
        
        // Stroke
        renderCtx.strokeStyle = room.type === 'frantic' ? '#ff00ff' : '#00ffff';
        renderCtx.lineWidth = room.type === 'frantic' ? 4 : 3;
        renderCtx.shadowColor = room.type === 'frantic' ? '#ff00ff' : '#00ffff';
        renderCtx.shadowBlur = room.type === 'frantic' ? 15 : 10;
        renderCtx.stroke();
        renderCtx.shadowBlur = 0;
        
        renderCtx.fillStyle = room.type === 'frantic' ? '#ff00ff' : '#ffffff';
        renderCtx.font = room.type === 'frantic' ? 'bold 18px Arial' : '16px Arial';
        renderCtx.textAlign = 'center';
        const roomDisplayName = room.type === 'frantic' ? 'FRANTIC ZONE!' : 
                               room.type === 'defensive' ? `Player ${room.owner} Zone` : 
                               'CENTER';
        renderCtx.fillText(roomDisplayName, room.x, room.y - room.height/2 + 25);
        
        if (room.goals) {
            room.goals.forEach(goal => drawGoal(room, goal));
        }
    });
}

function drawGoal(room, goal) {
    // Skip drawing if owner has shield active
    if (gameState.powerUps.playerEffects[goal.owner].shield > 0) {
        return;
    }
    
    const goalX = room.x + goal.x;
    const goalY = room.y + goal.y;
    const goalColor = gameState.playerColors[goal.owner];
    
    renderCtx.strokeStyle = goalColor;
    renderCtx.fillStyle = goalColor + '50';
    renderCtx.lineWidth = 4;
    renderCtx.shadowColor = goalColor;
    renderCtx.shadowBlur = 15;
    
    let drawX, drawY, drawWidth, drawHeight;
    
    switch (goal.direction) {
        case 'top':
            drawX = goalX - CONFIG.GOAL_SIZE/2;
            drawY = goalY - 8;
            drawWidth = CONFIG.GOAL_SIZE;
            drawHeight = 16;
            break;
        case 'right':
            drawX = goalX - 8;
            drawY = goalY - CONFIG.GOAL_SIZE/2;
            drawWidth = 16;
            drawHeight = CONFIG.GOAL_SIZE;
            break;
        case 'bottom':
            drawX = goalX - CONFIG.GOAL_SIZE/2;
            drawY = goalY - 8;
            drawWidth = CONFIG.GOAL_SIZE;
            drawHeight = 16;
            break;
        case 'left':
            drawX = goalX - 8;
            drawY = goalY - CONFIG.GOAL_SIZE/2;
            drawWidth = 16;
            drawHeight = CONFIG.GOAL_SIZE;
            break;
    }
    
    renderCtx.fillRect(drawX, drawY, drawWidth, drawHeight);
    renderCtx.strokeRect(drawX, drawY, drawWidth, drawHeight);
    
    renderCtx.fillStyle = '#ffffff';
    renderCtx.font = 'bold 14px Arial';
    renderCtx.textAlign = 'center';
    renderCtx.fillText(goal.owner, goalX, goalY + 5);
    
    renderCtx.shadowBlur = 0;
}

function drawTunnels() {
    Object.entries(rooms).forEach(([roomName, room]) => {
        Object.entries(room.connections || {}).forEach(([connectionName, tunnel]) => {
            const tunnelCenterX = room.x + tunnel.x;
            const tunnelCenterY = room.y + tunnel.y;
            const tunnelX = tunnelCenterX - tunnel.width/2;
            const tunnelY = tunnelCenterY - tunnel.height/2;
            
            // Portal glow effect
            const glowSize = 40 + Math.sin(gameState.gameTime * 0.05) * 10;
            const gradient = renderCtx.createRadialGradient(tunnelCenterX, tunnelCenterY, 0, tunnelCenterX, tunnelCenterY, glowSize);
            gradient.addColorStop(0, 'rgba(0, 255, 255, 0.8)');
            gradient.addColorStop(0.5, 'rgba(0, 128, 255, 0.4)');
            gradient.addColorStop(1, 'rgba(0, 255, 255, 0)');
            
            renderCtx.fillStyle = gradient;
            renderCtx.fillRect(tunnelCenterX - glowSize, tunnelCenterY - glowSize, glowSize * 2, glowSize * 2);
            
            // Portal core
            renderCtx.fillStyle = '#001133';
            renderCtx.fillRect(tunnelX, tunnelY, tunnel.width, tunnel.height);
            
            // Portal swirl effect
            renderCtx.save();
            renderCtx.translate(tunnelCenterX, tunnelCenterY);
            renderCtx.rotate(gameState.gameTime * 0.04);
            
            // Inner spiral
            renderCtx.strokeStyle = 'rgba(0, 255, 255, 0.6)';
            renderCtx.lineWidth = 2;
            renderCtx.beginPath();
            for (let i = 0; i < 20; i++) {
                const angle = i * 0.3;
                const radius = i * 1.5;
                const x = Math.cos(angle) * radius;
                const y = Math.sin(angle) * radius;
                if (i === 0) renderCtx.moveTo(x, y);
                else renderCtx.lineTo(x, y);
            }
            renderCtx.stroke();
            
            renderCtx.restore();
            
            // Portal border
            renderCtx.strokeStyle = '#00ffff';
            renderCtx.lineWidth = 3;
            renderCtx.shadowColor = '#00ffff';
            renderCtx.shadowBlur = 15;
            renderCtx.strokeRect(tunnelX, tunnelY, tunnel.width, tunnel.height);
            renderCtx.shadowBlur = 0;
        });
    });
}

function drawPowerUps() {
    gameState.powerUps.spawned.forEach(powerUp => {
        if (powerUp.room !== gameState.currentRoom) return;
        
        renderCtx.save();
        renderCtx.translate(powerUp.x, powerUp.y);
        renderCtx.rotate(powerUp.rotation);
        
        // Pulsing effect
        const pulseScale = 1 + Math.sin(powerUp.pulsePhase) * 0.2;
        renderCtx.scale(pulseScale, pulseScale);
        
        // Box background
        const size = CONFIG.POWERUP_SIZE;
        renderCtx.fillStyle = '#001144';
        renderCtx.strokeStyle = '#00ffff';
        renderCtx.lineWidth = 3;
        renderCtx.shadowColor = '#00ffff';
        renderCtx.shadowBlur = 15;
        
        // Draw box
        renderCtx.fillRect(-size, -size, size * 2, size * 2);
        renderCtx.strokeRect(-size, -size, size * 2, size * 2);
        
        // Draw icon based on type
        renderCtx.fillStyle = '#ffffff';
        renderCtx.font = 'bold 20px Arial';
        renderCtx.textAlign = 'center';
        renderCtx.textBaseline = 'middle';
        
        const icons = {
            magnet: '🧲',
            speed: '⚡',
            slowdown: '🐌',
            shield: '🛡️'
        };
        
        renderCtx.fillText(icons[powerUp.type] || '?', 0, 0);
        
        renderCtx.restore();
    });
}

function drawPuckTrail() {
    renderCtx.globalAlpha = 0.6;
    gameState.puck.trail.forEach((point, index) => {
        const alpha = index / gameState.puck.trail.length;
        const radius = CONFIG.PUCK_RADIUS * alpha * 0.7;
        
        renderCtx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.5})`;
        renderCtx.beginPath();
        renderCtx.arc(point.x, point.y, radius, 0, Math.PI * 2);
        renderCtx.fill();
    });
    renderCtx.globalAlpha = 1;
}

function drawAllCharacters() {
    for (let playerId = 1; playerId <= 3; playerId++) {
        const playerColor = gameState.playerColors[playerId];
        
        for (let roomName in gameState.playerCharacters[playerId]) {
            const character = gameState.playerCharacters[playerId][roomName];
            drawCharacter(character, playerId, playerColor, character.active);
        }
    }
}

function drawCharacter(character, playerId, color, isActive) {
    const alpha = isActive ? 1.0 : 0.25;
    const isAI = gameState.playerTypes[playerId] === 'ai';
    const isKicking = character.kickEffect > 0;
    
    // Calculate tilt based on velocity
    const vx = character.vx || 0;
    const vy = character.vy || 0;
    const speed = Math.sqrt(vx * vx + vy * vy);
    const maxTilt = 0.4; // Maximum tilt amount (increased slightly)
    const tiltX = (vx / CONFIG.PLAYER_SPEED) * maxTilt;
    const tiltY = (vy / CONFIG.PLAYER_SPEED) * maxTilt;
    
    // Dynamic shadow based on movement direction
    renderCtx.save();
    renderCtx.globalAlpha = alpha * 0.6; // More opaque shadow
    renderCtx.fillStyle = 'rgba(0, 0, 0, 0.8)'; // Darker shadow
    
    // Shadow moves opposite to movement direction (tilt effect)
    const baseShadowOffset = 8;
    const shadowOffsetX = baseShadowOffset - tiltX * 20; // Shadow opposite to tilt
    const shadowOffsetY = baseShadowOffset - tiltY * 20;
    
    // Shadow stretches more when moving faster
    const shadowScaleX = 1.1 + Math.abs(tiltY) * 0.2; // Stretch perpendicular to movement
    const shadowScaleY = 1.1 + Math.abs(tiltX) * 0.2;
    
    renderCtx.translate(character.x + shadowOffsetX, character.y + shadowOffsetY);
    renderCtx.scale(shadowScaleX, shadowScaleY);
    renderCtx.beginPath();
    renderCtx.arc(0, 0, CONFIG.PADDLE_RADIUS * 0.9, 0, Math.PI * 2);
    renderCtx.fill();
    renderCtx.restore();
    
    // Draw subtle movement trail if moving fast
    if (isActive && (Math.abs(character.vx) > 2 || Math.abs(character.vy) > 2)) {
        const tailLength = 12;
        const tailSteps = 2;
        
        for (let i = 0; i < tailSteps; i++) {
            const t = (i + 1) / tailSteps;
            const tailX = character.x - character.vx * t * tailLength;
            const tailY = character.y - character.vy * t * tailLength;
            const tailRadius = CONFIG.PADDLE_RADIUS * (1 - t * 0.3);
            
            renderCtx.fillStyle = color;
            renderCtx.globalAlpha = alpha * 0.2 * (1 - t);
            renderCtx.beginPath();
            renderCtx.arc(tailX, tailY, tailRadius, 0, Math.PI * 2);
            renderCtx.fill();
        }
    }
    
    renderCtx.globalAlpha = alpha;
    
    // Enhanced visuals when kicking
    const paddleRadius = isKicking ? CONFIG.PADDLE_RADIUS + 5 : CONFIG.PADDLE_RADIUS;
    
    // Calculate subtle squash effect based on movement (speed already calculated above)
    const squashAmount = Math.min(speed / 20, 0.15); // Max 15% squash, more subtle
    
    renderCtx.fillStyle = color;
    renderCtx.strokeStyle = color;
    renderCtx.lineWidth = isActive ? 4 : 2;
    // Removed glow effect (shadowBlur) for cleaner look
    
    renderCtx.save();
    renderCtx.translate(character.x, character.y);
    
    // Apply tilt and squash effect based on movement
    if (speed > 0.1) {
        // Apply 3D tilt effect
        const scaleX = 1 - Math.abs(tiltX) * 0.3;
        const scaleY = 1 - Math.abs(tiltY) * 0.3;
        const skewX = tiltX * 0.2;
        const skewY = tiltY * 0.2;
        
        // Create transformation matrix for tilted disk effect
        renderCtx.transform(scaleX, skewY, skewX, scaleY, 0, 0);
        
        // Add slight rotation based on movement direction
        const angle = Math.atan2(vy, vx);
        renderCtx.rotate(angle * 0.1);
    }
    
    // Draw the main character shape
    renderCtx.beginPath();
    renderCtx.arc(0, 0, paddleRadius, 0, Math.PI * 2);
    
    // Gradient fill for 3D effect
    const gradient = renderCtx.createRadialGradient(-paddleRadius * 0.3 * tiltX, -paddleRadius * 0.3 * tiltY, 0, 0, 0, paddleRadius);
    gradient.addColorStop(0, color);
    gradient.addColorStop(0.7, color);
    gradient.addColorStop(1, adjustBrightness(color, -30));
    renderCtx.fillStyle = gradient;
    renderCtx.fill();
    
    renderCtx.stroke();
    
    renderCtx.restore();
    
    // Draw power-up effects
    if (isActive) {
        const effects = gameState.powerUps.playerEffects[playerId];
        
        // Magnet effect
        if (effects.magnet > 0) {
            renderCtx.strokeStyle = '#ff00ff';
            renderCtx.lineWidth = 3;
            renderCtx.globalAlpha = 0.6 + Math.sin(gameState.gameTime * 0.08) * 0.3;
            renderCtx.beginPath();
            renderCtx.arc(character.x, character.y, 80, 0, Math.PI * 2);
            renderCtx.stroke();
            
            // Add inner ring for stronger visual
            renderCtx.lineWidth = 2;
            renderCtx.globalAlpha = 0.4 + Math.sin(gameState.gameTime * 0.12) * 0.2;
            renderCtx.beginPath();
            renderCtx.arc(character.x, character.y, 50, 0, Math.PI * 2);
            renderCtx.stroke();
            renderCtx.globalAlpha = 1;
        }
        
        // Speed effect
        if (effects.speed > 0) {
            renderCtx.strokeStyle = '#ffff00';
            renderCtx.lineWidth = 3;
            renderCtx.globalAlpha = 0.6;
            const sparkles = 3;
            for (let i = 0; i < sparkles; i++) {
                const angle = (gameState.gameTime * 0.1 + i * Math.PI * 2 / sparkles) % (Math.PI * 2);
                const x = character.x + Math.cos(angle) * 35;
                const y = character.y + Math.sin(angle) * 35;
                renderCtx.beginPath();
                renderCtx.moveTo(x - 5, y);
                renderCtx.lineTo(x + 5, y);
                renderCtx.moveTo(x, y - 5);
                renderCtx.lineTo(x, y + 5);
                renderCtx.stroke();
            }
            renderCtx.globalAlpha = 1;
        }
        
        // Shield effect
        if (effects.shield > 0) {
            renderCtx.strokeStyle = '#00ff00';
            renderCtx.fillStyle = 'rgba(0, 255, 0, 0.1)';
            renderCtx.lineWidth = 3;
            renderCtx.globalAlpha = 0.7 + Math.sin(gameState.gameTime * 0.05) * 0.3;
            renderCtx.beginPath();
            renderCtx.arc(character.x, character.y, CONFIG.PADDLE_RADIUS + 10, 0, Math.PI * 2);
            renderCtx.fill();
            renderCtx.stroke();
            renderCtx.globalAlpha = 1;
        }
    }
    
    // Player number removed for cleaner look
    
    // AI indicator
    if (isAI && isActive) {
        renderCtx.fillStyle = '#ffff00';
        renderCtx.font = '10px Arial';
        renderCtx.fillText('AI', character.x, character.y - CONFIG.PADDLE_RADIUS - 8);
    }
    
    // Kick indicator
    if (isActive && isKicking) {
        renderCtx.fillStyle = '#ffffff';
        renderCtx.font = 'bold 12px Arial';
        renderCtx.fillText('KICK!', character.x, character.y - CONFIG.PADDLE_RADIUS - 20);
    }
    
    // Can kick indicator (when close to puck)
    if (isActive && !isAI && gameState.kickCooldowns[playerId] === 0) {
        const dist = distance(character, gameState.puck);
        if (dist <= CONFIG.KICK_RANGE) {
            renderCtx.strokeStyle = '#ffff00';
            renderCtx.lineWidth = 2;
            renderCtx.setLineDash([3, 3]);
            renderCtx.beginPath();
            renderCtx.arc(character.x, character.y, CONFIG.KICK_RANGE, 0, Math.PI * 2);
            renderCtx.stroke();
            renderCtx.setLineDash([]);
        }
    }
    
    
    renderCtx.globalAlpha = 1;
}

export function drawBounceEffects() {
    gameState.bounceEffects.forEach(effect => {
        const alpha = effect.life / effect.maxLife;
        const currentSize = effect.size * (1 - alpha * 0.5); // Shrink over time
        
        // Save context to avoid affecting other drawings
        renderCtx.save();
        
        renderCtx.globalAlpha = alpha * 0.8;
        renderCtx.strokeStyle = '#ffff00';
        renderCtx.lineWidth = 3;
        renderCtx.beginPath();
        renderCtx.arc(effect.x, effect.y, currentSize, 0, Math.PI * 2);
        renderCtx.stroke();
        
        // Inner ring
        renderCtx.strokeStyle = '#ffffff';
        renderCtx.lineWidth = 1;
        renderCtx.beginPath();
        renderCtx.arc(effect.x, effect.y, currentSize * 0.6, 0, Math.PI * 2);
        renderCtx.stroke();
        
        // Restore context
        renderCtx.restore();
    });
}

function drawPuck() {
    // Force reset all context state to ensure puck is visible
    renderCtx.save();
    
    // Special effect during portal transition
    if (gameState.portalTransition.active) {
        const elapsed = Date.now() - gameState.portalTransition.startTime;
        const progress = elapsed / gameState.portalTransition.duration;
        
        // Fade out/in effect
        renderCtx.globalAlpha = progress < 0.5 ? 1 - (progress * 2) : (progress - 0.5) * 2;
        
        // Portal energy effect around puck
        const energyRadius = 30 + Math.sin(elapsed * 0.01) * 10;
        const gradient = renderCtx.createRadialGradient(gameState.puck.x, gameState.puck.y, 0, gameState.puck.x, gameState.puck.y, energyRadius);
        gradient.addColorStop(0, 'rgba(0, 255, 255, 0.8)');
        gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.4)');
        gradient.addColorStop(1, 'rgba(0, 255, 255, 0)');
        renderCtx.fillStyle = gradient;
        renderCtx.fillRect(gameState.puck.x - energyRadius, gameState.puck.y - energyRadius, energyRadius * 2, energyRadius * 2);
    } else {
        renderCtx.globalAlpha = 1.0;
    }
    
    renderCtx.shadowColor = 'transparent';
    renderCtx.shadowBlur = 0;
    
    // Puck shadow
    renderCtx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    renderCtx.beginPath();
    renderCtx.arc(gameState.puck.x + 2, gameState.puck.y + 2, CONFIG.PUCK_RADIUS, 0, Math.PI * 2);
    renderCtx.fill();
    
    // Main puck with rotation
    const rotation = gameState.gameTime * 0.1;
    renderCtx.translate(gameState.puck.x, gameState.puck.y);
    renderCtx.rotate(rotation);
    
    // Puck body - VERY bright and visible
    renderCtx.fillStyle = '#ffffff';
    renderCtx.strokeStyle = '#00ffff';
    renderCtx.lineWidth = 4;
    
    // Strong glow effect
    renderCtx.shadowColor = '#ffffff';
    renderCtx.shadowBlur = 15;
    
    renderCtx.beginPath();
    renderCtx.arc(0, 0, CONFIG.PUCK_RADIUS, 0, Math.PI * 2);
    renderCtx.fill();
    
    // Reset shadow for stroke
    renderCtx.shadowColor = 'transparent';
    renderCtx.shadowBlur = 0;
    renderCtx.stroke();
    
    // Puck cross pattern - make it more visible
    renderCtx.strokeStyle = '#00dddd';
    renderCtx.lineWidth = 3;
    renderCtx.beginPath();
    renderCtx.moveTo(-CONFIG.PUCK_RADIUS * 0.7, 0);
    renderCtx.lineTo(CONFIG.PUCK_RADIUS * 0.7, 0);
    renderCtx.moveTo(0, -CONFIG.PUCK_RADIUS * 0.7);
    renderCtx.lineTo(0, CONFIG.PUCK_RADIUS * 0.7);
    renderCtx.stroke();
    
    // Restore context
    renderCtx.restore();
}