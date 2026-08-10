import { ReactNode } from 'react';
import { SessionProvider } from 'next-auth/react';
import { CompanyProvider } from '@/components/CompanyProvider';
import { Toaster } from 'react-hot-toast';
import { Allura } from "next/font/google";
import './globals.css';

export const metadata = {
  title: 'HRMS',
  description: 'Employee Attendance & Payroll Management System',
};



const allura = Allura({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-allura",
});


import PushNotificationInitializer from '@/components/PushNotificationInitializer';
import WebPushInitializer from '@/components/WebPushInitializer';

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.documentElement.classList.add('dark')
                } else {
                  document.documentElement.classList.remove('dark')
                }
              } catch (_) {}
            `,
          }}
        />
      </head>
      <body className="min-h-screen font-sans antialiased bg-background text-foreground">
        <SessionProvider>
          <CompanyProvider>
            <PushNotificationInitializer />
            <div className="container mx-auto px-4">
              <WebPushInitializer />
            </div>
            {children}
            <Toaster position="bottom-right" />
          </CompanyProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
