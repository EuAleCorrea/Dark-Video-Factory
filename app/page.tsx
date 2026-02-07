
'use client';

import dynamic from 'next/dynamic';

// Import App dynamically to avoid SSR issues with browser-only APIs (localStorage, etc)
const App = dynamic(() => import('../App'), { ssr: false });

export default function Home() {
    return (
        <div className="h-full w-full flex flex-col">
            <App />
        </div>
    );
}
