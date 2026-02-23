import { config } from './config.js';

interface ActiveCreator {
  creatorId: string;
  username: string;
  youtubeChannelId: string;
  youtubeChannelUrl: string;
  refreshToken: string;
}

interface AutoReplySettings {
  isEnabled: boolean;
  toneOverride: string;
  maxRepliesPerDay: number;
  videoFilter: 'all' | 'recent' | 'selected';
  videoFilterDays: number | null;
  selectedVideoIds: string[];
  filterKeywords: string[];
  requireKeywords: string[];
  minDelaySeconds: number;
  maxDelaySeconds: number;
}

interface SubmitComment {
  platformCommentId: string;
  videoId: string;
  videoTitle: string;
  authorName: string;
  authorChannelId: string;
  commentText: string;
  commentDate: string;
  parentCommentId?: string;
}

interface GenerateReplyResponse {
  replyText: string;
  commentId: string;
}

class TandymApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'TandymApiError';
  }
}

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${config.tandymApiUrl}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.automationApiKey,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new TandymApiError(response.status, `API ${options.method || 'GET'} ${path} failed (${response.status}): ${body}`);
  }

  return response.json() as Promise<T>;
}

export const tandymClient = {
  async getActiveCreators(): Promise<ActiveCreator[]> {
    const data = await apiRequest<{ creators: ActiveCreator[] }>('/api/social/pending');
    return data.creators;
  },

  async getSettings(creatorId: string): Promise<AutoReplySettings> {
    const data = await apiRequest<{ settings: AutoReplySettings }>(
      `/api/social/settings?creatorId=${encodeURIComponent(creatorId)}`
    );
    return data.settings;
  },

  async submitComments(creatorId: string, comments: SubmitComment[]): Promise<{ inserted: number }> {
    return apiRequest<{ inserted: number }>('/api/social/comments', {
      method: 'POST',
      body: JSON.stringify({ creatorId, comments }),
    });
  },

  async generateReply(commentId: string): Promise<GenerateReplyResponse> {
    return apiRequest<GenerateReplyResponse>('/api/social/generate-reply', {
      method: 'POST',
      body: JSON.stringify({ commentId }),
    });
  },

  async reportStatus(commentId: string, status: 'posted' | 'failed', failureReason?: string): Promise<void> {
    await apiRequest('/api/social/report-status', {
      method: 'POST',
      body: JSON.stringify({ commentId, status, failureReason }),
    });
  },

  async reportSessionHealth(
    creatorId: string,
    sessionStatus: 'active' | 'degraded' | 'expired' | 'error',
    lastError?: string
  ): Promise<void> {
    await apiRequest('/api/social/session-health', {
      method: 'POST',
      body: JSON.stringify({ creatorId, sessionStatus, lastError }),
    });
  },
};
