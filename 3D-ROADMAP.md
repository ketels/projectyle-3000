# 3D Roadmap för Projectyle 3000

Detta dokument beskriver olika sätt att ge spelet en mer professionell 3D-känsla.

## Alternativ 1: Pseudo-3D med Canvas 2D (Rekommenderat att börja med)

### Implementeringssteg:

#### 1. Djup-sortering (Z-order)
```javascript
// Sortera alla objekt baserat på Y-position
const renderOrder = [...players, puck, ...powerups].sort((a, b) => a.y - b.y);
renderOrder.forEach(obj => drawObject(obj));
```

#### 2. Perspektiv-skalning
```javascript
function getPerspectiveScale(y) {
    const horizon = canvas.height * 0.3;
    const scale = 0.5 + (y - horizon) / canvas.height;
    return Math.max(0.3, Math.min(1.2, scale));
}

// Applicera på objekt
const scale = getPerspectiveScale(object.y);
ctx.scale(scale, scale);
```

#### 3. Dynamiska skuggor med ljuskälla
```javascript
function draw3DShadow(object) {
    const lightSource = { x: canvas.width/2, y: -500, z: 1000 };
    
    // Beräkna skuggposition baserat på objektets höjd (z)
    const shadowOffsetX = (object.x - lightSource.x) * (object.z / lightSource.z);
    const shadowOffsetY = (object.y - lightSource.y) * (object.z / lightSource.z);
    
    // Skuggans transparens baserat på höjd
    const shadowAlpha = 0.5 * (1 - object.z / 100);
    
    ctx.save();
    ctx.globalAlpha = shadowAlpha;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    
    // Rita elliptisk skugga
    ctx.translate(object.x + shadowOffsetX, object.y + shadowOffsetY);
    ctx.scale(1 + object.z/100, 0.5 + object.z/200);
    ctx.beginPath();
    ctx.arc(0, 0, object.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}
```

#### 4. Höjdmekanik för puck
```javascript
// Lägg till z-koordinat och z-hastighet
gameState.puck = {
    x: 0, y: 0, z: 0,
    vx: 0, vy: 0, vz: 0,
    gravity: 0.5
};

// Vid spark
function kick3D(player, puck) {
    const kickPower = calculateKickPower(player);
    puck.vz = kickPower * 0.3; // Lyft pucken
}

// I physics update
puck.z += puck.vz;
puck.vz -= puck.gravity;
if (puck.z <= 0) {
    puck.z = 0;
    puck.vz *= -0.5; // Studs
}
```

#### 5. Is-reflektioner
```javascript
function drawIceReflection(object) {
    ctx.save();
    ctx.globalAlpha = 0.2;
    ctx.scale(1, -0.5);
    ctx.translate(0, -object.y * 2 - object.z);
    drawObject(object); // Rita objektet upp-och-ned
    ctx.restore();
}
```

#### 6. Perspektiv för spelplanen
```javascript
function drawRinkWithPerspective() {
    const vanishingPoint = { x: canvas.width/2, y: -200 };
    
    // Rita linjer som konvergerar mot vanishing point
    ctx.beginPath();
    // Vänster sida
    ctx.moveTo(100, canvas.height);
    ctx.lineTo(vanishingPoint.x - 50, vanishingPoint.y);
    // Höger sida
    ctx.moveTo(canvas.width - 100, canvas.height);
    ctx.lineTo(vanishingPoint.x + 50, vanishingPoint.y);
    ctx.stroke();
}
```

## Alternativ 2: Three.js Implementation

### Fördelar:
- Riktig 3D med WebGL
- Avancerade ljus- och skuggeffekter
- Partikeleffekter
- Kamerarotation och zoom

### Kodexempel:
```javascript
// Setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 0.1, 1000);
camera.position.set(0, 300, 400);
camera.lookAt(0, 0, 0);

// Ljus
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
const spotLight = new THREE.SpotLight(0xffffff, 0.8);
spotLight.position.set(0, 500, 0);
spotLight.castShadow = true;

// Is-yta
const rinkGeometry = new THREE.PlaneGeometry(1000, 1000);
const rinkMaterial = new THREE.MeshPhongMaterial({
    color: 0xccddff,
    shininess: 100,
    reflectivity: 0.8
});
const rink = new THREE.Mesh(rinkGeometry, rinkMaterial);
rink.rotation.x = -Math.PI / 2;

// Puck
const puckGeometry = new THREE.CylinderGeometry(10, 10, 5, 16);
const puckMaterial = new THREE.MeshPhongMaterial({
    color: 0x000000,
    shininess: 150
});
const puck = new THREE.Mesh(puckGeometry, puckMaterial);
puck.castShadow = true;
```

## Alternativ 3: CSS3D + Canvas Hybrid

### Fördelar:
- Behåll spellogik
- Lägg till 3D-transforms på canvas
- Enkel implementation

### Exempel:
```css
.game-container {
    perspective: 1000px;
    transform-style: preserve-3d;
}

#gameCanvas {
    transform: rotateX(45deg) translateZ(-100px);
    transition: transform 0.3s ease;
}

/* Dynamisk kamerarörelse */
#gameCanvas.action {
    transform: rotateX(40deg) translateZ(-80px) rotateZ(2deg);
}
```

## Prestandaoptimering för 3D

### 1. Level-of-detail (LOD)
- Färre detaljer för objekt långt bort
- Enklare skuggor i bakgrunden

### 2. Culling
- Rita inte objekt utanför kamerans vy
- Skippa små detaljer när mycket händer

### 3. Object pooling
- Återanvänd partikelobjekt
- Förhindra garbage collection

## Visuella förbättringar

### 1. Partikelsystem
- Is-spray när spelare bromsar
- Gnistor vid hårda kollisioner
- Rök/dimma effekter

### 2. Ljuseffekter
- Strålkastare från taket
- Neon-glöd på UI element
- Lens flares

### 3. Post-processing
- Motion blur
- Bloom effekt
- Chromatic aberration

## Implementation prioritering

1. **Fas 1**: Perspektiv och skalning
2. **Fas 2**: Dynamiska skuggor och ljus
3. **Fas 3**: Höjdmekanik (z-axel)
4. **Fas 4**: Reflektioner och polish
5. **Fas 5**: Överväg ramverksbyte om nödvändigt

## Resurser

- [Three.js dokumentation](https://threejs.org/docs/)
- [Canvas 2D perspektiv tutorial](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Transformations)
- [WebGL fundamentals](https://webglfundamentals.org/)