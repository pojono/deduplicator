import { unlink } from 'fs/promises';

/**
 * Deletes the specified files
 * @param filesToDelete - Array of file paths to delete
 * @returns Object containing results of deletion operation
 */
export async function deleteFiles(filesToDelete: string[]): Promise<{
    deleted: string[];
    failed: Array<{ path: string; error: string }>;
}> {
    const results = {
        deleted: [] as string[],
        failed: [] as Array<{ path: string; error: string }>
    };

    const totalFiles = filesToDelete.length;
    let processedFiles = 0;

    // Process each file
    for (const filePath of filesToDelete) {
        try {
            await unlink(filePath);
            results.deleted.push(filePath);
        } catch (error: any) {
            results.failed.push({
                path: filePath,
                error: error.message
            });
        }

        processedFiles++;
        if (processedFiles % 10 === 0 || processedFiles === totalFiles) {
            console.log(`  Deleted ${processedFiles}/${totalFiles} files...`);
        }
    }

    return results;
}
