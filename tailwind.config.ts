import type { Config } from "tailwindcss";

const config: Config = {
    content: [
        "./pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./components/**/*.{js,ts,jsx,tsx,mdx}",
        "./app/**/*.{js,ts,jsx,tsx,mdx}",
        "./*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                background: {
                    DEFAULT: "#0a0a0c",
                    dark: "#0a0a0c",
                    light: "#141418",
                    card: "#18181c",
                },
                foreground: "#f4f4f5",
                primary: {
                    DEFAULT: "#10b981",
                    hover: "#34d399",
                },
                border: {
                    dark: "#27272a",
                    light: "#3f3f46",
                },
                muted: "#71717a",
                accent: "#06b6d4",
                danger: "#ef4444",
                warning: "#f59e0b",
                success: "#10b981",
            },
            fontFamily: {
                mono: ["JetBrains Mono", "Fira Code", "SF Mono", "monospace"],
                display: ["Inter", "system-ui", "-apple-system", "sans-serif"],
            },
            animation: {
                "pulse-glow": "pulse-glow 2s ease-in-out infinite",
                "slide-in": "slide-in 0.3s ease-out",
                "fade-in": "fade-in 0.2s ease-out",
            },
            keyframes: {
                "pulse-glow": {
                    "0%, 100%": { opacity: "1" },
                    "50%": { opacity: "0.5" },
                },
                "slide-in": {
                    from: { opacity: "0", transform: "translateY(10px)" },
                    to: { opacity: "1", transform: "translateY(0)" },
                },
                "fade-in": {
                    from: { opacity: "0" },
                    to: { opacity: "1" },
                },
            },
            boxShadow: {
                glow: "0 0 20px rgba(16, 185, 129, 0.25), 0 0 40px rgba(16, 185, 129, 0.1)",
                "glow-lg": "0 0 30px rgba(16, 185, 129, 0.4), 0 0 60px rgba(16, 185, 129, 0.2)",
            },
        },
    },
    plugins: [],
};

export default config;
