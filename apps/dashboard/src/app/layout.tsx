import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/app/providers';
import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'OpenSalesAI Dashboard',
  description: 'AI-powered RTM intelligence',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="font-sans antialiased">
        <Providers>
          <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            <Sidebar />
            <TopBar />
            <main className="ml-64 mt-16 p-6">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
