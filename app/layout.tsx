import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { PWARegister } from "@/components/PWARegister";
import { Sidebar } from "@/components/Sidebar";
import { Navbar } from "@/components/Navbar";
import { BottomNav } from "@/components/BottomNav";

const outfit = Outfit({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Inventory App",
  description: "E-Commerce Inventory Management System",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`h-full antialiased bg-gray-50`}>
      <body className={`${outfit.className} h-full flex overflow-hidden`}>
        <PWARegister />
        
        {/* Sidebar */}
        <Sidebar />

        {/* Main Content Wrapper */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden pb-16 md:pb-0">
          {/* Navbar */}
          <Navbar />

          {/* Main Scrollable Content */}
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
            {children}
          </main>
        </div>

        {/* Mobile Bottom Navigation */}
        <BottomNav />
      </body>
    </html>
  );
}
