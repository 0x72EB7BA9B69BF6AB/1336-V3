/**
 * Browser Decryptor Module Tests
 * Tests for video title filtering functionality
 */

const { BrowserDecryptor } = require('../../../src/modules/browsers/decryptor');

describe('BrowserDecryptor', () => {
    let decryptor;

    beforeEach(() => {
        decryptor = new BrowserDecryptor();
    });

    describe('Video Title Filtering', () => {
        test('should filter YouTube video titles', () => {
            const testCases = [
                {
                    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                    title: 'Rick Astley - Never Gonna Give You Up (Official Music Video)',
                    expected: '[Video Content - youtube.com]'
                },
                {
                    url: 'https://youtu.be/dQw4w9WgXcQ',
                    title: 'Amazing Tutorial - 10:30',
                    expected: '[Video Content - youtu.be]'
                },
                {
                    url: 'https://m.youtube.com/watch?v=abc123',
                    title: 'Some Video Title',
                    expected: '[Video Content - m.youtube.com]'
                }
            ];

            testCases.forEach(({ url, title, expected }) => {
                const result = decryptor.filterVideoTitle(url, title);
                expect(result).toBe(expected);
            });
        });

        test('should filter other video platform titles', () => {
            const testCases = [
                {
                    url: 'https://vimeo.com/123456789',
                    title: 'Creative Video Project',
                    expected: '[Video Content - vimeo.com]'
                },
                {
                    url: 'https://www.twitch.tv/streamer',
                    title: 'Live Stream Title',
                    expected: '[Video Content - twitch.tv]'
                },
                {
                    url: 'https://www.tiktok.com/@user/video/123',
                    title: 'TikTok Video',
                    expected: '[Video Content - tiktok.com]'
                },
                {
                    url: 'https://www.dailymotion.com/video/abc123',
                    title: 'Daily Motion Video',
                    expected: '[Video Content - dailymotion.com]'
                }
            ];

            testCases.forEach(({ url, title, expected }) => {
                const result = decryptor.filterVideoTitle(url, title);
                expect(result).toBe(expected);
            });
        });

        test('should filter video-like titles based on content patterns', () => {
            const testCases = [
                {
                    url: 'https://example.com/page',
                    title: 'Watch this amazing video tutorial',
                    expected: '[Video Content]'
                },
                {
                    url: 'https://example.com/page',
                    title: 'Tutorial: How to code - 15:30',
                    expected: '[Video Content]'
                },
                {
                    url: 'https://example.com/page',
                    title: 'Amazing content | YouTube',
                    expected: '[Video Content]'
                },
                {
                    url: 'https://example.com/page',
                    title: 'Cool Tutorial - YouTube',
                    expected: '[Video Content]'
                },
                {
                    url: 'https://example.com/page',
                    title: 'Learning video',
                    expected: '[Video Content]'
                },
                {
                    url: 'https://example.com/page',
                    title: 'Video: Introduction to Programming',
                    expected: '[Video Content]'
                }
            ];

            testCases.forEach(({ url, title, expected }) => {
                const result = decryptor.filterVideoTitle(url, title);
                expect(result).toBe(expected);
            });
        });

        test('should preserve non-video titles', () => {
            const testCases = [
                {
                    url: 'https://google.com/search?q=test',
                    title: 'Google Search Results',
                    expected: 'Google Search Results'
                },
                {
                    url: 'https://github.com/user/repo',
                    title: 'GitHub Repository',
                    expected: 'GitHub Repository'
                },
                {
                    url: 'https://stackoverflow.com/questions/123',
                    title: 'How to solve this programming problem?',
                    expected: 'How to solve this programming problem?'
                },
                {
                    url: 'https://news.com/article',
                    title: 'Breaking News: Important Event',
                    expected: 'Breaking News: Important Event'
                },
                {
                    url: 'https://example.com/blog',
                    title: 'My Blog Post About Technology',
                    expected: 'My Blog Post About Technology'
                }
            ];

            testCases.forEach(({ url, title, expected }) => {
                const result = decryptor.filterVideoTitle(url, title);
                expect(result).toBe(expected);
            });
        });

        test('should handle edge cases gracefully', () => {
            // Empty or null inputs
            expect(decryptor.filterVideoTitle('', '')).toBe('');
            expect(decryptor.filterVideoTitle('https://youtube.com', '')).toBe('[Video Content - youtube.com]');
            
            // Invalid URLs
            expect(decryptor.filterVideoTitle('not-a-url', 'Some Title')).toBe('Some Title');
            
            // Mixed case URLs (should normalize to lowercase)
            expect(decryptor.filterVideoTitle('https://YOUTUBE.COM/watch', 'Video Title')).toBe('[Video Content - youtube.com]');
        });

        test('should process history rows with video filtering', () => {
            const historyRow = {
                url: 'https://www.youtube.com/watch?v=abc123',
                title: 'Amazing Tutorial Video - Learn JavaScript',
                visit_count: 5,
                last_visit_time: 13260000000000000 // Chrome timestamp format
            };

            const result = decryptor.processHistoryRow(historyRow);
            
            expect(result).toEqual({
                url: 'https://www.youtube.com/watch?v=abc123',
                title: '[Video Content - youtube.com]',
                visitCount: 5,
                lastVisit: expect.any(String)
            });
        });

        test('should preserve normal history rows without video content', () => {
            const historyRow = {
                url: 'https://google.com/search?q=javascript',
                title: 'JavaScript - Google Search',
                visit_count: 3,
                last_visit_time: 13260000000000000
            };

            const result = decryptor.processHistoryRow(historyRow);
            
            expect(result).toEqual({
                url: 'https://google.com/search?q=javascript',
                title: 'JavaScript - Google Search',
                visitCount: 3,
                lastVisit: expect.any(String)
            });
        });
    });
});