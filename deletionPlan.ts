/**
 * Generates a plan for which files to delete
 * @param contentDuplicates - Map of content hashes to duplicate file paths
 * @returns Array of files to be deleted
 */
export function generateDeletionPlan(contentDuplicates: Map<string, string[]>): string[] {
    const filesToDelete: string[] = [];

    for (const [_, paths] of contentDuplicates) {
        // Sort paths alphabetically
        const sortedPaths = [...paths].sort();
        
        // Keep the first one (alphabetically smallest), mark others for deletion
        filesToDelete.push(...sortedPaths.slice(1));
    }

    return filesToDelete;
}

/**
 * Formats the deletion plan as a string
 * @param filesToDelete - Array of files to be deleted
 * @param pathToSize - Map of file paths to their sizes
 * @returns Object containing the formatted plan and total space that would be freed
 */
export function formatDeletionPlan(filesToDelete: string[], pathToSize: Map<string, number>): {
    planText: string;
    totalBytes: number;
} {
    let totalBytes = 0;
    const planLines: string[] = [];

    filesToDelete.forEach(path => {
        const size = pathToSize.get(path) || 0;
        totalBytes += size;
        planLines.push(`  ${path} (${formatFileSize(size)})`);
    });

    return {
        planText: planLines.join('\n'),
        totalBytes
    };
}

/**
 * Format file size in a human-readable way
 * @param bytes - Size in bytes
 * @returns Formatted string (e.g., "1.5 MB")
 */
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
