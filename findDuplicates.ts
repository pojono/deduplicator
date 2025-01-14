import { FileInfo } from './fileListGenerator';

/**
 * Groups files by their size to identify potential duplicates
 * @param files - Array of FileInfo objects
 * @returns Map where key is file size and value is array of file paths
 */
export function findDuplicatesBySize(files: FileInfo[]): Map<number, string[]> {
    console.log('Grouping files by size...');
    const sizeMap = new Map<number, string[]>();
    let processedFiles = 0;
    const totalFiles = files.length;

    // Pre-allocate arrays for common file sizes to reduce memory reallocation
    const tempMap: { [key: number]: string[] } = {};
    
    // First pass: count files of each size
    for (const file of files) {
        if (!tempMap[file.size]) {
            tempMap[file.size] = [];
        }
        tempMap[file.size].push(file.path);
        
        processedFiles++;
        if (processedFiles % 1000 === 0) {
            console.log(`  Processed ${processedFiles}/${totalFiles} files for size grouping...`);
        }
    }

    // Second pass: only keep sizes with duplicates
    for (const [size, paths] of Object.entries(tempMap)) {
        if (paths.length > 1) {
            sizeMap.set(Number(size), paths);
        }
    }

    console.log(`  Completed size analysis of ${processedFiles} files`);
    console.log(`  Found ${sizeMap.size} groups with potential duplicates`);
    return sizeMap;
}

/**
 * Filters the size map to only include entries with duplicates
 * @param sizeMap - Map of file sizes to file paths
 * @returns Map containing only entries with multiple files
 */
export function filterDuplicates(sizeMap: Map<number, string[]>): Map<number, string[]> {
    // This function is now redundant as we filter during size grouping
    return sizeMap;
}
