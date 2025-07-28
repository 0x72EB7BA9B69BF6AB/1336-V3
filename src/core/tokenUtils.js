/**
 * Token Utility Functions
 * Provides enhanced token handling and deduplication functionality
 */

const { logger } = require('./logger');

class TokenUtils {
    /**
     * Enhanced token deduplication function
     * Removes duplicates, null/undefined values, empty strings, and trims whitespace
     * @param {Array<string>} tokens - Array of tokens to deduplicate
     * @returns {Array<string>} Deduplicated tokens array
     */
    static deduplicate(tokens) {
        if (!Array.isArray(tokens)) {
            logger.warn('TokenUtils.deduplicate: Input is not an array', { input: tokens });
            return [];
        }

        const originalCount = tokens.length;
        
        // Step 1: Remove null/undefined values
        const cleanedTokens = tokens.filter(token => 
            token !== null && 
            token !== undefined
        );

        // Step 2: Ensure all tokens are strings and trim whitespace
        const trimmedTokens = cleanedTokens
            .filter(token => typeof token === 'string')
            .map(token => token.trim());

        // Step 3: Remove empty strings (after trimming)
        const nonEmptyTokens = trimmedTokens.filter(token => token.length > 0);

        // Step 4: Remove exact duplicates using Set
        const deduplicatedTokens = [...new Set(nonEmptyTokens)];

        const removedCount = originalCount - deduplicatedTokens.length;
        
        if (removedCount > 0) {
            logger.debug('Token deduplication completed', {
                originalCount,
                deduplicatedCount: deduplicatedTokens.length,
                removedCount
            });
        }

        return deduplicatedTokens;
    }

    /**
     * Validate Discord token format
     * @param {string} token - Token to validate
     * @returns {boolean} True if token appears to be a valid Discord token
     */
    static isValidDiscordToken(token) {
        if (typeof token !== 'string' || token.trim().length === 0) {
            return false;
        }

        const trimmedToken = token.trim();

        // Basic Discord token patterns - more permissive for deduplication purposes
        // Focus on structure rather than exact character validation
        if (trimmedToken.startsWith('mfa.') && trimmedToken.length > 20) {
            return true; // MFA tokens
        }
        
        const parts = trimmedToken.split('.');
        if (parts.length === 3 && 
            parts[0].length >= 20 && 
            parts[1].length >= 4 && 
            parts[2].length >= 20) {
            return true; // Standard 3-part tokens
        }

        return false;
    }

    /**
     * Deduplicate and validate Discord tokens
     * Combines deduplication with Discord token validation
     * @param {Array<string>} tokens - Array of tokens to process
     * @returns {Array<string>} Valid, deduplicated Discord tokens
     */
    static deduplicateAndValidateDiscordTokens(tokens) {
        const deduplicatedTokens = this.deduplicate(tokens);
        const validTokens = deduplicatedTokens.filter(token => this.isValidDiscordToken(token));

        const invalidCount = deduplicatedTokens.length - validTokens.length;
        if (invalidCount > 0) {
            logger.debug('Filtered out invalid Discord tokens', {
                totalTokens: deduplicatedTokens.length,
                validTokens: validTokens.length,
                invalidTokens: invalidCount
            });
        }

        return validTokens;
    }

    /**
     * Merge token arrays from multiple sources with deduplication
     * @param {...Array<string>} tokenArrays - Multiple arrays of tokens to merge
     * @returns {Array<string>} Merged and deduplicated tokens
     */
    static mergeAndDeduplicate(...tokenArrays) {
        const allTokens = [];
        
        tokenArrays.forEach((tokenArray, index) => {
            if (Array.isArray(tokenArray)) {
                allTokens.push(...tokenArray);
            } else {
                logger.warn(`TokenUtils.mergeAndDeduplicate: Array ${index} is not an array`, { array: tokenArray });
            }
        });

        return this.deduplicate(allTokens);
    }

    /**
     * Get statistics about token deduplication
     * @param {Array<string>} originalTokens - Original tokens array
     * @param {Array<string>} deduplicatedTokens - Deduplicated tokens array
     * @returns {Object} Deduplication statistics
     */
    static getDeduplicationStats(originalTokens, deduplicatedTokens) {
        return {
            originalCount: originalTokens.length,
            deduplicatedCount: deduplicatedTokens.length,
            removedCount: originalTokens.length - deduplicatedTokens.length,
            duplicatePercentage: originalTokens.length > 0 ? 
                ((originalTokens.length - deduplicatedTokens.length) / originalTokens.length * 100).toFixed(2) : 0
        };
    }
}

module.exports = {
    TokenUtils
};