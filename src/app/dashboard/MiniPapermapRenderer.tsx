'use client';
import { useEffect, useRef } from 'react';
import { MindMapProvider, PdfViewerProvider } from '@/app/papermap/context';
import { useMindMap } from '@/app/papermap/hooks/useMindMap';
import MindMapFlow from '@/app/papermap/components/MindMapFlow';
import { ReactFlowProvider } from 'reactflow';

export default function MiniPapermapRenderer({ nodes }: { nodes: any[] }) {
  const mindMap = useMindMap() as any;
  
  const mindMapRef = useRef(mindMap);
  mindMapRef.current = mindMap;
  
  useEffect(() => {
    if (nodes && nodes.length > 0) {
      mindMapRef.current.setMindMapData({ nodes });
      mindMapRef.current.setLoading(false);
    }
  }, [nodes]);

  return (
    <PdfViewerProvider>
      <MindMapProvider value={mindMap}>
        <ReactFlowProvider>
          <div className="w-full h-[500px] relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
            <MindMapFlow isOwner={false} onInteract={() => {}} />
          </div>
        </ReactFlowProvider>
      </MindMapProvider>
    </PdfViewerProvider>
  );
}
