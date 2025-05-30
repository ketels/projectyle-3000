import { CONFIG } from './config.js';
import { gameState, rooms } from './gameState.js';
import { distance, adjustBrightness } from './utils.js';

let renderCtx;

// 3D perspective settings
const PERSPECTIVE_CONFIG = {
    horizon: 200,        // Y position of horizon line
    maxScale: 1.2,       // Maximum scale for objects at bottom
    minScale: 0.6,       // Minimum scale for objects at top
    vanishingY: -500,    // Y position of vanishing point
    wallHeight: 3,       // Virtual wall height (reduced to 3px)
    wallThickness: 25,   // Wall thickness
    cameraHeight: 300,   // Camera height above the floor
    cameraAngle: 0.3     // Camera tilt angle (radians)
};

function getPerspectiveScale(y, canvasHeight) {
    // Calculate perspective scale based on Y position
    const normalizedY = (y - PERSPECTIVE_CONFIG.horizon) / canvasHeight;
    const scale = PERSPECTIVE_CONFIG.minScale + 
                 (PERSPECTIVE_CONFIG.maxScale - PERSPECTIVE_CONFIG.minScale) * 
                 Math.max(0, Math.min(1, normalizedY + 0.5));
    return scale;
}

function project3DPoint(x, y, z, cameraX, cameraY) {
    // Project 3D point to 2D screen coordinates considering camera position
    const relativeX = x - cameraX;
    const relativeY = y - cameraY;
    
    // Simple perspective projection
    const distance = Math.sqrt(relativeX * relativeX + relativeY * relativeY);
    const perspective = PERSPECTIVE_CONFIG.cameraHeight / (PERSPECTIVE_CONFIG.cameraHeight - z);
    
    // Camera angle effect
    const angleOffsetY = z * Math.sin(PERSPECTIVE_CONFIG.cameraAngle) * 0.5;
    
    return {
        x: cameraX + relativeX * perspective,
        y: cameraY + relativeY * perspective + angleOffsetY,
        scale: perspective
    };
}

function getWallTopY(baseY, cameraY) {
    // Calculate where the top of the wall appears on screen
    const relativeY = baseY - cameraY;
    const wallTop = project3DPoint(0, baseY, PERSPECTIVE_CONFIG.wallHeight, 0, cameraY);
    return wallTop.y;
}

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
    drawTunnels(); // Draws the swirl effects through wall openings
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
        const wallThickness = 15; // Wall thickness for 3D effect
        
        // Draw 3D walls with depth
        draw3DWalls(x, y, width, height, cornerRadius, room);
        
        // Draw room floor with rounded corners
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
        
        // Fill floor with lighter color
        renderCtx.fillStyle = room.color + '20'; // Very transparent floor
        renderCtx.fill();
        
        // Add inner shadow for depth
        renderCtx.save();
        renderCtx.clip(); // Clip to room shape
        renderCtx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        renderCtx.shadowBlur = 10;
        renderCtx.shadowOffsetX = 0;
        renderCtx.shadowOffsetY = 0;
        renderCtx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
        renderCtx.lineWidth = 20;
        renderCtx.stroke();
        renderCtx.restore();
        
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

function draw3DWalls(x, y, width, height, cornerRadius, room) {
    const cameraX = gameState.camera.x;
    const cameraY = gameState.camera.y;
    const wallColor = room.type === 'frantic' ? '#ff00ff' : '#00ffff';
    const wallColorDark = room.type === 'frantic' ? '#cc00cc' : '#0099cc';
    const wallColorMedium = room.type === 'frantic' ? '#dd00dd' : '#0066cc';
    const thickness = PERSPECTIVE_CONFIG.wallThickness;
    
    // Get portal positions for this room to create openings
    const portals = [];
    if (room.connections) {
        Object.entries(room.connections).forEach(([connectionName, tunnel]) => {
            portals.push({
                x: room.x + tunnel.x,
                y: room.y + tunnel.y,
                width: tunnel.width,
                height: tunnel.height
            });
        });
    }
    
    // Generate curved wall segments that follow the rounded corners
    function generateWallPoints(centerX, centerY, w, h, radius, outset) {
        const points = [];
        const segmentsPerCorner = 36; // Even higher resolution for precise portal openings
        
        // Calculate the effective radius with outset
        const effectiveRadius = radius + outset;
        
        // Define the four corner centers
        const corners = [
            { x: centerX - w/2 + radius, y: centerY - h/2 + radius, startAngle: Math.PI, endAngle: Math.PI * 1.5 },     // Top-left
            { x: centerX + w/2 - radius, y: centerY - h/2 + radius, startAngle: Math.PI * 1.5, endAngle: Math.PI * 2 }, // Top-right  
            { x: centerX + w/2 - radius, y: centerY + h/2 - radius, startAngle: 0, endAngle: Math.PI * 0.5 },           // Bottom-right
            { x: centerX - w/2 + radius, y: centerY + h/2 - radius, startAngle: Math.PI * 0.5, endAngle: Math.PI }      // Bottom-left
        ];
        
        // For each corner, generate curved points
        corners.forEach((corner, cornerIndex) => {
            for (let i = 0; i <= segmentsPerCorner; i++) {
                const t = i / segmentsPerCorner;
                const angle = corner.startAngle + (corner.endAngle - corner.startAngle) * t;
                
                const pointX = corner.x + effectiveRadius * Math.cos(angle);
                const pointY = corner.y + effectiveRadius * Math.sin(angle);
                
                points.push([pointX, pointY]);
            }
            
            // Add straight edge points between corners (except after last corner)
            if (cornerIndex < 3) {
                const straightSegments = 36; // Much higher resolution for straight edges
                
                for (let i = 1; i <= straightSegments; i++) {
                    const t = i / (straightSegments + 1);
                    let straightX, straightY;
                    
                    if (cornerIndex === 0) { // Top edge
                        straightX = corner.x + effectiveRadius + t * (w - 2 * radius);
                        straightY = centerY - h/2 - outset;
                    } else if (cornerIndex === 1) { // Right edge
                        straightX = centerX + w/2 + outset;
                        straightY = corner.y + effectiveRadius + t * (h - 2 * radius);
                    } else if (cornerIndex === 2) { // Bottom edge
                        straightX = corner.x - effectiveRadius - t * (w - 2 * radius);
                        straightY = centerY + h/2 + outset;
                    }
                    
                    points.push([straightX, straightY]);
                }
            }
        });
        
        // Add final straight edge (left edge)
        const leftEdgeSegments = 36;
        const leftCorner = corners[3];
        for (let i = 1; i < leftEdgeSegments; i++) {
            const t = i / leftEdgeSegments;
            const straightX = centerX - w/2 - outset;
            const straightY = leftCorner.y - effectiveRadius - t * (h - 2 * radius);
            points.push([straightX, straightY]);
        }
        
        return points;
    }
    
    const outerPoints = generateWallPoints(x + width/2, y + height/2, width, height, cornerRadius, thickness);
    const innerPoints = generateWallPoints(x + width/2, y + height/2, width, height, cornerRadius, 0);
    
    // Helper function to check if a wall segment intersects with any portal
    function segmentIntersectsPortal(p1, p2) {
        return portals.some(portal => {
            const buffer = 5;
            const portalLeft = portal.x - portal.width/2 - buffer;
            const portalRight = portal.x + portal.width/2 + buffer;
            const portalTop = portal.y - portal.height/2 - buffer;
            const portalBottom = portal.y + portal.height/2 + buffer;
            
            // Check if either endpoint is inside the portal
            const p1Inside = p1[0] >= portalLeft && p1[0] <= portalRight && 
                           p1[1] >= portalTop && p1[1] <= portalBottom;
            const p2Inside = p2[0] >= portalLeft && p2[0] <= portalRight && 
                           p2[1] >= portalTop && p2[1] <= portalBottom;
            
            if (p1Inside || p2Inside) return true;
            
            // Check if segment crosses portal boundaries
            const segMinX = Math.min(p1[0], p2[0]);
            const segMaxX = Math.max(p1[0], p2[0]);
            const segMinY = Math.min(p1[1], p2[1]);
            const segMaxY = Math.max(p1[1], p2[1]);
            
            // Check if bounding boxes overlap
            return segMaxX >= portalLeft && segMinX <= portalRight &&
                   segMaxY >= portalTop && segMinY <= portalBottom;
        });
    }
    
    // Helper function to clip a line segment against portal boundaries
    function clipSegmentToPortals(p1, p2) {
        let clippedP1 = [...p1];
        let clippedP2 = [...p2];
        let fullyClipped = false;
        
        for (const portal of portals) {
            const buffer = 5;
            const portalLeft = portal.x - portal.width/2 - buffer;
            const portalRight = portal.x + portal.width/2 + buffer;
            const portalTop = portal.y - portal.height/2 - buffer;
            const portalBottom = portal.y + portal.height/2 + buffer;
            
            // Check if segment intersects portal
            const dx = clippedP2[0] - clippedP1[0];
            const dy = clippedP2[1] - clippedP1[1];
            
            // Find intersections with portal boundaries
            const intersections = [];
            
            // Check intersection with left edge
            if (dx !== 0) {
                const t = (portalLeft - clippedP1[0]) / dx;
                if (t >= 0 && t <= 1) {
                    const y = clippedP1[1] + t * dy;
                    if (y >= portalTop && y <= portalBottom) {
                        intersections.push({ t, x: portalLeft, y, edge: 'left' });
                    }
                }
            }
            
            // Check intersection with right edge
            if (dx !== 0) {
                const t = (portalRight - clippedP1[0]) / dx;
                if (t >= 0 && t <= 1) {
                    const y = clippedP1[1] + t * dy;
                    if (y >= portalTop && y <= portalBottom) {
                        intersections.push({ t, x: portalRight, y, edge: 'right' });
                    }
                }
            }
            
            // Check intersection with top edge
            if (dy !== 0) {
                const t = (portalTop - clippedP1[1]) / dy;
                if (t >= 0 && t <= 1) {
                    const x = clippedP1[0] + t * dx;
                    if (x >= portalLeft && x <= portalRight) {
                        intersections.push({ t, x, y: portalTop, edge: 'top' });
                    }
                }
            }
            
            // Check intersection with bottom edge
            if (dy !== 0) {
                const t = (portalBottom - clippedP1[1]) / dy;
                if (t >= 0 && t <= 1) {
                    const x = clippedP1[0] + t * dx;
                    if (x >= portalLeft && x <= portalRight) {
                        intersections.push({ t, x, y: portalBottom, edge: 'bottom' });
                    }
                }
            }
            
            // Check if segment is entirely inside portal
            const p1Inside = clippedP1[0] >= portalLeft && clippedP1[0] <= portalRight && 
                           clippedP1[1] >= portalTop && clippedP1[1] <= portalBottom;
            const p2Inside = clippedP2[0] >= portalLeft && clippedP2[0] <= portalRight && 
                           clippedP2[1] >= portalTop && clippedP2[1] <= portalBottom;
            
            if (p1Inside && p2Inside) {
                fullyClipped = true;
                break;
            }
            
            // Clip the segment
            if (intersections.length > 0) {
                intersections.sort((a, b) => a.t - b.t);
                
                if (p1Inside && !p2Inside) {
                    // P1 is inside, P2 is outside - clip P1 to exit point
                    const exitIntersection = intersections[intersections.length - 1];
                    clippedP1 = [exitIntersection.x, exitIntersection.y];
                } else if (!p1Inside && p2Inside) {
                    // P1 is outside, P2 is inside - clip P2 to entry point
                    const entryIntersection = intersections[0];
                    clippedP2 = [entryIntersection.x, entryIntersection.y];
                } else if (!p1Inside && !p2Inside && intersections.length >= 2) {
                    // Segment passes through portal completely
                    // We need to split this into two segments, but for now just skip it
                    fullyClipped = true;
                    break;
                }
            }
        }
        
        return { p1: clippedP1, p2: clippedP2, fullyClipped };
    }
    
    // Draw wall segments using the curved points (skip segments that cross portals)
    for (let i = 0; i < outerPoints.length; i++) {
        const nextI = (i + 1) % outerPoints.length;
        const outerP1 = outerPoints[i];
        const outerP2 = outerPoints[nextI];
        const innerP1 = innerPoints[i];
        const innerP2 = innerPoints[nextI];
        
        // Skip if segment intersects a portal
        if (segmentIntersectsPortal(outerP1, outerP2) || segmentIntersectsPortal(innerP1, innerP2)) {
            continue;
        }
        
        // Project floor points
        const outerFloor1 = project3DPoint(outerP1[0], outerP1[1], 0, cameraX, cameraY);
        const outerFloor2 = project3DPoint(outerP2[0], outerP2[1], 0, cameraX, cameraY);
        const innerFloor1 = project3DPoint(innerP1[0], innerP1[1], 0, cameraX, cameraY);
        const innerFloor2 = project3DPoint(innerP2[0], innerP2[1], 0, cameraX, cameraY);
        
        // Project wall top points
        const outerTop1 = project3DPoint(outerP1[0], outerP1[1], PERSPECTIVE_CONFIG.wallHeight, cameraX, cameraY);
        const outerTop2 = project3DPoint(outerP2[0], outerP2[1], PERSPECTIVE_CONFIG.wallHeight, cameraX, cameraY);
        const innerTop1 = project3DPoint(innerP1[0], innerP1[1], PERSPECTIVE_CONFIG.wallHeight, cameraX, cameraY);
        const innerTop2 = project3DPoint(innerP2[0], innerP2[1], PERSPECTIVE_CONFIG.wallHeight, cameraX, cameraY);
        
        // Calculate wall normal for this segment
        const wallNormalX = -(outerP2[1] - outerP1[1]);
        const wallNormalY = outerP2[0] - outerP1[0];
        const cameraDirX = cameraX - (outerP1[0] + outerP2[0]) / 2;
        const cameraDirY = cameraY - (outerP1[1] + outerP2[1]) / 2;
        const dotProduct = wallNormalX * cameraDirX + wallNormalY * cameraDirY;
        
        // Draw outer wall face (if facing away from camera)
        if (dotProduct < 0) {
            renderCtx.beginPath();
            renderCtx.moveTo(outerFloor1.x, outerFloor1.y);
            renderCtx.lineTo(outerFloor2.x, outerFloor2.y);
            renderCtx.lineTo(outerTop2.x, outerTop2.y);
            renderCtx.lineTo(outerTop1.x, outerTop1.y);
            renderCtx.closePath();
            
            renderCtx.fillStyle = wallColorDark + '90';
            renderCtx.fill();
            renderCtx.strokeStyle = wallColorDark;
            renderCtx.lineWidth = 1;
            renderCtx.stroke();
        }
        
        // Calculate inner wall normal
        const innerNormalX = -(innerP2[1] - innerP1[1]);
        const innerNormalY = innerP2[0] - innerP1[0];
        const innerCameraDirX = cameraX - (innerP1[0] + innerP2[0]) / 2;
        const innerCameraDirY = cameraY - (innerP1[1] + innerP2[1]) / 2;
        const innerDotProduct = innerNormalX * innerCameraDirX + innerNormalY * innerCameraDirY;
        
        // Draw inner wall face (if facing toward camera)
        if (innerDotProduct > 0) {
            renderCtx.beginPath();
            renderCtx.moveTo(innerFloor1.x, innerFloor1.y);
            renderCtx.lineTo(innerFloor2.x, innerFloor2.y);
            renderCtx.lineTo(innerTop2.x, innerTop2.y);
            renderCtx.lineTo(innerTop1.x, innerTop1.y);
            renderCtx.closePath();
            
            const gradient = renderCtx.createLinearGradient(
                (innerFloor1.x + innerFloor2.x) / 2, (innerFloor1.y + innerFloor2.y) / 2,
                (innerTop1.x + innerTop2.x) / 2, (innerTop1.y + innerTop2.y) / 2
            );
            gradient.addColorStop(0, wallColor + '80');
            gradient.addColorStop(1, wallColorMedium + '60');
            
            renderCtx.fillStyle = gradient;
            renderCtx.fill();
            renderCtx.strokeStyle = wallColor;
            renderCtx.lineWidth = 1;
            renderCtx.stroke();
        }
        
        // Draw wall top surface (showing thickness)
        renderCtx.beginPath();
        renderCtx.moveTo(outerTop1.x, outerTop1.y);
        renderCtx.lineTo(outerTop2.x, outerTop2.y);
        renderCtx.lineTo(innerTop2.x, innerTop2.y);
        renderCtx.lineTo(innerTop1.x, innerTop1.y);
        renderCtx.closePath();
        
        renderCtx.fillStyle = wallColorMedium + '70';
        renderCtx.fill();
        renderCtx.strokeStyle = wallColor;
        renderCtx.lineWidth = 1;
        renderCtx.stroke();
    }
    
    // Debug: visualize portal areas and skipped segments
    const DEBUG_PORTALS = false; // Set to false to disable debug
    if (DEBUG_PORTALS) {
        portals.forEach(portal => {
            const buffer = 5;
            const debugLeft = portal.x - portal.width/2 - buffer;
            const debugRight = portal.x + portal.width/2 + buffer;
            const debugTop = portal.y - portal.height/2 - buffer;
            const debugBottom = portal.y + portal.height/2 + buffer;
            
            // Draw portal area outline
            renderCtx.strokeStyle = '#ff0000';
            renderCtx.lineWidth = 2;
            renderCtx.strokeRect(debugLeft, debugTop, debugRight - debugLeft, debugBottom - debugTop);
            
            // Draw actual portal size
            renderCtx.strokeStyle = '#00ff00';
            renderCtx.lineWidth = 1;
            renderCtx.strokeRect(portal.x - portal.width/2, portal.y - portal.height/2, portal.width, portal.height);
        });
        
        // Show skipped wall segments
        for (let i = 0; i < outerPoints.length; i++) {
            const nextI = (i + 1) % outerPoints.length;
            const outerP1 = outerPoints[i];
            const outerP2 = outerPoints[nextI];
            
            if (segmentIntersectsPortal(outerP1, outerP2)) {
                renderCtx.strokeStyle = '#ffff00';
                renderCtx.lineWidth = 3;
                renderCtx.beginPath();
                renderCtx.moveTo(outerP1[0], outerP1[1]);
                renderCtx.lineTo(outerP2[0], outerP2[1]);
                renderCtx.stroke();
            }
        }
    }
    
    // Draw floor/playing surface (inner area)
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
    
    // Floor surface
    renderCtx.fillStyle = room.color + '15';
    renderCtx.fill();
    
    // Outer glow for floor edge
    renderCtx.strokeStyle = wallColor;
    renderCtx.lineWidth = room.type === 'frantic' ? 2 : 1;
    renderCtx.shadowColor = wallColor;
    renderCtx.shadowBlur = room.type === 'frantic' ? 8 : 5;
    renderCtx.stroke();
    renderCtx.shadowBlur = 0;
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
            
            draw3DPortal(tunnelCenterX, tunnelCenterY, tunnel.width, tunnel.height);
        });
    });
}

function draw3DPortal(centerX, centerY, width, height) {
    // Just draw the swirl effect - the wall opening is handled in wall rendering
    drawPortalSwirl(centerX, centerY, width, height);
}

function drawPortalSwirl(centerX, centerY, width, height) {
    // Deep space background
    renderCtx.save();
    const depthGradient = renderCtx.createRadialGradient(
        centerX, centerY, 0,
        centerX, centerY, Math.max(width, height) * 0.8
    );
    depthGradient.addColorStop(0, 'rgba(0, 30, 60, 0.9)');      // Deep blue center
    depthGradient.addColorStop(0.6, 'rgba(0, 15, 40, 0.7)');    // Darker
    depthGradient.addColorStop(1, 'rgba(0, 5, 20, 0.5)');       // Very dark edges
    
    renderCtx.fillStyle = depthGradient;
    renderCtx.fillRect(centerX - width, centerY - height, width * 2, height * 2);
    
    // Enhanced 3D swirl effect
    renderCtx.translate(centerX, centerY);
    
    // Multiple layered spirals for depth
    const spiralLayers = [
        { rotation: gameState.gameTime * 0.04, scale: 1.2, alpha: 0.8, color: 'rgba(0, 255, 255, ' },
        { rotation: gameState.gameTime * -0.03, scale: 0.8, alpha: 0.6, color: 'rgba(0, 200, 255, ' },
        { rotation: gameState.gameTime * 0.05, scale: 0.5, alpha: 0.9, color: 'rgba(100, 255, 255, ' }
    ];
    
    spiralLayers.forEach(layer => {
        renderCtx.save();
        renderCtx.rotate(layer.rotation);
        renderCtx.scale(layer.scale, layer.scale);
        
        // Animated spiral
        renderCtx.strokeStyle = layer.color + layer.alpha + ')';
        renderCtx.lineWidth = 2;
        renderCtx.beginPath();
        
        for (let i = 0; i < 30; i++) {
            const angle = i * 0.4;
            const radius = i * 2.5;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            
            if (i === 0) {
                renderCtx.moveTo(x, y);
            } else {
                renderCtx.lineTo(x, y);
            }
        }
        renderCtx.stroke();
        
        // Add spinning particles
        for (let i = 0; i < 10; i++) {
            const particleAngle = (gameState.gameTime * 0.02 + i * Math.PI * 2 / 10) * (layer.scale > 0.7 ? 1 : -1);
            const particleRadius = 20 + Math.sin(gameState.gameTime * 0.03 + i) * 8;
            const px = Math.cos(particleAngle) * particleRadius * layer.scale;
            const py = Math.sin(particleAngle) * particleRadius * layer.scale;
            
            renderCtx.beginPath();
            renderCtx.arc(px, py, 2 * layer.scale, 0, Math.PI * 2);
            renderCtx.fillStyle = layer.color + (layer.alpha * 0.9) + ')';
            renderCtx.fill();
        }
        
        renderCtx.restore();
    });
    
    renderCtx.restore();
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
    
    // No perspective scaling for players - they should be consistent size
    const perspectiveScale = 1.0;
    
    // Calculate tilt based on velocity
    const vx = character.vx || 0;
    const vy = character.vy || 0;
    const speed = Math.sqrt(vx * vx + vy * vy);
    const maxTilt = 0.4; // Maximum tilt amount (increased slightly)
    const tiltX = (vx / CONFIG.PLAYER_SPEED) * maxTilt;
    const tiltY = (vy / CONFIG.PLAYER_SPEED) * maxTilt;
    
    // Dynamic shadow based on movement direction and 3D height
    renderCtx.save();
    
    // Get character height (default 8px if not set)
    const characterHeight = character.z || 8;
    const heightFactor = characterHeight / 10; // Normalize to 0.8 for default height
    
    // Shadow opacity and size based on height
    renderCtx.globalAlpha = alpha * (0.4 + heightFactor * 0.3); // Higher = more opaque shadow
    renderCtx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    
    // Shadow offset based on height (higher objects cast longer shadows)
    const baseShadowOffset = (6 + heightFactor * 4) * perspectiveScale;
    const shadowOffsetX = baseShadowOffset - tiltX * 20 * perspectiveScale;
    const shadowOffsetY = baseShadowOffset - tiltY * 20 * perspectiveScale;
    
    // Shadow size based on height (higher = larger shadow)
    const heightShadowScale = 0.8 + heightFactor * 0.4;
    const shadowScaleX = (1.1 + Math.abs(tiltY) * 0.2) * perspectiveScale * heightShadowScale;
    const shadowScaleY = (1.1 + Math.abs(tiltX) * 0.2) * perspectiveScale * heightShadowScale;
    
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
    
    // Enhanced visuals when kicking with perspective scaling
    const basePaddleRadius = isKicking ? CONFIG.PADDLE_RADIUS + 5 : CONFIG.PADDLE_RADIUS;
    const paddleRadius = basePaddleRadius * perspectiveScale;
    
    // Calculate subtle squash effect based on movement (speed already calculated above)
    const squashAmount = Math.min(speed / 20, 0.15); // Max 15% squash, more subtle
    
    renderCtx.fillStyle = color;
    renderCtx.strokeStyle = color;
    renderCtx.lineWidth = (isActive ? 4 : 2) * perspectiveScale;
    // Removed glow effect (shadowBlur) for cleaner look
    
    renderCtx.save();
    
    // Apply 3D height offset
    const playerHeightOffset = characterHeight * 0.3; // Visual height offset for players
    renderCtx.translate(character.x, character.y - playerHeightOffset);
    
    // Apply perspective scaling first
    renderCtx.scale(perspectiveScale, perspectiveScale);
    
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
    
    // Draw the main character shape (using base radius since we already scaled)
    renderCtx.beginPath();
    renderCtx.arc(0, 0, basePaddleRadius, 0, Math.PI * 2);
    
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
    
    // Get perspective scale for puck
    const perspectiveScale = getPerspectiveScale(gameState.puck.y, renderCtx.canvas.height);
    
    // Special effect during portal transition
    if (gameState.portalTransition.active) {
        const elapsed = Date.now() - gameState.portalTransition.startTime;
        const progress = elapsed / gameState.portalTransition.duration;
        
        // Fade out/in effect
        renderCtx.globalAlpha = progress < 0.5 ? 1 - (progress * 2) : (progress - 0.5) * 2;
        
        // Portal energy effect around puck (scaled with perspective)
        const baseEnergyRadius = 30 + Math.sin(elapsed * 0.01) * 10;
        const energyRadius = baseEnergyRadius * perspectiveScale;
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
    
    // Puck shadow based on 3D height
    const puckHeight = gameState.puck.z || 0;
    const heightFactor = Math.max(0, puckHeight / 20); // Normalize height
    
    // Shadow gets larger and more offset when puck is higher
    const baseShadowOffset = (2 + heightFactor * 8) * perspectiveScale;
    const shadowRadius = CONFIG.PUCK_RADIUS * perspectiveScale * (1 + heightFactor * 0.5);
    const shadowOpacity = Math.max(0.2, 0.6 - heightFactor * 0.3); // Fade shadow when very high
    
    renderCtx.fillStyle = `rgba(0, 0, 0, ${shadowOpacity})`;
    renderCtx.beginPath();
    renderCtx.arc(gameState.puck.x + baseShadowOffset, gameState.puck.y + baseShadowOffset, shadowRadius, 0, Math.PI * 2);
    renderCtx.fill();
    
    // Main puck with rotation, perspective scaling, and 3D positioning
    const rotation = gameState.gameTime * 0.1;
    
    // Offset puck position based on height (pseudo-3D effect)
    const heightOffset = puckHeight * 0.5; // Visual height offset
    renderCtx.translate(gameState.puck.x, gameState.puck.y - heightOffset);
    renderCtx.scale(perspectiveScale, perspectiveScale);
    renderCtx.rotate(rotation);
    
    // Puck body - VERY bright and visible (using base radius since we already scaled)
    renderCtx.fillStyle = '#ffffff';
    renderCtx.strokeStyle = '#00ffff';
    renderCtx.lineWidth = 4;
    
    // Strong glow effect (scaled appropriately)
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