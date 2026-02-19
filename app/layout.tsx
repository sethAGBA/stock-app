import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AuthProvider } from "@/lib/auth-context";
import { NotificationProvider } from "@/lib/notification-context";
import { Toaster } from "react-hot-toast";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Gestion de Stock — Vision+ Consulting",
  description: "Logiciel de gestion de stock développé par TOGOCARE",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className={`${inter.variable} font-sans antialiased`}>
        <AuthProvider>
          <NotificationProvider>
            {children}
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
