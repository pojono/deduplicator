#!/usr/bin/env node

import { getFileList } from './fileListGenerator';
import { findDuplicatesBySize, filterDuplicates } from './findDuplicates';
import { findDuplicatesByContent } from './contentVerification';
import { generateDeletionPlan, formatDeletionPlan } from './deletionPlan';
import { deleteFiles } from './fileDeleter';
import { createWriteStream } from 'fs';
import { promisify } from 'util';

function printUsage() {
    console.error('Usage: file-list-generator <directory-path> [--delete]');
    console.error('Options:');
    console.error('  --delete    Actually delete the duplicate files (default: dry-run)');
    process.exit(1);
}

function getCurrentTimestamp(): string {
    const now = new Date();
    return now.toISOString().replace(/[:.]/g, '-');
}

async function writeToStream(stream: NodeJS.WritableStream, content: string): Promise<void> {
    return new Promise((resolve, reject) => {
        if (!stream.write(content)) {
            stream.once('drain', resolve);
        } else {
            resolve();
        }
    });
}

async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        printUsage();
    }

    // Parse arguments
    const deleteFlag = args.includes('--delete');
    const directoryPath = args.find(arg => !arg.startsWith('--')) || '';

    if (!directoryPath) {
        printUsage();
    }

    let outputStream: NodeJS.WritableStream | null = null;

    try {
        // Get file list
        let fileList = await getFileList(directoryPath);
        
        if (fileList.length === 0) {
            console.log('No files found in the directory.');
            return;
        }

        // Create a map of path to size for easy lookup
        const pathToSize = new Map(fileList.map(file => [file.path, file.size]));

        // Find potential duplicates by size
        console.log('\nAnalyzing files by size...');
        const sizeMap = findDuplicatesBySize(fileList);

        // Clear file list from memory
        fileList = [];

        if (sizeMap.size === 0) {
            console.log('No potential duplicates found based on file sizes.');
            return;
        }

        // Verify duplicates by content
        console.log('\nVerifying file contents...');
        const contentDuplicates = await findDuplicatesByContent(sizeMap);

        if (contentDuplicates.size === 0) {
            console.log('No duplicate files found after content verification.');
            return;
        }

        // Create output file stream
        const timestamp = getCurrentTimestamp();
        const outputFile = `duplicates-${timestamp}.txt`;
        outputStream = createWriteStream(outputFile, { 
            flags: 'w',
            encoding: 'utf8'
        });

        // Output results and save to file
        // console.log('\nDuplicate files found:');
        await writeToStream(outputStream, 'Duplicate files found:\n');
        
        for (const [hash, paths] of contentDuplicates) {
            const fileSize = formatFileSize(pathToSize.get(paths[0])!);
            const groupInfo = `\nSize: ${fileSize} (${paths.length} copies)\n`;
            // console.log(groupInfo);
            await writeToStream(outputStream, groupInfo);

            const sortedPaths = [...paths].sort();
            const keepPath = '  [KEEP] ' + sortedPaths[0] + '\n';
            // console.log(keepPath);
            await writeToStream(outputStream, keepPath);

            for (const path of sortedPaths.slice(1)) {
                const deletePath = '  [DELETE] ' + path + '\n';
                // console.log(deletePath);
                await writeToStream(outputStream, deletePath);
            }
        }

        // Close the stream properly
        await new Promise<void>((resolve, reject) => {
            if (outputStream) {
                outputStream.end(() => resolve());
                outputStream.on('error', reject);
            } else {
                resolve();
            }
        });

        console.log(`\nDuplicate information saved to: ${outputFile}`);

        // Generate deletion plan
        const filesToDelete = generateDeletionPlan(contentDuplicates);
        const { totalBytes } = formatDeletionPlan(filesToDelete, pathToSize);

        console.log(`\nTotal space that would be freed: ${formatFileSize(totalBytes)}`);

        // Handle deletion if --delete flag is present
        if (deleteFlag) {
            console.log('\nDeleting files...');
            const results = await deleteFiles(filesToDelete);

            // Report results
            if (results.deleted.length > 0) {
                console.log('\nSuccessfully deleted:');
                results.deleted.forEach(path => console.log(`  ${path}`));
            }

            if (results.failed.length > 0) {
                console.error('\nFailed to delete:');
                results.failed.forEach(({ path, error }) => console.error(`  ${path} (Error: ${error})`));
            }

            console.log(`\nDeletion complete. Freed ${formatFileSize(totalBytes)} of space.`);
        } else {
            console.log('\nNote: This was a dry run. No files were deleted.');
            console.log('To actually delete the files, run with the --delete flag.');
        }
    } catch (error: any) {
        console.error('Error:', error.message);
        process.exit(1);
    } finally {
        // Ensure stream is closed in case of error
        if (outputStream) {
            outputStream.end();
        }
    }
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

main().catch(error => {
    console.error('Error:', error.message);
    process.exit(1);
});
