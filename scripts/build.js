#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🏗️  Building Projectyle 3000...');

// For now, just copy the single file to dist
// Later this will combine modules

const srcFile = path.join(__dirname, '..', 'index.html');
const distDir = path.join(__dirname, '..', 'dist');
const distFile = path.join(distDir, 'index.html');

// Create dist directory if it doesn't exist
if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
}

try {
    // Read the source file
    const content = fs.readFileSync(srcFile, 'utf8');
    
    // Later we'll add:
    // - Module combination
    // - Minification
    // - Source maps
    
    // For now, just copy
    fs.writeFileSync(distFile, content);
    
    // Copy any assets (if they exist)
    const assetsDir = path.join(__dirname, '..', 'assets');
    if (fs.existsSync(assetsDir)) {
        const distAssetsDir = path.join(distDir, 'assets');
        if (!fs.existsSync(distAssetsDir)) {
            fs.mkdirSync(distAssetsDir, { recursive: true });
        }
        // Copy assets...
    }
    
    console.log('✅ Build complete! Output in dist/index.html');
    console.log(`📦 File size: ${(content.length / 1024).toFixed(2)} KB`);
    
} catch (error) {
    console.error('❌ Build failed:', error.message);
    process.exit(1);
}