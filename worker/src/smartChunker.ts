
/**
 * SMART CHUNKING ALGORITHM
 * 
 * Requirement: "Group words into blocks of 9 to 18 seconds to determine image switching."
 * Assumption: Average speaking rate of 150 words per minute (2.5 words/second).
 * 
 * Target Words per Chunk:
 * Min (9s): ~22 words
 * Max (18s): ~45 words
 */

export interface ScriptChunk {
    id: number;
    text: string;
    durationEstimate: number; // in seconds
    wordCount: number;
}

export const smartChunkScript = (fullScript: string): ScriptChunk[] => {
    const WORDS_PER_SECOND = 2.5;
    const MIN_SECONDS = 9;
    const MAX_SECONDS = 18;

    const words = fullScript.split(/\s+/);
    const chunks: ScriptChunk[] = [];

    let currentChunkWords: string[] = [];
    let currentWordCount = 0;

    words.forEach((word, index) => {
        currentChunkWords.push(word);
        currentWordCount++;

        const currentDuration = currentWordCount / WORDS_PER_SECOND;

        // Check if we should close the chunk
        // 1. If we hit the max limit.
        // 2. If we are within the valid range (9-18s) AND we hit a sentence ending punctuation (natural pause).
        // 3. If it's the very last word.

        const isMaxLimit = currentDuration >= MAX_SECONDS;
        const isSentenceEnd = /[.!?]$/.test(word);
        const isValidRange = currentDuration >= MIN_SECONDS;
        const isLastWord = index === words.length - 1;

        if ((isValidRange && isSentenceEnd) || isMaxLimit || isLastWord) {
            chunks.push({
                id: chunks.length + 1,
                text: currentChunkWords.join(' '),
                durationEstimate: parseFloat(currentDuration.toFixed(2)),
                wordCount: currentWordCount
            });

            // Reset for next chunk
            currentChunkWords = [];
            currentWordCount = 0;
        }
    });

    return chunks;
};
