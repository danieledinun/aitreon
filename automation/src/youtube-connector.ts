import type { BrowserContext, Page } from 'playwright';
import { config } from './config.js';

interface ScrapedComment {
  platformCommentId: string;
  authorName: string;
  authorChannelId: string;
  commentText: string;
  commentDate: string;
}

/**
 * Exchange a refresh token for a fresh access token via Google OAuth.
 */
export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.googleClientId,
      client_secret: config.googleClientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Token refresh failed (${response.status}): ${body}`);
  }

  const data = await response.json() as { access_token: string };
  return data.access_token;
}

/**
 * Authenticate a Playwright browser context with YouTube using a Google access token.
 * Sets the required auth cookies so subsequent navigations are logged in.
 */
export async function loginToYouTube(context: BrowserContext, refreshToken: string): Promise<void> {
  const accessToken = await refreshAccessToken(refreshToken);

  // Use the access token to get user info and establish a Google session
  const page = await context.newPage();

  try {
    // Navigate to accounts.google.com with the access token to set cookies
    await page.goto('https://accounts.google.com/o/oauth2/auth?' + new URLSearchParams({
      client_id: config.googleClientId,
      redirect_uri: 'https://www.youtube.com',
      response_type: 'token',
      scope: 'https://www.googleapis.com/auth/youtube.force-ssl',
      access_type: 'offline',
      login_hint: 'auto',
    }).toString(), { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});

    // Set OAuth cookies directly for YouTube domain
    await context.addCookies([
      {
        name: 'oauth_token',
        value: accessToken,
        domain: '.youtube.com',
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'None',
      },
    ]);

    // Navigate to YouTube and verify login
    await page.goto('https://www.youtube.com', { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Dismiss consent dialogs if present
    const consentButton = page.locator('button:has-text("Accept all"), button:has-text("I agree"), [aria-label="Accept all"]');
    if (await consentButton.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await consentButton.first().click();
      await page.waitForTimeout(2000);
    }

    // Verify we're logged in by checking for avatar/sign-in button
    const isLoggedIn = await page.locator('#avatar-btn, button[aria-label="Sign in"]')
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (!isLoggedIn) {
      console.warn('[youtube-connector] Could not verify YouTube login status - proceeding anyway');
    }
  } finally {
    await page.close();
  }
}

/**
 * Get recent video URLs from a YouTube channel's videos tab.
 */
export async function getRecentVideoUrls(
  page: Page,
  channelUrl: string,
  maxVideos: number = 10
): Promise<{ videoId: string; title: string; url: string }[]> {
  const videosTabUrl = channelUrl.replace(/\/$/, '') + '/videos';
  await page.goto(videosTabUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Scroll a bit to load video thumbnails
  await page.evaluate(() => window.scrollBy(0, 800));
  await page.waitForTimeout(1500);

  const videos = await page.evaluate((max: number) => {
    const items = document.querySelectorAll('ytd-rich-item-renderer, ytd-grid-video-renderer');
    const results: { videoId: string; title: string; url: string }[] = [];

    for (const item of items) {
      if (results.length >= max) break;

      const link = item.querySelector('a#video-title-link, a#video-title') as HTMLAnchorElement | null;
      if (!link) continue;

      const href = link.href;
      const match = href.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
      if (!match) continue;

      results.push({
        videoId: match[1],
        title: link.textContent?.trim() || '',
        url: `https://www.youtube.com/watch?v=${match[1]}`,
      });
    }

    return results;
  }, maxVideos);

  return videos;
}

/**
 * Fetch comments from a YouTube video page using Playwright.
 */
export async function fetchVideoComments(
  page: Page,
  videoUrl: string,
  maxComments: number = 50
): Promise<ScrapedComment[]> {
  await page.goto(videoUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

  // Scroll down to load comments section
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => window.scrollBy(0, 600));
    await page.waitForTimeout(1500 + Math.random() * 1000);
  }

  // Wait for comments to appear
  await page.waitForSelector('ytd-comment-thread-renderer', { timeout: 15000 }).catch(() => {
    console.warn('[youtube-connector] No comments found on page');
  });

  // Extra scroll to load more comments
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => window.scrollBy(0, 400));
    await page.waitForTimeout(1000 + Math.random() * 500);
  }

  const comments = await page.evaluate((max: number) => {
    const threads = document.querySelectorAll('ytd-comment-thread-renderer');
    const results: ScrapedComment[] = [];

    for (const thread of threads) {
      if (results.length >= max) break;

      const commentEl = thread.querySelector('ytd-comment-view-model, ytd-comment-renderer');
      if (!commentEl) continue;

      // Extract author info
      const authorEl = commentEl.querySelector('#author-text, .ytd-comment-view-model a') as HTMLAnchorElement | null;
      const authorName = authorEl?.textContent?.trim() || 'Unknown';
      const authorHref = authorEl?.href || '';
      const channelMatch = authorHref.match(/\/(channel|c|@)\/([^/?]+)/);
      const authorChannelId = channelMatch?.[2] || '';

      // Extract comment text
      const textEl = commentEl.querySelector('#content-text, .ytd-comment-view-model #content-text');
      const commentText = textEl?.textContent?.trim() || '';

      // Extract comment ID from action buttons or element attributes
      const actionMenu = commentEl.querySelector('ytd-menu-renderer');
      const commentId = commentEl.getAttribute('id') ||
        actionMenu?.getAttribute('data-comment-id') ||
        `scraped-${Date.now()}-${results.length}`;

      // Extract timestamp
      const timeEl = commentEl.querySelector('.published-time-text a, #header-author time, a.yt-simple-endpoint[href*="lc="]');
      const commentDate = timeEl?.textContent?.trim() || new Date().toISOString();

      if (commentText) {
        results.push({
          platformCommentId: commentId,
          authorName,
          authorChannelId,
          commentText,
          commentDate,
        });
      }
    }

    return results;
  }, maxComments);

  return comments;
}

/**
 * Post a reply to a specific comment on YouTube using Playwright.
 */
export async function postReply(page: Page, commentId: string, replyText: string): Promise<void> {
  // Find the comment element
  const commentEl = page.locator(`#${commentId}, [id="${commentId}"]`).first();

  // Scroll to the comment
  await commentEl.scrollIntoViewIfNeeded({ timeout: 5000 });
  await page.waitForTimeout(500 + Math.random() * 500);

  // Click the reply button
  const replyButton = commentEl.locator('ytd-button-renderer#reply-button-end button, [aria-label="Reply"]').first();
  await replyButton.click();
  await page.waitForTimeout(1000 + Math.random() * 500);

  // Wait for the reply input to appear
  const replyInput = page.locator('#contenteditable-root, [contenteditable="true"]').last();
  await replyInput.waitFor({ state: 'visible', timeout: 5000 });

  // Type with human-like delays
  for (const char of replyText) {
    await replyInput.pressSequentially(char, { delay: 30 + Math.random() * 70 });
  }

  await page.waitForTimeout(500 + Math.random() * 500);

  // Click submit button
  const submitButton = page.locator('#submit-button button, [aria-label="Reply"]').last();
  await submitButton.click();

  // Wait for reply to post
  await page.waitForTimeout(2000 + Math.random() * 1000);
}

/**
 * Random delay between min and max seconds.
 */
export async function humanDelay(minSeconds: number, maxSeconds: number): Promise<void> {
  const ms = (minSeconds + Math.random() * (maxSeconds - minSeconds)) * 1000;
  await new Promise(resolve => setTimeout(resolve, ms));
}
