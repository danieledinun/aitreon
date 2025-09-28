/**
 * Semantic Chunking Service
 * Replaces granular segment-based chunking with intelligent semantic chunks
 * Addresses the core citation accuracy problem by creating meaningful content units
 */

export interface TranscriptSegment {
  start: number
  end: number
  duration: number
  text: string
}

export interface SemanticChunk {
  chunk_id: string
  start_time: number
  end_time: number
  content: string
  sentence_count: number
  word_count: number
  confidence_score: number
}

export class SemanticChunkingService {

  /**
   * Create semantic chunks from raw transcript segments
   * Goal: 60-90 second chunks with complete thoughts, 5-10s overlap
   */
  static createSemanticChunks(
    segments: TranscriptSegment[],
    videoId: string,
    options: {
      minChunkDuration?: number,
      maxChunkDuration?: number,
      overlapDuration?: number,
      minWordsPerChunk?: number
    } = {}
  ): SemanticChunk[] {

    // Apply default values
    const {
      minChunkDuration = 60,
      maxChunkDuration = 90,
      overlapDuration = 8,
      minWordsPerChunk = 50
    } = options

    const chunks: SemanticChunk[] = []
    let currentChunk: {
      segments: TranscriptSegment[]
      startTime: number
      endTime: number
      content: string
    } | null = null

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i]

      // Initialize first chunk
      if (!currentChunk) {
        currentChunk = {
          segments: [segment],
          startTime: segment.start,
          endTime: segment.end,
          content: segment.text
        }
        continue
      }

      // Calculate duration if we add this segment
      const potentialDuration = segment.end - currentChunk.startTime
      const potentialContent = currentChunk.content + ' ' + segment.text
      const wordCount = potentialContent.split(/\s+/).length

      // Check if we should continue building this chunk
      const shouldContinue = (
        potentialDuration <= maxChunkDuration &&
        !this.isNaturalBreakpoint(segment, segments[i + 1]) &&
        wordCount <= 300 // Reasonable upper limit for longer chunks
      )

      if (shouldContinue) {
        // Add segment to current chunk
        currentChunk.segments.push(segment)
        currentChunk.endTime = segment.end
        currentChunk.content = potentialContent
      } else {
        // Finalize current chunk if it meets minimum requirements
        const chunkDuration = currentChunk.endTime - currentChunk.startTime
        const chunkWordCount = currentChunk.content.split(/\s+/).length

        if (chunkDuration >= minChunkDuration &&
            chunkWordCount >= minWordsPerChunk) {

          const chunk = this.finalizeChunk(currentChunk, videoId, chunks.length)
          chunks.push(chunk)
        }

        // Start new chunk with overlap
        const overlapStart = Math.max(
          segment.start - overlapDuration,
          currentChunk.startTime
        )

        // Find segments that fall within overlap window
        const overlapSegments = currentChunk.segments.filter(
          seg => seg.start >= overlapStart
        )

        currentChunk = {
          segments: [...overlapSegments, segment],
          startTime: overlapSegments.length > 0 ? overlapSegments[0].start : segment.start,
          endTime: segment.end,
          content: [...overlapSegments, segment].map(s => s.text).join(' ')
        }
      }
    }

    // Finalize last chunk
    if (currentChunk) {
      const chunkDuration = currentChunk.endTime - currentChunk.startTime
      const chunkWordCount = currentChunk.content.split(/\s+/).length

      if (chunkDuration >= minChunkDuration &&
          chunkWordCount >= minWordsPerChunk) {
        const chunk = this.finalizeChunk(currentChunk, videoId, chunks.length)
        chunks.push(chunk)
      }
    }

    return chunks
  }

  /**
   * Detect natural breakpoints for chunk boundaries
   */
  private static isNaturalBreakpoint(
    currentSegment: TranscriptSegment,
    nextSegment?: TranscriptSegment
  ): boolean {

    const text = currentSegment.text.trim()

    // Strong sentence endings
    if (/[.!?]$/.test(text)) {
      return true
    }

    // Paragraph/topic transition indicators
    const transitionWords = [
      'now', 'next', 'so', 'however', 'but', 'therefore',
      'in conclusion', 'finally', 'meanwhile', 'on the other hand'
    ]

    if (nextSegment) {
      const nextText = nextSegment.text.trim().toLowerCase()
      if (transitionWords.some(word => nextText.startsWith(word))) {
        return true
      }
    }

    // Long pause detection (gap between segments)
    if (nextSegment && (nextSegment.start - currentSegment.end) > 2.0) {
      return true
    }

    return false
  }

  /**
   * Finalize chunk with metadata and quality scoring
   */
  private static finalizeChunk(
    chunkData: {
      segments: TranscriptSegment[]
      startTime: number
      endTime: number
      content: string
    },
    videoId: string,
    chunkIndex: number
  ): SemanticChunk {

    const startMs = Math.round(chunkData.startTime * 1000)
    const endMs = Math.round(chunkData.endTime * 1000)

    // Clean up content
    const cleanContent = chunkData.content
      .replace(/\s+/g, ' ')
      .trim()

    // Calculate quality metrics
    const sentences = cleanContent.split(/[.!?]+/).filter(s => s.trim().length > 0)
    const words = cleanContent.split(/\s+/).filter(w => w.length > 0)

    // Confidence score based on completeness and coherence
    let confidence = 0.5 // Base score

    // Boost for complete sentences
    if (sentences.length >= 1) confidence += 0.2
    if (sentences.length >= 2) confidence += 0.1

    // Boost for reasonable length
    if (words.length >= 20 && words.length <= 100) confidence += 0.2

    // Boost for sentence endings
    if (/[.!?]$/.test(cleanContent.trim())) confidence += 0.1

    return {
      chunk_id: `${videoId}_${startMs}_${endMs}`,
      start_time: chunkData.startTime,
      end_time: chunkData.endTime,
      content: cleanContent,
      sentence_count: sentences.length,
      word_count: words.length,
      confidence_score: Math.min(confidence, 1.0)
    }
  }

  /**
   * Validate chunk quality for filtering low-quality chunks
   */
  static validateChunk(chunk: SemanticChunk): boolean {
    // Minimum quality thresholds
    const hasMinimumLength = chunk.word_count >= 15
    const hasReasonableLength = chunk.word_count <= 200
    const hasGoodConfidence = chunk.confidence_score >= 0.6
    const hasMinimumDuration = (chunk.end_time - chunk.start_time) >= 10

    return hasMinimumLength && hasReasonableLength && hasGoodConfidence && hasMinimumDuration
  }

  /**
   * Create stitched windows for LLM context (up to 90s)
   * Used during retrieval to provide expanded context without storing duplicates
   */
  static createStitchedWindows(
    chunks: SemanticChunk[],
    maxWindowDuration: number = 90
  ): Array<{
    window_id: string
    chunks: SemanticChunk[]
    start_time: number
    end_time: number
    content: string
  }> {

    const windows = []

    for (let i = 0; i < chunks.length; i++) {
      const baseChunk = chunks[i]
      let windowChunks = [baseChunk]
      let windowEnd = baseChunk.end_time

      // Extend window by adding adjacent chunks
      for (let j = i + 1; j < chunks.length; j++) {
        const nextChunk = chunks[j]
        const potentialDuration = nextChunk.end_time - baseChunk.start_time

        if (potentialDuration <= maxWindowDuration &&
            (nextChunk.start_time - windowEnd) <= 10) { // Max 10s gap
          windowChunks.push(nextChunk)
          windowEnd = nextChunk.end_time
        } else {
          break
        }
      }

      // Only create window if it spans multiple chunks or is substantial
      if (windowChunks.length > 1 || (windowEnd - baseChunk.start_time) >= 30) {
        windows.push({
          window_id: `window_${baseChunk.chunk_id}`,
          chunks: windowChunks,
          start_time: baseChunk.start_time,
          end_time: windowEnd,
          content: windowChunks.map(c => c.content).join(' ')
        })
      }
    }

    return windows
  }
}