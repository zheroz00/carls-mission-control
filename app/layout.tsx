import type { Metadata } from "next";
import { JetBrains_Mono, Space_Grotesk } from "next/font/google";
import Link from "next/link";
import { SidebarNav } from "@/components/sidebar-nav";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Mission Control",
    template: "%s | Mission Control",
  },
  description: "Mission operations dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${spaceGrotesk.variable} ${jetBrainsMono.variable} antialiased`}
      >
        <div className="relative min-h-screen overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(56,189,248,0.16),transparent_36%),radial-gradient(circle_at_80%_8%,rgba(59,130,246,0.14),transparent_34%)]" />
          <div className="relative mx-auto flex min-h-screen w-full max-w-[1600px]">
            <aside className="hidden w-64 shrink-0 border-r border-white/10 bg-black/35 px-6 py-8 backdrop-blur-xl lg:flex lg:flex-col">
              <Link href="/" className="mb-10 block">
                <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">
                  Mission
                </p>
                <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-100">
                  Control
                </p>
              </Link>
              <SidebarNav />
              <div className="mt-auto rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-xs text-slate-400">
                Live telemetry from local Mission Control APIs.
              </div>
            </aside>
            <div className="flex min-h-screen flex-1 flex-col">
              <header className="sticky top-0 z-20 border-b border-white/10 bg-[#090b10]/85 px-4 py-4 backdrop-blur-lg sm:px-6 lg:hidden">
                <div className="mb-3">
                  <Link href="/" className="text-lg font-semibold tracking-tight text-slate-100">
                    Mission Control
                  </Link>
                </div>
                <SidebarNav mobile />
              </header>
              <main className="flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
                {children}
              </main>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
