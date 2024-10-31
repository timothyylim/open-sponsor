function calculateScore(depData, importData) {
    const scores = {};
    
    // Weight factors (adjust these based on importance)
    const weights = {
        directDependency: 30,    // Direct dependencies get a base score
        dependencyUsage: 20,     // How often it appears in dependency tree
        importCount: 25,         // How often it's imported in code
        entryPointBonus: 25      // Bonus for being in entry points
    };

    // Validate inputs
    if (!Array.isArray(depData)) {
        throw new Error('depData must be an array');
    }
    if (!importData || typeof importData !== 'object') {
        throw new Error('importData must be an object');
    }
    if (!Array.isArray(importData.directDeps)) {
        throw new Error('importData.directDeps must be an array');
    }
    if (!Array.isArray(importData.importAnalysis)) {
        throw new Error('importData.importAnalysis must be an array');
    }

    // Score from dependency analysis
    depData.forEach(([pkg, count]) => {
        scores[pkg] = scores[pkg] || 0;
        scores[pkg] += (count * weights.dependencyUsage) / 10;
    });

    // Score from direct dependencies
    importData.directDeps.forEach(dep => {
        scores[dep] = scores[dep] || 0;
        scores[dep] += weights.directDependency;
    });

    // Score from import analysis
    importData.importAnalysis.forEach(({ package: pkg, usageCount, isInEntryPoint }) => {
        scores[pkg] = scores[pkg] || 0;
        scores[pkg] += (usageCount * weights.importCount) / 5;
        if (isInEntryPoint) {
            scores[pkg] += weights.entryPointBonus;
        }
    });

    // Convert to array and sort by score
    return Object.entries(scores)
        .map(([pkg, score]) => ({
            package: pkg,
            score: Math.round(score),
            details: {
                isDirect: importData.directDeps.includes(pkg),
                importCount: importData.importAnalysis.find(i => i.package === pkg)?.usageCount || 0,
                isInEntryPoint: importData.importAnalysis.find(i => i.package === pkg)?.isInEntryPoint || false,
                dependencyCount: depData.find(([name]) => name === pkg)?.[1] || 0
            }
        }))
        .sort((a, b) => b.score - a.score);
}

module.exports = { calculateScore }; 