import './globals.css'
import { Inter, Poppins } from 'next/font/google'
import { Providers } from '@/components/providers'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

const poppins = Poppins({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-poppins',
})

export const metadata = {
  title: 'Tandym.ai - Your AI Twin for YouTube Creators',
  description: 'Create an AI twin that chats with your fans, references your YouTube videos, and drives engagement 24/7. Host it on a dedicated page, embed it on your site, and soon — let fans talk to it by voice.',
  keywords: 'AI twin, YouTube creators, AI chatbot, creator tools, fan engagement, AI replica, content creator platform',
  openGraph: {
    title: 'Tandym.ai - Your AI Twin for YouTube Creators',
    description: 'Create an AI twin that chats with your fans 24/7, powered by your YouTube videos.',
    type: 'website',
    locale: 'en_US',
    siteName: 'Tandym.ai',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tandym.ai - Your AI Twin for YouTube Creators',
    description: 'Create an AI twin that chats with your fans 24/7, powered by your YouTube videos.',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable} ${poppins.variable}`}>
      <body className={inter.className}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}