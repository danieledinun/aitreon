# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Important Guidelines

This is **Tandym.ai** — a production platform where YouTube creators launch AI twins of themselves that fans can interact with via text and voice. Tagline: *"You and your twin — in Tandym."*

All code changes and solutions must be:
- Production-ready and robust
- Applicable to any YouTube channel, not tailored to specific creators
- Scalable and performant for multiple concurrent users
- Secure and following best practices
- Use shadcn/ui design components and patterns for consistent, modern UI/UX
- Follow Tandym brand guidelines (Electric Cobalt #3256FF, Soft Lilac #C8B7FF, Coral #FF6F61; Poppins headlines, Inter body text)

## CRITICAL: Database Requirements

**NEVER USE PRISMA! ONLY USE SUPABASE CLIENT DIRECTLY!**
- All database operations MUST use the official Supabase JavaScript client
- NEVER import or use Prisma client (`db.model.create`, `db.model.findMany`, etc.)
- Use only: `supabase.from('table').insert()`, `supabase.from('table').select()`, etc.
- Import from: `import { createClient } from '@supabase/supabase-js'`
- Initialize with: `const supabase = createClient(url, key)`
- MCP Supabase tools are ONLY for Claude Code debugging/inspection, NOT for production app code

## CRITICAL: Field Naming Conventions

**ALWAYS follow these field naming rules to prevent database mapping bugs:**

### Database Layer (Supabase/PostgreSQL)
- Uses **snake_case** column names: `user_id`, `creator_id`, `youtube_channel_url`
- Database tables store all fields in snake_case format

### Application Layer (TypeScript/React/APIs)
- Uses **camelCase** field names: `userId`, `creatorId`, `youtubeChannelUrl`
- All TypeScript interfaces, React components, and API parameters use camelCase

### Database Service Translation Rules
When working with Supabase operations:
- **API Methods RECEIVE**: camelCase parameters (`{ creatorId: "abc123" }`)
- **Supabase Queries USE**: snake_case columns (`supabase.from('table').eq('creator_id', creatorId)`)
- **NEVER mix**: Do not use `creator_id` in application code or `creatorId` in database queries
- **NEVER use Prisma**: All database operations must use Supabase client directly

### Common Field Mappings
```typescript
// ✅ CORRECT - Application to Database
{ creatorId: "123" }        → WHERE creator_id = '123'
{ userId: "456" }           → WHERE user_id = '456'
{ youtubeChannelUrl: "..." } → WHERE youtube_channel_url = '...'

// ❌ INCORRECT - These cause silent failures
{ creator_id: "123" }       → Application layer should never use snake_case
WHERE creatorId = '123'     → Database queries should never use camelCase
```

### Validation Checklist
Before submitting any database-related code:
1. **API Routes**: Use camelCase in request/response objects
2. **Database Service**: Translate camelCase → snake_case in queries
3. **Frontend Components**: Use camelCase for all props and state
4. **Type Definitions**: Define interfaces with camelCase fields
5. **Error Handling**: Check for field mapping issues in database errors

## Development Commands

### Core Development
```bash
npm run dev          # Start development server (localhost:3000)
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Lint code with ESLint
npx tsc --noEmit     # TypeScript type checking
```

### Database Operations
Database is managed via Supabase. Use the Supabase MCP tools for inspection/debugging, and the Supabase JS client in application code. Schema changes are applied via Supabase migrations.

### GraphRAG Services
```bash
npm run graphrag:install    # Install Python dependencies for GraphRAG service
npm run graphrag:dev        # Run GraphRAG service locally
npm run graphrag:docker     # Start GraphRAG + Neo4j with Docker Compose
npm run graphrag:stop       # Stop GraphRAG Docker containers
```

## Architecture Overview

This is **Tandym.ai** — a platform where YouTube creators launch AI twins of themselves that fans can interact with via dedicated pages, embeddable widgets, and voice chat. Creators connect their YouTube channel, and Tandym ingests their content to power an always-on AI twin.

### Core Architecture

**Frontend**: Next.js 14 App Router with TypeScript, Tailwind CSS, and shadcn/ui components (shadcn MCP available)

**Backend**: Next.js API routes with Supabase (PostgreSQL)

**AI System**: Multi-layered approach:
- OpenAI GPT-4 for chat responses
- text-embedding-ada-002 for content embeddings
- Custom content grounding system in `lib/ai.ts`
- GraphRAG integration for advanced knowledge graph processing

**Authentication**: NextAuth.js with Google OAuth, YouTube API integration for content creators

### Key Data Flow

1. **Creator Onboarding**: Google/YouTube login → Channel data extraction → Content processing
2. **Content Processing**: YouTube transcripts → Content chunks → Embeddings → Knowledge base
3. **Fan Interaction**: User query → Content retrieval → AI response generation → Citations
4. **GraphRAG Integration**: Content → Neo4j graph → Enhanced context retrieval

### Core Services

**AI Service** (`lib/ai.ts`): Content matching, embeddings, response generation with citations
**YouTube Service** (`lib/youtube.ts`): Channel data, video metadata, transcript extraction  
**Auth Service** (`lib/auth.ts`): NextAuth configuration, token refresh, creator profile creation
**Voice Services** (`lib/voice.ts`): ElevenLabs TTS, Twilio calling integration

### Database Schema

**Core Models**:
- `User` → `Creator` (1:1) → `Video` (1:N) → `ContentChunk` (1:N)
- `User` → `Subscription` (N:M) ← `Creator`
- `ChatSession` → `Message` → `Citation`
- `AiConfig`, `VoiceSettings`, `DailyUsage` for creator customization and limits

### GraphRAG Integration

Located in `services/graphrag/` with Docker setup in `docker-compose.graphrag.yml`:
- Neo4j database for knowledge graphs
- Python service for advanced content processing
- API endpoints: `/api/creator/graphrag/process`, `/api/creator/graphrag-episodes`, `/api/creator/graphrag-stats`

### Key Directories

```
app/                    # Next.js app router
├── [username]/        # Dynamic creator landing pages
├── creator/           # Creator dashboard and setup
├── api/               # API routes (auth, chat, subscriptions, etc.)
└── admin/             # Platform admin dashboard

components/            # Reusable React components
lib/                   # Core services and utilities
services/graphrag/    # Python GraphRAG service
scripts/              # Utility scripts and database operations
```

### External Integrations

- **YouTube Data API v3**: Channel and video metadata
- **OpenAI API**: GPT-4 chat, text-embedding-ada-002
- **ElevenLabs API**: Text-to-speech for voice features
- **Twilio**: SMS and voice calling features
- **Neo4j**: Graph database for advanced content relationships

### Environment Requirements

Essential environment variables (see `.env.example`):
- Database: `DATABASE_URL`
- NextAuth: `NEXTAUTH_URL`, `NEXTAUTH_SECRET`
- Google/YouTube: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `YOUTUBE_API_KEY`
- OpenAI: `OPENAI_API_KEY`
- Voice: `ELEVENLABS_API_KEY`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`

### Development Notes

- Database is PostgreSQL via Supabase (both dev and production)
- Creator content is processed into chunks for AI training
- Free users get 5 messages/day per creator, premium unlimited
- All AI responses must cite actual creator content
- Voice features are premium-only
- Platform takes 10% commission on subscriptions
- See `TANDYM_REBRAND.md` for full brand guidelines, color palette, typography, and component patterns