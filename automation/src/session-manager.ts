import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { loginToYouTube } from './youtube-connector.js';

interface Session {
  context: BrowserContext;
  page: Page;
  lastUsed: number;
}

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

class SessionManager {
  private browser: Browser | null = null;
  private sessions = new Map<string, Session>();

  async ensureBrowser(): Promise<Browser> {
    if (!this.browser || !this.browser.isConnected()) {
      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
      });
      console.log('[session-manager] Browser launched');
    }
    return this.browser;
  }

  async getOrCreateSession(creatorId: string, refreshToken: string): Promise<Page> {
    const existing = this.sessions.get(creatorId);
    if (existing) {
      existing.lastUsed = Date.now();
      // Check if page is still usable
      try {
        await existing.page.evaluate(() => document.readyState);
        return existing.page;
      } catch {
        // Page is dead, clean up and recreate
        console.log(`[session-manager] Session for ${creatorId} is stale, recreating`);
        await this.closeSession(creatorId);
      }
    }

    const browser = await this.ensureBrowser();
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 720 },
      locale: 'en-US',
    });

    // Authenticate with YouTube
    await loginToYouTube(context, refreshToken);

    const page = await context.newPage();
    const session: Session = { context, page, lastUsed: Date.now() };
    this.sessions.set(creatorId, session);

    console.log(`[session-manager] Created session for creator ${creatorId}`);
    return page;
  }

  async closeSession(creatorId: string): Promise<void> {
    const session = this.sessions.get(creatorId);
    if (session) {
      await session.context.close().catch(() => {});
      this.sessions.delete(creatorId);
      console.log(`[session-manager] Closed session for creator ${creatorId}`);
    }
  }

  async closeIdleSessions(): Promise<void> {
    const now = Date.now();
    for (const [creatorId, session] of this.sessions) {
      if (now - session.lastUsed > IDLE_TIMEOUT_MS) {
        await this.closeSession(creatorId);
      }
    }
  }

  async closeAll(): Promise<void> {
    for (const creatorId of [...this.sessions.keys()]) {
      await this.closeSession(creatorId);
    }
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
      console.log('[session-manager] Browser closed');
    }
  }

  get activeSessionCount(): number {
    return this.sessions.size;
  }
}

export const sessionManager = new SessionManager();
