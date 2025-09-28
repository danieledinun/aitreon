/**
 * Citation Validation Service
 * Ensures citations are accurate and properly grounded in source content
 * Validates semantic alignment between claims and cited content
 */

export interface CitationCandidate {
  id: string
  videoId: string
  videoTitle: string
  content: string
  startTime?: number
  endTime?: number
  confidence: number
  metadata?: Record<string, any>
}

export interface ValidationResult {
  isValid: boolean
  confidence: number
  validationReasons: string[]
  semanticAlignment: number
  temporalAccuracy: number
  contentRelevance: number
}

export interface ValidatedCitation extends CitationCandidate {
  validation: ValidationResult
}

export interface CitationValidationOptions {
  minSemanticAlignment: number
  minConfidence: number
  maxCitations: number
  requireTemporalAccuracy: boolean
  semanticThreshold: number
}

export class CitationValidationService {

  /**
   * Validate a set of citation candidates against a user query and AI response
   */
  static async validateCitations(
    userQuery: string,
    aiResponse: string,
    citations: CitationCandidate[],
    options: CitationValidationOptions = {
      minSemanticAlignment: 0.7,
      minConfidence: 0.6,
      maxCitations: 5,
      requireTemporalAccuracy: true,
      semanticThreshold: 0.65
    }
  ): Promise<ValidatedCitation[]> {

    console.log(`🔍 Validating ${citations.length} citation candidates...`)

    // Validate each citation individually
    const validatedCitations = await Promise.all(
      citations.map(citation => this.validateSingleCitation(
        userQuery,
        aiResponse,
        citation,
        options
      ))
    )

    // Filter valid citations
    const validCitations = validatedCitations.filter(citation =>
      citation.validation.isValid
    )

    console.log(`✅ ${validCitations.length}/${citations.length} citations passed validation`)

    // Rank by validation confidence and return top citations
    const rankedCitations = validCitations
      .sort((a, b) => b.validation.confidence - a.validation.confidence)
      .slice(0, options.maxCitations)

    // Perform cross-citation validation to avoid redundancy
    const dedupedCitations = this.removeDuplicateCitations(rankedCitations)

    console.log(`📝 Final validated citations: ${dedupedCitations.length}`)

    return dedupedCitations
  }

  /**
   * Validate a single citation against the query and response
   */
  private static async validateSingleCitation(
    userQuery: string,
    aiResponse: string,
    citation: CitationCandidate,
    options: CitationValidationOptions
  ): Promise<ValidatedCitation> {

    const validationReasons: string[] = []

    // 1. Semantic Alignment Check
    const semanticAlignment = await this.checkSemanticAlignment(
      aiResponse,
      citation.content,
      userQuery
    )

    if (semanticAlignment >= options.minSemanticAlignment) {
      validationReasons.push('Strong semantic alignment with AI response')
    }

    // 2. Content Relevance Check
    const contentRelevance = this.checkContentRelevance(
      userQuery,
      citation.content
    )

    if (contentRelevance >= options.semanticThreshold) {
      validationReasons.push('High content relevance to user query')
    }

    // 3. Temporal Accuracy Check
    const temporalAccuracy = this.checkTemporalAccuracy(citation)

    if (temporalAccuracy >= 0.8 || !options.requireTemporalAccuracy) {
      validationReasons.push('Accurate temporal information')
    }

    // 4. Citation Confidence Check
    const citationConfidence = citation.confidence

    if (citationConfidence >= options.minConfidence) {
      validationReasons.push('High retrieval confidence')
    }

    // 5. Content Quality Check
    const qualityScore = this.checkContentQuality(citation.content)

    if (qualityScore >= 0.7) {
      validationReasons.push('High content quality')
    }

    // Overall validation decision
    const overallConfidence = this.calculateOverallConfidence([
      semanticAlignment,
      contentRelevance,
      temporalAccuracy,
      citationConfidence,
      qualityScore
    ])

    const isValid = (
      semanticAlignment >= options.minSemanticAlignment &&
      contentRelevance >= options.semanticThreshold &&
      citationConfidence >= options.minConfidence &&
      qualityScore >= 0.5 &&
      validationReasons.length >= 3
    )

    const validation: ValidationResult = {
      isValid,
      confidence: overallConfidence,
      validationReasons,
      semanticAlignment,
      temporalAccuracy,
      contentRelevance
    }

    return {
      ...citation,
      validation
    }
  }

  /**
   * Check semantic alignment between AI response and citation content
   */
  private static async checkSemanticAlignment(
    aiResponse: string,
    citationContent: string,
    userQuery: string
  ): Promise<number> {

    try {
      // Extract key concepts from AI response that should be supported by citations
      const responseKeywords = this.extractKeywords(aiResponse)
      const citationKeywords = this.extractKeywords(citationContent)
      const queryKeywords = this.extractKeywords(userQuery)

      // Calculate semantic overlap
      const responseOverlap = this.calculateKeywordOverlap(responseKeywords, citationKeywords)
      const queryAlignment = this.calculateKeywordOverlap(queryKeywords, citationKeywords)

      // Weight response overlap more heavily since citations should support the response
      const semanticScore = (responseOverlap * 0.7) + (queryAlignment * 0.3)

      return Math.min(semanticScore, 1.0)

    } catch (error) {
      console.error('❌ Error checking semantic alignment:', error)
      return 0.5 // Default moderate score on error
    }
  }

  /**
   * Check how relevant the citation content is to the user query
   */
  private static checkContentRelevance(
    userQuery: string,
    citationContent: string
  ): number {

    try {
      const queryKeywords = this.extractKeywords(userQuery)
      const contentKeywords = this.extractKeywords(citationContent)

      // Calculate direct keyword overlap
      const keywordRelevance = this.calculateKeywordOverlap(queryKeywords, contentKeywords)

      // Check for conceptual relevance
      const conceptualRelevance = this.checkConceptualRelevance(userQuery, citationContent)

      // Combine scores
      const relevanceScore = (keywordRelevance * 0.6) + (conceptualRelevance * 0.4)

      return Math.min(relevanceScore, 1.0)

    } catch (error) {
      console.error('❌ Error checking content relevance:', error)
      return 0.5
    }
  }

  /**
   * Check temporal accuracy of citation timestamps
   */
  private static checkTemporalAccuracy(citation: CitationCandidate): number {

    // Basic temporal validation
    if (!citation.startTime || !citation.endTime) {
      return 0.7 // Moderate score for missing timestamps
    }

    // Check for reasonable duration (3-60 seconds)
    const duration = citation.endTime - citation.startTime

    if (duration < 3) {
      return 0.3 // Too short
    }

    if (duration > 60) {
      return 0.5 // Too long
    }

    // Check for reasonable start time (positive)
    if (citation.startTime < 0) {
      return 0.2 // Invalid timestamp
    }

    return 1.0 // Good temporal accuracy
  }

  /**
   * Check overall content quality
   */
  private static checkContentQuality(content: string): number {

    const words = content.split(/\s+/).filter(word => word.length > 0)

    // Check minimum length
    if (words.length < 10) {
      return 0.3
    }

    // Check maximum length (avoid overly long chunks)
    if (words.length > 200) {
      return 0.6
    }

    // Check for complete sentences
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0)
    const sentenceCompleteness = Math.min(sentences.length / 3, 1.0)

    // Check for coherence (simplified: ratio of stopwords)
    const coherenceScore = this.calculateCoherenceScore(content)

    return (sentenceCompleteness * 0.5) + (coherenceScore * 0.5)
  }

  /**
   * Calculate overall confidence from multiple validation scores
   */
  private static calculateOverallConfidence(scores: number[]): number {
    const validScores = scores.filter(score => score >= 0)

    if (validScores.length === 0) {
      return 0
    }

    // Weighted average with emphasis on semantic alignment and content relevance
    const weights = [0.3, 0.25, 0.15, 0.2, 0.1] // Semantic, relevance, temporal, confidence, quality

    let weightedSum = 0
    let weightTotal = 0

    validScores.forEach((score, index) => {
      const weight = weights[index] || 0.1
      weightedSum += score * weight
      weightTotal += weight
    })

    return weightTotal > 0 ? weightedSum / weightTotal : 0
  }

  /**
   * Remove duplicate or overly similar citations
   */
  private static removeDuplicateCitations(citations: ValidatedCitation[]): ValidatedCitation[] {

    const dedupedCitations: ValidatedCitation[] = []

    for (const citation of citations) {
      let isDuplicate = false

      for (const existing of dedupedCitations) {
        // Check for same video and overlapping time
        if (citation.videoId === existing.videoId) {
          const timeOverlap = this.calculateTimeOverlap(citation, existing)

          if (timeOverlap > 0.5) { // 50% overlap threshold
            isDuplicate = true
            break
          }
        }

        // Check for high content similarity
        const contentSimilarity = this.calculateContentSimilarity(
          citation.content,
          existing.content
        )

        if (contentSimilarity > 0.8) { // 80% similarity threshold
          isDuplicate = true
          break
        }
      }

      if (!isDuplicate) {
        dedupedCitations.push(citation)
      }
    }

    return dedupedCitations
  }

  /**
   * Extract keywords from text for semantic analysis
   */
  private static extractKeywords(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word =>
        word.length > 3 &&
        !this.isStopWord(word)
      )
      .slice(0, 20) // Limit to top 20 keywords
  }

  /**
   * Calculate keyword overlap between two sets
   */
  private static calculateKeywordOverlap(keywords1: string[], keywords2: string[]): number {

    if (keywords1.length === 0 || keywords2.length === 0) {
      return 0
    }

    const set1 = new Set(keywords1)
    const set2 = new Set(keywords2)

    const intersection = new Set([...set1].filter(x => set2.has(x)))
    const union = new Set([...set1, ...set2])

    return intersection.size / union.size // Jaccard similarity
  }

  /**
   * Check conceptual relevance using simple heuristics
   */
  private static checkConceptualRelevance(query: string, content: string): number {

    // Simple conceptual matching based on domain-specific patterns
    const conceptPatterns = [
      /\b(how to|tutorial|guide|step|process)\b/i,
      /\b(benefit|advantage|improve|better)\b/i,
      /\b(problem|issue|solve|fix)\b/i,
      /\b(strategy|technique|method|approach)\b/i,
      /\b(example|instance|case|scenario)\b/i
    ]

    let conceptualMatches = 0

    for (const pattern of conceptPatterns) {
      if (pattern.test(query) && pattern.test(content)) {
        conceptualMatches++
      }
    }

    return Math.min(conceptualMatches / 3, 1.0)
  }

  /**
   * Calculate coherence score for content quality
   */
  private static calculateCoherenceScore(content: string): number {

    const words = content.toLowerCase().split(/\s+/)
    const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']
    const stopWordCount = words.filter(word => stopWords.includes(word)).length

    // Reasonable ratio of stop words indicates natural language
    const stopWordRatio = stopWordCount / words.length

    if (stopWordRatio < 0.1) {
      return 0.3 // Too few stop words, might be keyword stuffing
    }

    if (stopWordRatio > 0.4) {
      return 0.6 // Too many stop words, might be less informative
    }

    return 1.0 // Good balance
  }

  /**
   * Calculate time overlap between two citations
   */
  private static calculateTimeOverlap(citation1: CitationCandidate, citation2: CitationCandidate): number {

    if (!citation1.startTime || !citation1.endTime || !citation2.startTime || !citation2.endTime) {
      return 0
    }

    const start1 = citation1.startTime
    const end1 = citation1.endTime
    const start2 = citation2.startTime
    const end2 = citation2.endTime

    const overlapStart = Math.max(start1, start2)
    const overlapEnd = Math.min(end1, end2)

    if (overlapStart >= overlapEnd) {
      return 0 // No overlap
    }

    const overlapDuration = overlapEnd - overlapStart
    const totalDuration = Math.max(end1, end2) - Math.min(start1, start2)

    return overlapDuration / totalDuration
  }

  /**
   * Calculate content similarity between two text strings
   */
  private static calculateContentSimilarity(content1: string, content2: string): number {

    const keywords1 = this.extractKeywords(content1)
    const keywords2 = this.extractKeywords(content2)

    return this.calculateKeywordOverlap(keywords1, keywords2)
  }

  /**
   * Check if a word is a stop word
   */
  private static isStopWord(word: string): boolean {

    const stopWords = new Set([
      'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
      'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
      'to', 'was', 'will', 'with', 'you', 'your', 'this', 'they', 'we',
      'i', 'me', 'my', 'myself', 'our', 'ours', 'ourselves', 'them',
      'their', 'theirs', 'themselves', 'what', 'which', 'who', 'whom'
    ])

    return stopWords.has(word.toLowerCase())
  }
}