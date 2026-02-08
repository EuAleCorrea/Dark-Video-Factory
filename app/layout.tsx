import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "Dark Factory | AI Video Console",
    description: "AI-Powered Video Orchestration Platform",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="pt-BR" className="dark" suppressHydrationWarning>
            <head>
                <link
                    href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Inter:wght@300;400;500;600;700&display=swap"
                    rel="stylesheet"
                />
                <link
                    href="https://fonts.googleapis.com/icon?family=Material+Icons+Round"
                    rel="stylesheet"
                />
            </head>
            <body className="bg-[#0a0a0a] text-slate-100 h-screen w-screen overflow-hidden antialiased selection:bg-primary selection:text-black" suppressHydrationWarning>
                <div id="root" className="h-full flex flex-col">
                    {children}
                </div>
            </body>
        </html>
    );
}
