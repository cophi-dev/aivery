#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { glob } = require('glob');
const util = require('util');

// Promisify fs functions
const readFilePromise = util.promisify(fs.readFile);
const mkdirPromise = util.promisify(fs.mkdir);
const writeFilePromise = util.promisify(fs.writeFile);

// Configuration
const CONFIG = {
  filePatterns: ['**/*.js', '**/*.ts', '**/*.jsx', '**/*.tsx'],
  excludeDirs: ['node_modules', '.next', 'public', 'out', 'dist', '.git'],
  outputDir: 'docs',
  outputFile: 'codebase-overview.md',
};

/**
 * Extract the first comment block from file content
 * @param {string} content - File content
 * @returns {string} - Extracted comment or empty string
 */
function extractComment(content) {
  // Match block comments
  const blockCommentRegex = /\/\*\*([\s\S]*?)\*\//;
  const blockMatch = content.match(blockCommentRegex);
  
  // Match single line comments at the start (consecutive lines)
  const lineCommentRegex = /^(\/\/.*\n)+/m;
  const lineMatch = content.match(lineCommentRegex);
  
  if (blockMatch) {
    // Clean up the block comment
    return blockMatch[1]
      .replace(/\n\s*\*/g, '\n') // Remove * at the start of lines
      .trim();
  } else if (lineMatch) {
    // Clean up line comments
    return lineMatch[0]
      .replace(/\/\//g, '')
      .trim();
  }
  
  return '';
}

/**
 * Extract the main export from file content
 * @param {string} content - File content
 * @returns {string} - Extracted export name or empty string
 */
function extractExport(content) {
  // Check for default exports
  const defaultExportRegex = /export\s+default\s+(?:function\s+)?([A-Za-z0-9_$]+)/;
  const defaultExportMatch = content.match(defaultExportRegex);
  
  // Check for default class exports
  const defaultClassRegex = /export\s+default\s+class\s+([A-Za-z0-9_$]+)/;
  const defaultClassMatch = content.match(defaultClassRegex);
  
  // Check for named exports
  const namedExportRegex = /export\s+(?:const|let|var|function|class)\s+([A-Za-z0-9_$]+)/;
  const namedExportMatch = content.match(namedExportRegex);
  
  // Check for direct default export of variable
  const variableExportRegex = /const\s+([A-Za-z0-9_$]+).*\nexport\s+default\s+\1/s;
  const variableExportMatch = content.match(variableExportRegex);
  
  if (defaultExportMatch) {
    return defaultExportMatch[1] + ' (default)';
  } else if (defaultClassMatch) {
    return defaultClassMatch[1] + ' (default class)';
  } else if (variableExportMatch) {
    return variableExportMatch[1] + ' (default)';
  } else if (namedExportMatch) {
    return namedExportMatch[1] + ' (named)';
  }
  
  return '';
}

/**
 * Check if a file is imported anywhere in the project
 * @param {string} filePath - Path to the file
 * @param {string[]} allFiles - List of all files in the project
 * @returns {string} - Status emoji (✅, ❓, or ❌)
 */
async function checkImportStatus(filePath, allFiles) {
  // Get the file name without extension for import checking
  const fileNameNoExt = path.basename(filePath).replace(/\.(js|ts|jsx|tsx)$/, '');
  
  // Escape special characters for regex
  const escapedFileName = fileNameNoExt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  // Import patterns to look for
  const importPatterns = [
    `import\\s+.*?${escapedFileName}`,
    `import\\s+.*?from\\s+['"].*?${escapedFileName}['"]`,
    `require\\(['"].*?${escapedFileName}['"]\\)`,
  ];
  
  let isImported = false;
  let hasError = false;
  
  // Check if the file is imported in any other file
  for (const otherFile of allFiles) {
    if (otherFile === filePath) continue;
    
    try {
      const content = await readFilePromise(otherFile, 'utf8');
      
      // Check for imports
      for (const pattern of importPatterns) {
        const regex = new RegExp(pattern, 'i');
        if (regex.test(content)) {
          isImported = true;
          break;
        }
      }
      
      // Exit early if we found an import
      if (isImported) break;
    } catch (err) {
      hasError = true;
      console.error(`Error reading file ${otherFile}: ${err.message}`);
    }
  }
  
  // Return status emoji
  if (isImported) {
    return '✅';
  } else if (hasError) {
    return '❓';
  } else {
    return '❌';
  }
}

/**
 * Generate the markdown table content
 * @param {Array} fileData - Array of file data objects
 * @returns {string} - Markdown table content
 */
function generateMarkdownTable(fileData) {
  // Table header
  let markdown = '# Codebase Overview\n\n';
  markdown += 'Generated on: ' + new Date().toLocaleString() + '\n\n';
  markdown += '| File Path | Purpose | Main Export | Status |\n';
  markdown += '|-----------|---------|-------------|--------|\n';
  
  // Table rows
  for (const file of fileData) {
    const purpose = file.comment.substring(0, 100) + (file.comment.length > 100 ? '...' : '');
    markdown += `| ${file.path} | ${purpose} | ${file.export} | ${file.status} |\n`;
  }
  
  return markdown;
}

/**
 * Main function to run the script
 */
async function main() {
  try {
    console.log('Scanning codebase...');
    
    // Get all files matching patterns and excluding directories
    const allFiles = [];
    for (const pattern of CONFIG.filePatterns) {
      // Use the modern glob API which returns a Promise by default
      const files = await glob(pattern, {
        ignore: CONFIG.excludeDirs.map(dir => `**/${dir}/**`),
      });
      allFiles.push(...files);
    }
    
    console.log(`Found ${allFiles.length} files to analyze.`);
    
    // Process each file
    const fileData = [];
    let processedCount = 0;
    
    for (const filePath of allFiles) {
      processedCount++;
      if (processedCount % 10 === 0) {
        console.log(`Processed ${processedCount}/${allFiles.length} files...`);
      }
      
      try {
        const content = await readFilePromise(filePath, 'utf8');
        const comment = extractComment(content);
        const exportName = extractExport(content);
        const status = await checkImportStatus(filePath, allFiles);
        
        fileData.push({
          path: filePath,
          comment: comment || 'No description available',
          export: exportName || 'No named export found',
          status: status,
        });
      } catch (err) {
        console.error(`Error processing file ${filePath}: ${err.message}`);
        
        fileData.push({
          path: filePath,
          comment: 'Error processing file',
          export: 'Unknown',
          status: '❓',
        });
      }
    }
    
    // Generate markdown table
    const markdown = generateMarkdownTable(fileData);
    
    // Ensure output directory exists
    try {
      await mkdirPromise(CONFIG.outputDir, { recursive: true });
    } catch (err) {
      // Directory might already exist
      if (err.code !== 'EEXIST') {
        throw err;
      }
    }
    
    // Write to output file
    const outputPath = path.join(CONFIG.outputDir, CONFIG.outputFile);
    await writeFilePromise(outputPath, markdown, 'utf8');
    
    console.log(`Codebase overview generated at ${outputPath}`);
  } catch (err) {
    console.error('Error generating codebase overview:', err);
    process.exit(1);
  }
}

// Run the script
main(); 