const fs = require('fs');
const glob = require('glob');
const parser = require('@babel/parser');

/**
 * This module analyzes import statements in a JavaScript/TypeScript project.
 * It scans all JS/TS files in a given project directory and:
 * - Finds all non-relative import statements (e.g. from node modules)
 * - Tracks how many times each package is imported
 * - Records which files import each package
 * - Notes if imports appear in entry point files (index.js, main.js etc)
 * 
 * The returned importMap contains for each imported package:
 * - count: Number of times the package is imported
 * - files: List of files that import the package
 * - isInEntryPoint: Whether the package is imported in an entry point file
 */
function analyzeImports(projectPath) {
    try {
        // Find all JS/TS files
        const files = glob.sync('**/*.{js,jsx,ts,tsx}', {
            cwd: projectPath,
            ignore: ['node_modules/**', 'dist/**', 'build/**']
        });

        const importMap = {};
        const entryPoints = new Set(['index.js', 'main.js', 'server.js', 'app.js']);

        files.forEach(file => {
            const fullPath = `${projectPath}/${file}`;
            const content = fs.readFileSync(fullPath, 'utf-8');
            
            try {
                // Parse the file
                const ast = parser.parse(content, {
                    sourceType: 'module',
                    plugins: ['jsx', 'typescript']
                });

                // Analyze imports
                ast.program.body.forEach(node => {
                    if (node.type === 'ImportDeclaration') {
                        const packageName = node.source.value;
                        
                        // Skip relative imports
                        if (packageName.startsWith('.')) return;
                        
                        if (!importMap[packageName]) {
                            importMap[packageName] = {
                                count: 0,
                                files: [],
                                isInEntryPoint: false
                            };
                        }
                        
                        importMap[packageName].count++;
                        importMap[packageName].files.push(file);
                        
                        // Check if this is an entry point
                        if (entryPoints.has(file)) {
                            importMap[packageName].isInEntryPoint = true;
                        }
                    }
                });
            } catch (parseError) {
                console.warn(`Warning: Could not parse ${file}: ${parseError.message}`);
            }
        });

        // Convert importMap to an array and sort by count
        const sortedImports = Object.entries(importMap)
            .map(([name, data]) => ({
                name,
                count: data.count,
                isInEntryPoint: data.isInEntryPoint
            }))
            .sort((a, b) => b.count - a.count);

        // Display ASCII bar chart
        console.log('\nImport Usage Chart:');
        console.log(createBarChart(sortedImports));

        return importMap;

    } catch (error) {
        throw new Error(`Error analyzing imports: ${error.message}`);
    }
}

/**
 * Creates an ASCII bar chart for dependency usage
 * @param {Array} imports - Array of import data sorted by usage count
 * @returns {string} - ASCII bar chart as a formatted string
 */
function createBarChart(imports) {
    if (imports.length === 0) return 'No imports found';

    const maxNameLength = Math.max(...imports.map(dep => dep.name.length));
    const maxCount = Math.max(...imports.map(dep => dep.count));
    const barLength = 30; // Max length of the bar

    return imports.map(dep => {
        const normalizedCount = Math.round((dep.count / maxCount) * barLength);
        const bar = '─'.repeat(normalizedCount);
        const entryPointMarker = dep.isInEntryPoint ? '*' : ''; // Mark if in entry point
        return `${dep.name.padEnd(maxNameLength)} |${bar} ${dep.count} ${entryPointMarker}`;
    }).join('\n');
}

module.exports = { analyzeImports };
