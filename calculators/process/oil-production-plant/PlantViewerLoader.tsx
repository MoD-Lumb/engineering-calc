'use client';

import dynamic from 'next/dynamic';

// three.js needs the browser (WebGL, DOM), so the viewer is loaded on the client only.
// This also keeps three.js out of every other page's bundle.
const PlantViewer = dynamic(() => import('./PlantViewer'), {
  ssr: false,
  loading: () => (
    <div className="grid h-[520px] md:h-[620px] place-items-center rounded-lg border border-slate-200 dark:border-slate-800 bg-[#e4ebf2] dark:bg-[#0f1419] text-sm text-slate-500 dark:text-slate-400">
      Loading 3D model…
    </div>
  ),
});

export function PlantViewerLoader() {
  return <PlantViewer />;
}
