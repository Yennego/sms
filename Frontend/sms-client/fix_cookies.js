const fs = require('fs');
const path = require('path');

const apiDir = path.join(__dirname, 'src', 'app', 'api');
let totalUpdated = 0;

function walkDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath);
    } else if (entry.name === 'route.ts') {
      processFile(fullPath);
    }
  }
}

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  const original = content;

  // Replace all variations of direct accessToken cookie reads
  content = content.replace(/cookieStore\.get\('accessToken'\)\?\.value/g, 'getAccessToken(cookieStore)');
  content = content.replace(/cookieStore\.get\('tn_accessToken'\)\?\.value/g, 'getAccessToken(cookieStore)');
  content = content.replace(/cookieStore\.get\('sa_accessToken'\)\?\.value/g, 'getAccessToken(cookieStore)');
  
  // Clean up duplicate calls like: getAccessToken(cookieStore) || getAccessToken(cookieStore)
  content = content.replace(/getAccessToken\(cookieStore\)\s*\|\|\s*getAccessToken\(cookieStore\)/g, 'getAccessToken(cookieStore)');

  if (content === original) return;

  // Add import if needed
  if (content.includes('getAccessToken(cookieStore)') && !content.includes('getAccessToken')) {
    // This shouldn't happen after replacement, but just in case
  }
  
  if (content.includes('getAccessToken(cookieStore)')) {
    // Check if import already exists
    if (!content.match(/import\s+\{[^}]*getAccessToken[^}]*\}\s+from\s+['"]@\/lib\/cookies['"]/)) {
      // Check if there's an existing import from @/lib/cookies
      const cookiesImportMatch = content.match(/import\s+\{([^}]+)\}\s+from\s+['"]@\/lib\/cookies['"]/);
      if (cookiesImportMatch) {
        const existingImports = cookiesImportMatch[1];
        if (!existingImports.includes('getAccessToken')) {
          const newImport = `import {${existingImports}, getAccessToken } from '@/lib/cookies'`;
          content = content.replace(/import\s+\{[^}]+\}\s+from\s+['"]@\/lib\/cookies['"]/, newImport);
        }
      } else {
        // Add a new import line after the last import
        const lines = content.split('\n');
        let lastImportLine = -1;
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].trim().startsWith('import ')) lastImportLine = i;
        }
        if (lastImportLine >= 0) {
          lines.splice(lastImportLine + 1, 0, "import { getAccessToken } from '@/lib/cookies';");
          content = lines.join('\n');
        }
      }
    }
  }

  fs.writeFileSync(filePath, content, 'utf-8');
  totalUpdated++;
  const rel = path.relative(apiDir, filePath);
  console.log(`Updated: ${rel}`);
}

walkDir(apiDir);
console.log(`\nTotal files updated: ${totalUpdated}`);
