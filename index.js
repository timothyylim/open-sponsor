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
        console.log('\nAnalyzing stored directories:\n');
        
        // Track dependencies across all directories
        const dependencyUsage = new Map();
        let totalImportScore = 0;
        
        storedDirs.directories.forEach((dirPath) => {
            console.log(`\nAnalyzing ${dirPath}:`);
            
            // Analyze dependencies
            const dependencies = dependencyAnalyzer.analyzeDependencies(dirPath);
            if (dependencies.length > 0) {
                console.log('\nDependencies found:');
                dependencies.forEach(dep => {
                    console.log(`${dep.name}@${dep.version} - Used ${dep.count} times`);
                    
                    // Track detailed dependency usage
                    if (!dependencyUsage.has(dep.name)) {
                        dependencyUsage.set(dep.name, {
                            count: 0,
                            versions: new Set(),
                            dirs: new Set()
                        });
                    }
                    const usage = dependencyUsage.get(dep.name);
                    usage.count += dep.count;
                    usage.versions.add(dep.version);
                    usage.dirs.add(dirPath);
                });
            } else {
                console.log('No dependencies found or no package.json present');
            }
            
            // Analyze imports
            const imports = importAnalyzer.analyzeImports(dirPath);
            if (imports > 0) {
                console.log(`\nImport Analysis Score: ${imports}`);
                totalImportScore += imports;
            } else {
                console.log('\nNo imports found or unable to analyze imports');
            }
            
            const analysis = analyzeDirectory(dirPath);
            console.log(`\nOverall Analysis:`);
            console.log(`- File Count: ${analysis.fileCount}`);
            console.log(`- Directory Size: ${analysis.size} MB`);
            console.log(`- Overall Score: ${analysis.score}/100`);
        });

        // Create graphical ranking analysis
        console.log('\n=== DEPENDENCY USAGE RANKING ===');
        
        const maxBarLength = 30; // Reduced from 50
        const rankedDependencies = [...dependencyUsage.entries()]
            .sort((a, b) => b[1].count - a[1].count);
        
        // Find the highest count for scaling
        const maxCount = Math.max(...rankedDependencies.map(([_, data]) => data.count));
        
        // Display top dependencies with graphical bars
        console.log('─'.repeat(65)); // Reduced line length
        rankedDependencies.forEach(([name, data], index) => {
            const barLength = Math.round((data.count / maxCount) * maxBarLength);
            const bar = '█'.repeat(barLength) + '░'.repeat(maxBarLength - barLength);
            const percentage = ((data.count / maxCount) * 100).toFixed(1);
            
            console.log(`${(index + 1).toString().padStart(2)}. ${name.padEnd(15)} `
                + `${bar} ${data.count} (${percentage}%)`);
            console.log(`    v${[...data.versions].join(', ')} | ${data.dirs.size} dirs`);
        });
        console.log('─'.repeat(65));

        // Shorter summary
        console.log(`\nTotal Dependencies: ${dependencyUsage.size} | `
            + `Import Score: ${(totalImportScore / storedDirs.directories.length).toFixed(2)}`);

        rl.close();
        break;

    default:
        console.log('Unknown command. Available commands: list, analyze');
        rl.close();
        break;
}
