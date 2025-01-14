import { createReadStream } from 'fs';
import { createHash } from 'crypto';

/**
 * Calculates MD5 hash of a file with streaming and error handling
 * @param filePath - Path to the file
 * @returns Promise that resolves to the file's hash
 */
async function calculateFileHash(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const hash = createHash('md5');
        const stream = createReadStream(filePath, { 
            highWaterMark: 1024 * 1024 // 1MB chunks for better memory usage
        });

        stream.on('error', err => {
            stream.destroy();
            reject(err);
        });

        stream.on('data', chunk => hash.update(chunk));

        stream.on('end', () => {
            stream.destroy();
            resolve(hash.digest('hex'));
        });
    });
}

/**
 * Groups files by their content hash to find true duplicates
 * @param sizeMap - Map of file sizes to file paths (from filterDuplicates)
 * @returns Map where key is content hash and value is array of duplicate file paths
 */
export async function findDuplicatesByContent(sizeMap: Map<number, string[]>): Promise<Map<string, string[]>> {
    const hashMap = new Map<string, string[]>();
    let processedGroups = 0;
    let totalGroups = sizeMap.size;
    let totalFiles = 0;
    let processedFiles = 0;

    // Count total files to process
    for (const paths of sizeMap.values()) {
        totalFiles += paths.length;
    }

    // Process groups in order of size (smallest first) to handle easy cases first
    const sortedGroups = [...sizeMap.entries()].sort(([sizeA], [sizeB]) => sizeA - sizeB);

    // Process each group of same-sized files
    for (const [size, paths] of sortedGroups) {
        if (paths.length <= 1) {
            processedGroups++;
            continue;
        }

        console.log(`\nProcessing group of ${paths.length} files of size ${formatFileSize(size)}...`);

        // Process files in batches to control memory usage
        const BATCH_SIZE = 10; // Adjust based on file sizes
        for (let i = 0; i < paths.length; i += BATCH_SIZE) {
            const batch = paths.slice(i, i + BATCH_SIZE);
            
            // Calculate hashes for the batch
            const hashPromises = batch.map(async (path) => {
                try {
                    const hash = await calculateFileHash(path);
                    processedFiles++;
                    if (processedFiles % 10 === 0 || processedFiles === totalFiles) {
                        console.log(`  Verified ${processedFiles}/${totalFiles} files...`);
                    }
                    return { path, hash };
                } catch (error) {
                    console.warn(`Failed to hash file ${path}:`, error);
                    processedFiles++;
                    return null;
                }
            });

            // Wait for batch to complete
            const results = await Promise.all(hashPromises);

            // Group files by hash
            for (const result of results) {
                if (!result) continue;
                
                const { path, hash } = result;
                if (!hashMap.has(hash)) {
                    hashMap.set(hash, []);
                }
                hashMap.get(hash)!.push(path);
            }
        }

        processedGroups++;
        console.log(`  Processed ${processedGroups}/${totalGroups} size groups`);
    }

    // Filter out unique files (only one file with that hash)
    const duplicatesMap = new Map([...hashMap].filter(([_, paths]) => paths.length > 1));
    console.log(`\nFound ${duplicatesMap.size} groups of true duplicates`);
    
    return duplicatesMap;
}

// Helper function for formatting file sizes
function formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
}
