#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🧪 Running tests for Projectyle 3000...\n');

let passed = 0;
let failed = 0;

// Test 1: Check if main file exists
function testFileExists() {
    const file = path.join(__dirname, '..', 'index.html');
    if (fs.existsSync(file)) {
        console.log('✅ Main file exists');
        passed++;
    } else {
        console.log('❌ Main file missing');
        failed++;
    }
}

// Test 2: Check for syntax errors
function testSyntax() {
    try {
        const content = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
        
        // Extract JavaScript content
        const scriptMatch = content.match(/<script>([\s\S]*?)<\/script>/);
        if (!scriptMatch) {
            console.log('❌ No JavaScript found');
            failed++;
            return;
        }
        
        const jsContent = scriptMatch[1];
        
        // Basic syntax checks
        const openBraces = (jsContent.match(/{/g) || []).length;
        const closeBraces = (jsContent.match(/}/g) || []).length;
        
        if (openBraces !== closeBraces) {
            console.log(`❌ Mismatched braces: ${openBraces} open, ${closeBraces} close`);
            failed++;
            return;
        }
        
        // Check for common errors
        if (jsContent.includes('console.error')) {
            console.log('⚠️  Warning: console.error found in code');
        }
        
        console.log('✅ Syntax check passed');
        passed++;
        
    } catch (error) {
        console.log('❌ Syntax check failed:', error.message);
        failed++;
    }
}

// Test 3: Check critical game functions exist
function testGameFunctions() {
    try {
        const content = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
        
        const requiredFunctions = [
            'init',
            'gameLoop',
            'updatePuck',
            'drawCharacter',
            'updateAI',
            'tryKick'
        ];
        
        let allFound = true;
        for (const func of requiredFunctions) {
            if (!content.includes(`function ${func}`)) {
                console.log(`❌ Missing function: ${func}`);
                failed++;
                allFound = false;
            }
        }
        
        if (allFound) {
            console.log('✅ All critical functions found');
            passed++;
        }
        
    } catch (error) {
        console.log('❌ Function check failed:', error.message);
        failed++;
    }
}

// Test 4: Check CONFIG object
function testConfig() {
    try {
        const content = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
        
        if (content.includes('const CONFIG = {')) {
            console.log('✅ CONFIG object found');
            passed++;
            
            // Check critical config values
            const configChecks = ['PLAYER_SPEED', 'MAX_PUCK_SPEED', 'FRICTION'];
            for (const check of configChecks) {
                if (!content.includes(check)) {
                    console.log(`⚠️  Warning: CONFIG.${check} not found`);
                }
            }
        } else {
            console.log('❌ CONFIG object missing');
            failed++;
        }
        
    } catch (error) {
        console.log('❌ Config check failed:', error.message);
        failed++;
    }
}

// Run all tests
console.log('Running tests...\n');
testFileExists();
testSyntax();
testGameFunctions();
testConfig();

// Summary
console.log('\n' + '='.repeat(40));
console.log(`Tests completed: ${passed} passed, ${failed} failed`);

if (failed > 0) {
    console.log('\n❌ Tests failed! Please fix the errors above.');
    process.exit(1);
} else {
    console.log('\n✅ All tests passed!');
    process.exit(0);
}