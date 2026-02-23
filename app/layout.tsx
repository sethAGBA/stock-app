import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AuthProvider } from "@/lib/auth-context";
import { NotificationProvider } from "@/lib/notification-context";
import { Toaster } from "react-hot-toast";
import ConnectionStatus from "@/components/common/ConnectionStatus";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const viewport = {
  themeColor: "#B8935A",
};

export const metadata: Metadata = {
  title: "Gestion de Stock — Vision+ Consulting",
  description: "Logiciel de gestion de stock développé par TogoStock",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "TogoStock",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className={`${inter.variable} font-sans antialiased`}>
        <AuthProvider>
          <NotificationProvider>
            {children}
            <ConnectionStatus />
            <Toaster position="top-right" toastOptions={{
              style: { fontFamily: "var(--font-inter)", fontSize: "13px" },
              success: { iconTheme: { primary: "#B8935A", secondary: "#fff" } }
            }} />
          </NotificationProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
