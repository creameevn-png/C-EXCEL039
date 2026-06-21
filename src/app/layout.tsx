import './globals.css';
import type { Metadata } from 'next';
import { ToastProvider } from '@/components/Toast';

export const metadata: Metadata = {
  title: process.env.APP_NAME || 'Quản Lý Ship Trung Việt',
  description: 'Hệ thống quản lý nhập hàng Trung Quốc'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
