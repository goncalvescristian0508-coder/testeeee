import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Instagram Bot',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#0a0a0a', color: '#f1f1f1' }}>
        {children}
      </body>
    </html>
  );
}
