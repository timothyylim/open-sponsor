#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const CONFIG_FILE = path.join(__dirname, 'data', 'directories.json');
const dependencyAnalyzer = require('./lib/dependencyAnalyzer');
const importAnalyzer = require('./lib/importAnalyzer');

// Create readline interface
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Ensure config file exists
if (!fs.existsSync(CONFIG_FILE)) {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify({ directories: [] }));
}

// Read stored directories
function getStoredDirectories() {
    const data = fs.readFileSync(CONFIG_FILE);
    return JSON.parse(data);
}

// Save new directory
function saveDirectory(dirPath) {
    const data = getStoredDirectories();
    if (!data.directories.includes(dirPath)) {
        data.directories.push(dirPath);
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2));
    }
}

// Add this helper function
function expandTilde(filePath) {
    if (filePath[0] === '~') {
        return path.join(process.env.HOME || process.env.USERPROFILE, filePath.slice(1));
    }
    return filePath;
}

// Add these helper functions
function analyzeDirectory(dirPath) {
    try {
        const stats = fs.statSync(dirPath);
        const files = fs.readdirSync(dirPath);
        
        // Calculate score based on various factors
        let score = 0;
        
        // Basic existence and accessibility: 10 points
        score += 10;
        
        // Number of files (1 point per file, max 30)
        score += Math.min(files.length, 30);
        
        // Directory size factor (1 point per MB, max 30)
        const dirSize = stats.size / (1024 * 1024); // Convert to MB
        score += Math.min(Math.floor(dirSize), 30);
        
        // Age factor (newer directories get more points, max 30)
        const ageInDays = (Date.now() - stats.birthtime) / (1000 * 60 * 60 * 24);
        score += Math.max(30 - Math.floor(ageInDays / 30), 0);
        
        // Add dependency and import analysis scores
        const dependencyScore = dependencyAnalyzer.analyzeDependencies(dirPath) || [];
        const importScore = importAnalyzer.analyzeImports(dirPath);
        
        score += Math.min(dependencyScore.length * 3, 15); // Max 15 points for dependencies
        score += Math.min(importScore, 15); // Max 15 points for imports

        return {
            path: dirPath,
            fileCount: files.length,
            size: dirSize.toFixed(2),
            dependencyScore,
            importScore,
            score: Math.min(score, 100)
        };
    } catch (error) {
        return {
            path: dirPath,
            error: error.message,
            score: 0
        };
    }
}

// Handle commands
const command = process.argv[2];

switch (command) {
    case 'list':
        const data = getStoredDirectories();
        console.log('\nStored directories:');
        data.directories.forEach((dir, index) => {
            console.log(`${index + 1}. ${dir}`);
        });
        rl.close();
        break;

    case undefined:
        console.log('Welcome to Directory Analyzer!');
        rl.question('Please enter the path to the directory you want to analyze: ', (dirPath) => {
            const expandedPath = expandTilde(dirPath);
            const absolutePath = path.resolve(expandedPath);
            
            if (fs.existsSync(absolutePath)) {
                saveDirectory(absolutePath);
                console.log(`Directory "${absolutePath}" has been saved!`);
            } else {
                console.log('Error: Directory does not exist!');
            }
            rl.close();
        });
        break;

    case 'analyze':
        const storedDirs = getStoredDirectories();
        console.log('\nAnalyzing directories...\n');
        
        const results = storedDirs.directories.map(analyzeDirectory);
        
        // Sort results by score (highest first)
        results.sort((a, b) => b.score - a.score);
        
        // Display results
        results.forEach((result, index) => {
            if (result.error) {
                console.log(`${index + 1}. ${result.path}`);
                console.log(`   Error: ${result.error}`);
                console.log(`   Score: 0/100\n`);
            } else {
                console.log(`${index + 1}. ${result.path}`);
                console.log(`   Files: ${result.fileCount}`);
                console.log(`   Size: ${result.size} MB`);
                console.log('   Top Dependencies:');
                if (result.dependencyScore && result.dependencyScore.length > 0) {
                    result.dependencyScore.forEach(dep => {
                        console.log(`     - ${dep.name} v${dep.version} (${dep.count} references)`);
                    });
                } else {
                    console.log('     No dependencies found');
                }
                console.log(`   Import Score: ${result.importScore}/15`);
                console.log(`   Total Score: ${result.score}/100\n`);
            }
        });
        rl.close();
        break;

    default:
        console.log('Unknown command. Available commands: list, analyze');
        rl.close();
        break;
}
