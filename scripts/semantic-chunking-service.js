/**
 * Semantic Chunking Service (JavaScript version for migration scripts)
 * Replaces granular segment-based chunking with intelligent semantic chunks
 */

class SemanticChunkingService {
  /**
   * Create semantic chunks from raw transcript segments
   * Goal: 60-90 second chunks with complete thoughts, 5-10s overlap
   */
  static createSemanticChunks(segments, videoId, options = {}) {
    // Apply default values
    const {
      minChunkDuration = 60,
      maxChunkDuration = 120,
      overlapDuration = 5,
      minWordsPerChunk = 50
    } = options

    console.log(`🔧 Chunking parameters: ${minChunkDuration}-${maxChunkDuration}s duration, ${minWordsPerChunk}+ words, ${overlapDuration}s overlap`)

    const chunks = []
    let currentChunk = null

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
      // Be more aggressive about building longer chunks for better semantic grouping
      const shouldContinue = (
        potentialDuration <= maxChunkDuration &&
        wordCount <= 200 && // Reasonable upper limit for chunks
        (potentialDuration < (minChunkDuration + 10) || !this.isNaturalBreakpoint(segment, segments[i + 1]))
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
          console.log(`📦 Created chunk ${chunks.length + 1}: ${chunkDuration.toFixed(1)}s, ${chunkWordCount} words`)
          chunks.push(chunk)
        } else {
          console.log(`❌ Rejected chunk: ${chunkDuration.toFixed(1)}s (min: ${minChunkDuration}), ${chunkWordCount} words (min: ${minWordsPerChunk})`)
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
        console.log(`📦 Final chunk ${chunks.length + 1}: ${chunkDuration.toFixed(1)}s, ${chunkWordCount} words`)
        chunks.push(chunk)
      } else {
        console.log(`❌ Rejected final chunk: ${chunkDuration.toFixed(1)}s (min: ${minChunkDuration}), ${chunkWordCount} words (min: ${minWordsPerChunk})`)
      }
    }

    return chunks
  }

  /**
   * Detect natural breakpoints for chunk boundaries
   */
  static isNaturalBreakpoint(currentSegment, nextSegment) {
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
  static finalizeChunk(chunkData, videoId, chunkIndex) {
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
  static validateChunk(chunk) {
    // Minimum quality thresholds
    const hasMinimumLength = chunk.word_count >= 15
    const hasReasonableLength = chunk.word_count <= 200
    const hasGoodConfidence = chunk.confidence_score >= 0.6
    const hasMinimumDuration = (chunk.end_time - chunk.start_time) >= 10

    return hasMinimumLength && hasReasonableLength && hasGoodConfidence && hasMinimumDuration
  }
}

module.exports = { SemanticChunkingService }