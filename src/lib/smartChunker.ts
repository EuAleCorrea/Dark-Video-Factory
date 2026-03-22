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
  wordCount: number;
}

export const smartChunkScript = (
  fullScript: string,
  wordsPerScene: number = 250,
  maxScenes: number = 15
): ScriptChunk[] => {
  const words = fullScript.split(/\s+/);
  const chunks: ScriptChunk[] = [];
  
  let currentChunkWords: string[] = [];
  let currentWordCount = 0;

  // We want to try finding a sentence boundary close to wordsPerScene
  const tolerance = Math.floor(wordsPerScene * 0.2); // 20% tolerance
  const minWords = wordsPerScene - tolerance;
  const maxWords = wordsPerScene + tolerance;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    currentChunkWords.push(word);
    currentWordCount++;

    const isSentenceEnd = /[.!?]$/.test(word);
    const isLastWord = i === words.length - 1;
    const isOverMaxWords = currentWordCount >= maxWords;
    const isWithinValidRange = currentWordCount >= minWords && isSentenceEnd;
    
    // We should close the chunk if:
    // 1. It's the last word
    // 2. We are within the target range AND at a sentence end
    // 3. We've exceeded max words (force cut to avoid giant chunks)
    if (isLastWord || isWithinValidRange || isOverMaxWords) {
      // If we are about to hit maxScenes, we just cram everything else into the last scene
      if (chunks.length === maxScenes - 1 && !isLastWord) {
        // Just let it continue accumulating until the very end
        continue;
      }

      chunks.push({
        id: chunks.length + 1,
        text: currentChunkWords.join(' '),
        wordCount: currentWordCount
      });
      
      currentChunkWords = [];
      currentWordCount = 0;
    }
  }

  // If there are leftovers due to maxScenes limitation, they should already be in the last chunk
  // because of the `continue` above, but just in case:
  if (currentChunkWords.length > 0) {
    if (chunks.length < maxScenes) {
      chunks.push({
        id: chunks.length + 1,
        text: currentChunkWords.join(' '),
        wordCount: currentWordCount
      });
    } else {
      // Append to the last chunk
      const lastChunk = chunks[chunks.length - 1];
      lastChunk.text += ' ' + currentChunkWords.join(' ');
      lastChunk.wordCount += currentWordCount;
    }
  }

  return chunks;
};