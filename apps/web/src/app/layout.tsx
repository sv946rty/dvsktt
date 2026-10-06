import type { Metadata, Viewport } from 'next';
import { Be_Vietnam_Pro, Newsreader, Noto_Serif_TC } from 'next/font/google';
import { PREPAINT } from '@/lib/prefs/prefs';
import './globals.css';
import './reader.css';

const ui = Be_Vietnam_Pro({ subsets: ['latin', 'vietnamese'], weight: ['400', '500', '600'], variable: '--f-ui', display: 'swap' });
const vi = Newsreader({ subsets: ['latin', 'vietnamese'], weight: ['400', '600'], style: ['normal', 'italic'], variable: '--f-vi', display: 'swap' });
const zh = Noto_Serif_TC({ weight: ['400', '600'], variable: '--f-zh', display: 'swap', preload: false });

export const metadata: Metadata = {
  title: { default: 'Đại Việt Sử Ký Toàn Thư', template: '%s · Đại Việt Sử Ký Toàn Thư' },
  description: 'Đọc song song Đại Việt sử ký toàn thư: nguyên văn Hán, bản dịch tiếng Việt và tiếng Anh. Bản thử riêng tư.',
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="vi" className={`${ui.variable} ${vi.variable} ${zh.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: PREPAINT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
