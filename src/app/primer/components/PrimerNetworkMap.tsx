'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as THREE from 'three';
import { Loader2, Network } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface GraphItem {
  id: string;
  parentId: string | null;
  title: string | null;
  topic: string;
}

interface GraphData {
  currentId: string;
  nodes: GraphItem[];
  truncated?: boolean;
}

interface PrimerNetworkMapProps {
  primerId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  }[character] || character));
}

export function PrimerNetworkMap({ primerId, open, onOpenChange }: PrimerNetworkMapProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const graphRef = useRef<any>(null);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetch(`/api/primer/graph?id=${encodeURIComponent(primerId)}`, { signal: controller.signal, cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error || 'Could not load learning network');
        setGraphData(data);
      })
      .catch((reason) => {
        if (reason?.name !== 'AbortError') setError(reason?.message || 'Could not load learning network');
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [open, primerId]);

  useEffect(() => {
    if (!open || !graphData || !containerRef.current) return;
    let active = true;

    (async () => {
      const { default: ForceGraph3D } = await import('3d-force-graph');
      if (!active || !containerRef.current) return;

      const nodeById = new Map(graphData.nodes.map((node) => [node.id, node]));
      const nodes = graphData.nodes.map((node) => ({
        ...node,
        label: node.title || node.topic,
        isCurrent: node.id === graphData.currentId,
      }));
      const links = graphData.nodes
        .filter((node) => node.parentId && nodeById.has(node.parentId))
        .map((node) => ({ source: node.parentId!, target: node.id }));

      const graph = new ForceGraph3D(containerRef.current)
        .backgroundColor('#020617')
        .showNavInfo(false)
        .enableNodeDrag(true)
        .nodeLabel((node: any) => `<div style="max-width:260px;padding:7px 10px;border-radius:8px;background:rgba(15,23,42,.92);color:white;font:500 12px/1.35 system-ui,sans-serif">${escapeHtml(node.label)}</div>`)
        .nodeThreeObject((node: any) => {
          const material = new THREE.MeshBasicMaterial({
            color: node.isCurrent ? '#f59e0b' : '#6366f1',
            transparent: true,
            opacity: node.isCurrent ? 1 : 0.88,
          });
          return new THREE.Mesh(new THREE.SphereGeometry(node.isCurrent ? 7 : 5, 20, 20), material);
        })
        .linkColor(() => '#818cf8')
        .linkWidth((link: any) => link.source === graphData.currentId || link.target === graphData.currentId ? 1.8 : 0.9)
        .linkOpacity(0.72)
        .linkCurvature(0.22)
        .linkCurveRotation(() => Math.PI / 5)
        .onNodeClick((node: any) => {
          onOpenChange(false);
          router.push(`/primer/${node.id}`);
        })
        .graphData({ nodes, links });

      graph.d3Force('charge')?.strength(-105);
      graph.d3Force('link')?.distance(78);
      graph.d3Force('center')?.strength(0.45);
      graphRef.current = graph;
    })().catch((reason) => {
      if (active) setError(reason?.message || 'Could not render learning network');
    });

    return () => {
      active = false;
      graphRef.current?._destructor?.();
      graphRef.current = null;
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
  }, [graphData, open, onOpenChange, router]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(96vw,1100px)] max-w-none overflow-hidden p-0" aria-describedby={undefined}>
        <DialogHeader className="border-b px-5 py-4 pr-12">
          <DialogTitle className="flex items-center gap-2"><Network className="h-4 w-4 text-primary" />Learning network</DialogTitle>
          <DialogDescription>Drag nodes to explore how your lessons attract and connect. Hover over a node for its title.</DialogDescription>
        </DialogHeader>
        <div className="relative h-[min(72vh,720px)] w-full overflow-hidden bg-slate-950/95">
          {loading ? (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-slate-300"><Loader2 className="h-5 w-5 animate-spin text-amber-400" />Loading network…</div>
          ) : error ? (
            <div className="flex h-full items-center justify-center text-sm text-red-300">{error}</div>
          ) : (
            <div ref={containerRef} className="h-full w-full" />
          )}
          {!loading && !error && graphData && <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/40 px-3 py-1 text-[11px] text-slate-300 backdrop-blur">Drag · orbit · scroll to zoom · hover for title</div>}
        </div>
        {graphData?.truncated && <p className="border-t px-5 py-2 text-xs text-muted-foreground">Showing the nearest 200 pages. Expand branches in the sidebar to explore the rest.</p>}
      </DialogContent>
    </Dialog>
  );
}
