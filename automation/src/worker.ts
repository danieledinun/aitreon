import { config } from './config.js';
import { tandymClient } from './tandym-client.js';
import { sessionManager } from './session-manager.js';
import { fetchVideoComments, getRecentVideoUrls, postReply, humanDelay } from './youtube-connector.js';

let isRunning = false;

export async function runPollCycle(): Promise<void> {
  if (isRunning) {
    console.log('[worker] Poll cycle already in progress, skipping');
    return;
  }

  isRunning = true;
  console.log('[worker] Starting poll cycle');

  try {
    const creators = await tandymClient.getActiveCreators();
    console.log(`[worker] Found ${creators.length} active creator(s)`);

    for (const creator of creators) {
      if (!creator.refreshToken) {
        console.warn(`[worker] Creator ${creator.username} has no refresh token, skipping`);
        continue;
      }

      try {
        await processCreator(creator);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[worker] Error processing creator ${creator.username}: ${message}`);
        await tandymClient.reportSessionHealth(creator.creatorId, 'error', message).catch(() => {});
        await sessionManager.closeSession(creator.creatorId);
      }
    }

    await sessionManager.closeIdleSessions();
  } catch (error) {
    console.error('[worker] Poll cycle error:', error instanceof Error ? error.message : error);
  } finally {
    isRunning = false;
    console.log('[worker] Poll cycle complete');
  }
}

async function processCreator(creator: {
  creatorId: string;
  username: string;
  youtubeChannelUrl: string;
  refreshToken: string;
}): Promise<void> {
  console.log(`[worker] Processing creator: ${creator.username}`);

  const settings = await tandymClient.getSettings(creator.creatorId);

  if (!settings.isEnabled) {
    console.log(`[worker] Auto-replies disabled for ${creator.username}, skipping`);
    return;
  }

  // Get authenticated browser page
  const page = await sessionManager.getOrCreateSession(creator.creatorId, creator.refreshToken);
  await tandymClient.reportSessionHealth(creator.creatorId, 'active');

  // Get recent videos from channel
  const allVideos = await getRecentVideoUrls(page, creator.youtubeChannelUrl, 20);
  const videos = filterVideos(allVideos, settings);
  console.log(`[worker] Found ${videos.length} video(s) to process for ${creator.username}`);

  for (const video of videos) {
    try {
      // Scrape comments from video
      const scrapedComments = await fetchVideoComments(page, video.url);
      console.log(`[worker] Scraped ${scrapedComments.length} comment(s) from "${video.title}"`);

      // Apply keyword filters
      const filtered = filterComments(scrapedComments, settings);

      if (filtered.length === 0) continue;

      // Submit comments to Tandym API
      const commentsPayload = filtered.map(c => ({
        platformCommentId: c.platformCommentId,
        videoId: video.videoId,
        videoTitle: video.title,
        authorName: c.authorName,
        authorChannelId: c.authorChannelId,
        commentText: c.commentText,
        commentDate: c.commentDate,
      }));

      const { inserted } = await tandymClient.submitComments(creator.creatorId, commentsPayload);
      console.log(`[worker] Submitted ${inserted} new comment(s) for "${video.title}"`);

      // Generate and post replies for new comments
      for (const comment of commentsPayload) {
        try {
          // Generate AI reply
          const { replyText, commentId } = await tandymClient.generateReply(comment.platformCommentId);

          if (!replyText) continue;

          // Wait with human-like delay before posting
          await humanDelay(settings.minDelaySeconds, settings.maxDelaySeconds);

          // Navigate back to video if needed and post reply
          const currentUrl = page.url();
          if (!currentUrl.includes(video.videoId)) {
            await page.goto(video.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            // Scroll to load comments
            for (let i = 0; i < 5; i++) {
              await page.evaluate(() => window.scrollBy(0, 600));
              await page.waitForTimeout(1500);
            }
          }

          await postReply(page, comment.platformCommentId, replyText);
          await tandymClient.reportStatus(commentId, 'posted');
          console.log(`[worker] Posted reply to comment ${comment.platformCommentId}`);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.error(`[worker] Failed to reply to comment ${comment.platformCommentId}: ${message}`);
          await tandymClient.reportStatus(comment.platformCommentId, 'failed', message).catch(() => {});
        }
      }
    } catch (error) {
      console.error(`[worker] Error processing video ${video.videoId}:`, error instanceof Error ? error.message : error);
    }
  }
}

function filterVideos(
  videos: { videoId: string; title: string; url: string }[],
  settings: { videoFilter: string; videoFilterDays: number | null; selectedVideoIds: string[] }
): { videoId: string; title: string; url: string }[] {
  switch (settings.videoFilter) {
    case 'selected':
      return videos.filter(v => settings.selectedVideoIds.includes(v.videoId));
    case 'recent':
      // When using 'recent' filter, limit to the first N videos (already sorted by recency)
      const maxVideos = settings.videoFilterDays || 7;
      return videos.slice(0, maxVideos);
    case 'all':
    default:
      return videos;
  }
}

function filterComments(
  comments: { platformCommentId: string; authorName: string; authorChannelId: string; commentText: string; commentDate: string }[],
  settings: { filterKeywords: string[]; requireKeywords: string[] }
): typeof comments {
  return comments.filter(comment => {
    const text = comment.commentText.toLowerCase();

    // Exclude comments containing filter keywords
    if (settings.filterKeywords.length > 0) {
      const hasExcluded = settings.filterKeywords.some(kw => text.includes(kw.toLowerCase()));
      if (hasExcluded) return false;
    }

    // Require at least one keyword if requireKeywords is set
    if (settings.requireKeywords.length > 0) {
      const hasRequired = settings.requireKeywords.some(kw => text.includes(kw.toLowerCase()));
      if (!hasRequired) return false;
    }

    return true;
  });
}

let pollInterval: ReturnType<typeof setInterval> | null = null;

export function startWorker(): void {
  console.log(`[worker] Starting with poll interval of ${config.pollIntervalMs}ms`);

  // Run first cycle immediately
  runPollCycle();

  // Then run on interval
  pollInterval = setInterval(() => {
    runPollCycle();
  }, config.pollIntervalMs);
}

export function stopWorker(): void {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
    console.log('[worker] Stopped');
  }
}
