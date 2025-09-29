# Aitrion - AI Creator Platform

A Patreon-style platform where creators can host AI versions of themselves that fans can interact with via webchat, text, and voice.

## Features

### Creator Side
- **Authentication**: Google/YouTube login integration
- **YouTube Integration**: Automatic content ingestion from YouTube channels
- **AI Training**: Process video transcripts to create personalized AI replicas
- **Creator Dashboard**: Manage profile, view subscribers, and track earnings
- **Custom Landing Pages**: Personal pages at `aitrion.com/[username]`

### Fan Experience
- **Free Access**: 5 AI interactions per day per creator
- **Premium Subscriptions**: Unlimited access for $5/month
- **Interactive Chat**: Real-time conversations with AI replicas
- **Content Citations**: AI responses include video sources and timestamps
- **Voice Features**: Generate voice responses (premium only)

### Platform Features
- **Payment Processing**: Stripe Connect with 10% platform commission
- **Admin Dashboard**: Platform metrics and creator management
- **Voice Integration**: ElevenLabs for speech generation, Twilio for calling
- **Content Grounding**: AI responses only use creator's actual content

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Prisma ORM
- **Database**: PostgreSQL
- **Authentication**: NextAuth.js with Google OAuth
- **Payments**: Stripe Connect
- **AI**: OpenAI GPT-4 for responses, text-embedding-ada-002 for content search
- **Voice**: ElevenLabs for text-to-speech, Twilio for calling/SMS
- **External APIs**: YouTube Data API v3

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL database
- Required API keys (see Environment Variables)

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd aitrion
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Fill in your environment variables:
   ```env
   # Database
   DATABASE_URL="postgresql://username:password@localhost:5432/aitrion"
   
   # NextAuth
   NEXTAUTH_URL="http://localhost:3000"
   NEXTAUTH_SECRET="your-secret-here"
   
   # Google OAuth & YouTube API
   GOOGLE_CLIENT_ID="your-google-client-id"
   GOOGLE_CLIENT_SECRET="your-google-client-secret"
   YOUTUBE_API_KEY="your-youtube-api-key"
   
   # OpenAI
   OPENAI_API_KEY="your-openai-api-key"
   
   # Stripe
   STRIPE_PUBLISHABLE_KEY="pk_test_..."
   STRIPE_SECRET_KEY="sk_test_..."
   STRIPE_WEBHOOK_SECRET="whsec_..."
   
   # ElevenLabs
   ELEVENLABS_API_KEY="your-elevenlabs-api-key"
   
   # Twilio
   TWILIO_ACCOUNT_SID="your-twilio-account-sid"
   TWILIO_AUTH_TOKEN="your-twilio-auth-token"
   TWILIO_PHONE_NUMBER="your-twilio-phone-number"
   ```

4. **Set up the database**
   ```bash
   npm run db:push
   ```

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to `http://localhost:3000`

### Setting Up External Services

#### Google OAuth & YouTube API
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable YouTube Data API v3
4. Create OAuth 2.0 credentials
5. Add authorized redirect URIs: `http://localhost:3000/api/auth/callback/google`

#### Stripe Connect
1. Create a [Stripe account](https://stripe.com/)
2. Enable Connect in your dashboard
3. Set up webhooks for subscription events
4. Configure webhook endpoint: `http://localhost:3000/api/webhooks/stripe`

#### OpenAI
1. Create an [OpenAI account](https://openai.com/)
2. Generate an API key from the dashboard
3. Ensure you have access to GPT-4 and embedding models

#### ElevenLabs
1. Sign up at [ElevenLabs](https://elevenlabs.io/)
2. Get your API key from settings
3. Browse available voices or create custom ones

#### Twilio
1. Create a [Twilio account](https://twilio.com/)
2. Get a phone number for SMS/voice
3. Get your Account SID and Auth Token

## Project Structure

```
aitrion/
├── app/                    # Next.js app directory
│   ├── [username]/        # Dynamic creator pages
│   ├── admin/             # Admin dashboard
│   ├── api/               # API routes
│   ├── auth/              # Authentication pages
│   ├── creator/           # Creator setup
│   ├── dashboard/         # User dashboard
│   └── subscribe/         # Subscription pages
├── components/            # React components
├── lib/                   # Utility libraries
│   ├── ai.ts             # AI service (OpenAI integration)
│   ├── auth.ts           # NextAuth configuration
│   ├── prisma.ts         # Database client
│   ├── stripe.ts         # Stripe service
│   ├── voice.ts          # Voice services
│   └── youtube.ts        # YouTube API integration
├── prisma/               # Database schema
└── public/               # Static assets
```

## API Routes

### Authentication
- `POST /api/auth/[...nextauth]` - NextAuth endpoints

### Creator Management
- `POST /api/creator/setup` - Create creator profile

### Chat & AI
- `POST /api/chat` - Send message to AI replica

### Subscriptions
- `POST /api/subscriptions/create` - Create subscription
- `POST /api/webhooks/stripe` - Stripe webhook handler

### Voice Features
- `POST /api/voice/generate` - Generate speech from text
- `POST /api/voice/call` - Initiate voice call

## Database Schema

The application uses PostgreSQL with Prisma ORM. Key models include:

- **User**: User accounts and authentication
- **Creator**: Creator profiles and settings
- **Video**: YouTube video content and transcripts
- **ContentChunk**: Processed content pieces for AI training
- **Subscription**: Fan subscriptions to creators
- **ChatSession**: Chat conversations
- **Message**: Individual chat messages with citations
- **DailyUsage**: Track daily message limits

## Development

### Database Operations
```bash
# Generate Prisma client
npm run db:generate

# Push schema changes
npm run db:push

# Create and run migrations
npm run db:migrate

# Open Prisma Studio
npm run db:studio
```

### Code Quality
```bash
# Lint code
npm run lint

# Type checking
npx tsc --noEmit
```

## Deployment

### Environment Setup
1. Set up production database (PostgreSQL)
2. Configure all environment variables for production
3. Set up Stripe webhooks with production URL
4. Configure domain and OAuth redirect URLs

### Vercel Deployment
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### Database Migration
```bash
# Run migrations in production
npx prisma migrate deploy
```

## MVP Features Checklist

- ✅ Creator authentication with Google/YouTube
- ✅ YouTube content ingestion and processing
- ✅ AI replica engine with content grounding
- ✅ Creator landing pages with chat interface
- ✅ Fan interaction limits (5 messages/day)
- ✅ AI-powered chat interactions
- ✅ Admin dashboard for platform metrics
- ✅ Basic voice features with ElevenLabs/Twilio

## Future Enhancements

### Short Term
- Vector search for better content matching
- Real-time voice calling
- Mobile app
- Multiple subscription tiers
- Creator analytics dashboard

### Long Term
- Voice cloning from creator content
- Video responses
- Live streaming integration
- Creator collaboration features
- Advanced AI personality customization

## Support

For issues and feature requests, please create an issue in the repository.

## License

This project is licensed under the MIT License.