import { readdir, stat } from 'fs/promises';
import { join, resolve } from 'path';

const EXCLUDED_DIRS = ['@eaDir'];

export interface FileInfo {
    path: string;
    size: number;
}

/**
 * Recursively gets all files from a directory with their sizes
 * @param directoryPath - Path to the directory to scan
 * @returns Array of objects containing file paths and sizes
 */
async function getAllFiles(directoryPath: string): Promise<FileInfo[]> {
    const files: FileInfo[] = [];
    let processedFiles = 0;
    let skippedFiles = 0;
    
    // Process directory entries in chunks to avoid memory spikes
    async function scanDirectory(currentPath: string) {
        const entries = await readdir(currentPath);
        
        // Process entries in parallel but limit concurrency
        const BATCH_SIZE = 100;
        for (let i = 0; i < entries.length; i += BATCH_SIZE) {
            const batch = entries.slice(i, i + BATCH_SIZE);
            await Promise.all(batch.map(async (entry) => {
                // Skip @eaDir directories and their contents
                if (EXCLUDED_DIRS.includes(entry)) {
                    skippedFiles++;
                    return;
                }

                const fullPath = join(currentPath, entry);
                try {
                    const stats = await stat(fullPath);
                    
                    if (stats.isDirectory()) {
                        await scanDirectory(fullPath);
                    } else {
                        files.push({
                            path: fullPath,
                            size: stats.size
                        });
                        
                        processedFiles++;
                        if (processedFiles % 1000 === 0) {
                            console.log(`  Processed ${processedFiles} files...`);
                        }
                    }
                } catch (error) {
                    console.warn(`Failed to process ${fullPath}:`, error);
                }
            }));
        }
    }

    await scanDirectory(directoryPath);
    console.log(`  Total files processed: ${processedFiles}`);
    if (skippedFiles > 0) {
        console.log(`  Skipped ${skippedFiles} system directories (@eaDir)`);
    }
    return files;
}

/**
 * Gets list of files with their sizes from a directory
 * @param directoryPath - Path to the directory to scan
 * @returns Array of FileInfo objects
 */
export async function getFileList(directoryPath: string): Promise<FileInfo[]> {
    try {
        console.log('Scanning directory for files...');
        // Convert to absolute path if relative path is provided
        const absolutePath = resolve(directoryPath);
        
        // Ensure directory path exists
        if (!(await stat(absolutePath)).isDirectory()) {
            throw new Error('Directory does not exist');
        }

        // Get all files with sizes
        const files = await getAllFiles(absolutePath);
        console.log(`Total files found: ${files.length}`);
        
        return files;
    } catch (error: any) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}
