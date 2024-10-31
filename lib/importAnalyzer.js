const fs = require('fs');
const glob = require('glob');
const parser = require('@babel/parser');

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

        return importMap;

    } catch (error) {
        throw new Error(`Error analyzing imports: ${error.message}`);
    }
}

module.exports = { analyzeImports }; 