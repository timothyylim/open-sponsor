const fs = require('fs');
const path = require('path');
const glob = require('glob');

function createBarChart(dependencies) {
    if (dependencies.length === 0) return 'No dependencies found';
    
    const maxNameLength = Math.max(...dependencies.map(d => d.name.length));
    const maxCount = Math.max(...dependencies.map(d => d.count));
    const barLength = 30; // Reduced from 50 to 30
    
    return dependencies.map(dep => {
        const normalizedCount = Math.round((dep.count / maxCount) * barLength);
        const bar = '─'.repeat(normalizedCount);
        return `${dep.name.padEnd(maxNameLength)} |${bar}${dep.count}`;  // Removed parentheses and space
    }).join('\n');
}

function analyzeDependencies(dirPath) {
    try {
        const packageJsonPath = path.join(dirPath, 'package.json');
        
        // Check if package.json exists
        if (!fs.existsSync(packageJsonPath)) {
            return [];
        }

        // Read and parse package.json
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        const allDependencies = {
            ...packageJson.dependencies || {},
            ...packageJson.devDependencies || {}
        };

        // Initialize dependency usage counts
        const dependencyUsage = {};
        Object.keys(allDependencies).forEach(dep => {
            dependencyUsage[dep] = 0;
        });

        // Find all JS files in the directory, excluding node_modules
        const files = glob.sync('**/*.{js,jsx,ts,tsx}', {
            cwd: dirPath,
            ignore: ['**/node_modules/**', '**/dist/**', '**/build/**'],
            absolute: true
        });

        // Count dependency usage in each file
        files.forEach(file => {
            const content = fs.readFileSync(file, 'utf8');
            Object.keys(allDependencies).forEach(dep => {
                // Check for require statements
                const requireCount = (content.match(new RegExp(`require\\(['"](${dep}|${dep}\\/.+)['"]\\)`, 'g')) || []).length;
                // Check for import statements
                const importCount = (content.match(new RegExp(`from\\s+['"](${dep}|${dep}\\/.+)['"]`, 'g')) || []).length;
                dependencyUsage[dep] += requireCount + importCount;
            });
        });

        // Convert dependencies to array format with actual usage counts
        const dependencies = Object.entries(allDependencies)
            .map(([name, version]) => ({
                name,
                version: version.replace(/[\^~]/g, ''), // Remove ^ and ~ from version numbers
                count: dependencyUsage[name]
            }))
            .filter(dep => dep.count > 0); // Only include dependencies with usage count > 0

        // Sort by usage count in descending order
        const sortedDeps = dependencies.sort((a, b) => b.count - a.count);
        
        // Add the bar chart to the console output
        console.log('\nDependency Usage Chart:');
        console.log(createBarChart(sortedDeps));
        
        return sortedDeps;

    } catch (error) {
        console.error(`Error analyzing dependencies: ${error.message}`);
        return [];
    }
}

module.exports = {
    analyzeDependencies,
    createBarChart
}; 