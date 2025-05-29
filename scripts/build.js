#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🏗️  Building Projectyle 3000...');

const srcDir = path.join(__dirname, '..', 'src');
const distDir = path.join(__dirname, '..', 'dist');

// Create dist directory if it doesn't exist
if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
}

try {
    // Read all JavaScript modules
    const jsFiles = [
        'config.js',
        'utils.js',
        'gameState.js',
        'physics.js',
        'ai.js',
        'powerups.js',
        'faceoff.js',
        'input.js',
        'rendering.js',
        'main.js'
    ];
    
    let combinedJS = '';
    const moduleExports = new Map();
    const moduleImports = new Map();
    
    // First pass: collect all exports and imports
    jsFiles.forEach(file => {
        const filePath = path.join(srcDir, 'js', file);
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf8');
            
            // Track exports
            const exportMatches = content.matchAll(/export\s+(?:const|function|let|var)\s+(\w+)/g);
            for (const match of exportMatches) {
                moduleExports.set(match[1], file);
            }
            
            // Track imports
            const importMatches = content.matchAll(/import\s+{([^}]+)}\s+from\s+['"]\.\/(\w+)\.js['"]/g);
            for (const match of importMatches) {
                const imports = match[1].split(',').map(s => s.trim());
                moduleImports.set(file, { imports, from: match[2] + '.js' });
            }
        }
    });
    
    // Second pass: combine files and remove import/export statements
    jsFiles.forEach(file => {
        const filePath = path.join(srcDir, 'js', file);
        if (fs.existsSync(filePath)) {
            let content = fs.readFileSync(filePath, 'utf8');
            
            // Remove import statements
            content = content.replace(/import\s+{[^}]+}\s+from\s+['"][^'"]+['"]\s*;?\s*\n?/g, '');
            
            // Remove export keywords
            content = content.replace(/export\s+(const|function|let|var)/g, '$1');
            
            // Add file header comment
            combinedJS += `\n// ========== ${file} ==========\n`;
            combinedJS += content;
        }
    });
    
    // Read HTML template
    const htmlPath = path.join(srcDir, 'index.html');
    let htmlContent = fs.readFileSync(htmlPath, 'utf8');
    
    // Read CSS
    const cssPath = path.join(srcDir, 'css', 'styles.css');
    const cssContent = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf8') : '';
    
    // Create single-file HTML
    const scriptTag = '<script type="module" src="js/main.js"></script>';
    const combinedHTML = htmlContent
        .replace('<link rel="stylesheet" href="css/styles.css">', `<style>\n${cssContent}\n</style>`)
        .replace(scriptTag, `<script>\n${combinedJS}\n</script>`);
    
    // Write combined file
    const outputPath = path.join(distDir, 'index.html');
    fs.writeFileSync(outputPath, combinedHTML);
    
    console.log('✅ Build complete! Output in dist/index.html');
    console.log(`📦 File size: ${(combinedHTML.length / 1024).toFixed(2)} KB`);
    
    // Validate the build
    validateBuild(combinedHTML);
    
} catch (error) {
    console.error('❌ Build failed:', error.message);
    process.exit(1);
}

function validateBuild(content) {
    const requiredFunctions = [
        'gameLoop',
        'init',
        'updatePuck',
        'drawCharacter'
    ];
    
    let missingFunctions = [];
    for (const func of requiredFunctions) {
        if (!content.includes(`function ${func}`)) {
            missingFunctions.push(func);
        }
    }
    
    if (missingFunctions.length > 0) {
        console.warn('⚠️  Warning: Missing functions:', missingFunctions.join(', '));
    }
    
    // Check for syntax errors
    try {
        new Function(content.match(/<script>([\s\S]*?)<\/script>/)?.[1] || '');
        console.log('✅ Syntax validation passed');
    } catch (error) {
        console.error('❌ Syntax error in built file:', error.message);
    }
}