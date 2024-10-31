const fs = require('fs');
const path = require('path');

function analyzeDependencies(dirPath) {
    try {
        // Read package.json
        const packagePath = path.join(dirPath, 'package.json');
        if (!fs.existsSync(packagePath)) return null;
        
        const packageJson = JSON.parse(fs.readFileSync(packagePath));
        const dependencies = [
            ...Object.keys(packageJson.dependencies || {}),
            ...Object.keys(packageJson.devDependencies || {})
        ];

        // Count dependency usage in all JS files
        const depUsageCount = {};
        dependencies.forEach(dep => depUsageCount[dep] = 0);

        // Recursively find all JS files
        function scanDir(currentPath) {
            const files = fs.readdirSync(currentPath);
            files.forEach(file => {
                const filePath = path.join(currentPath, file);
                const stat = fs.statSync(filePath);

                if (stat.isDirectory() && !file.includes('node_modules')) {
                    scanDir(filePath);
                } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
                    const content = fs.readFileSync(filePath, 'utf8');
                    dependencies.forEach(dep => {
                        // Count both require and import statements
                        const requireCount = (content.match(new RegExp(`require\\(['"']${dep}['"']\\)`, 'g')) || []).length;
                        const importCount = (content.match(new RegExp(`from\\s+['"']${dep}['"']`, 'g')) || []).length;
                        depUsageCount[dep] += requireCount + importCount;
                    });
                }
            });
        }

        scanDir(dirPath);

        // Find most used dependency
        let maxUsage = 0;
        let mostImportantDep = null;

        for (const [dep, count] of Object.entries(depUsageCount)) {
            if (count > maxUsage) {
                maxUsage = count;
                mostImportantDep = dep;
            }
        }

        return mostImportantDep;
    } catch (error) {
        console.error('Error analyzing dependencies:', error.message);
        return null;
    }
}

module.exports = { analyzeDependencies }; 