'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as THREE from 'three';
import { Loader2, Waypoints, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/components/theme-provider';
import { toTitleCase } from '../lib/title-case';

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

interface SelectedNode {
  id: string;
  label: string;
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
  const [selectedNode, setSelectedNode] = useState<SelectedNode | null>(null);
  const [hintDismissed, setHintDismissed] = useState(false);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme !== 'light';

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetch(`/api/primer/graph?id=${encodeURIComponent(primerId)}`, { signal: controller.signal, cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error || 'Could not load learning map');
        setGraphData(data);
      })
      .catch((reason) => {
        if (reason?.name !== 'AbortError') setError(reason?.message || 'Could not load learning map');
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [open, primerId]);

  useEffect(() => {
    if (!open) setSelectedNode(null);
    else setHintDismissed(false);
  }, [open]);

  useEffect(() => {
    if (!open || !graphData || !containerRef.current) return;
    let active = true;

    const palette = isDark
      ? {
          background: '#020617',
          nodeCurrent: '#f59e0b',
          nodeRoot: '#10b981',
          nodeOther: '#6366f1',
          nodeOtherOpacity: 0.88,
          link: '#818cf8',
          linkOpacity: 0.72,
          labelBackground: 'rgba(15,23,42,.92)',
          labelColor: '#ffffff',
        }
      : {
          background: '#f8fafc',
          nodeCurrent: '#d97706',
          nodeRoot: '#059669',
          nodeOther: '#4f46e5',
          nodeOtherOpacity: 0.9,
          link: '#6366f1',
          linkOpacity: 0.55,
          labelBackground: 'rgba(255,255,255,.96)',
          labelColor: '#0f172a',
        };

    (async () => {
      const { default: ForceGraph3D } = await import('3d-force-graph');
      if (!active || !containerRef.current) return;

      const nodeById = new Map(graphData.nodes.map((node) => [node.id, node]));
      const nodes = graphData.nodes.map((node) => ({
        ...node,
        label: toTitleCase(node.title || node.topic),
        isCurrent: node.id === graphData.currentId,
      }));

      // Walk parent pointers up from the current page to find the origin lesson
      // (the root of this lineage). On child/grandchild pages this is the node a
      // learner wants to spot; when already on the root it coincides with the
      // current page and gets no extra treatment.
      let rootId: string = graphData.currentId;
      let cursor = nodeById.get(rootId);
      let guard = 0;
      while (cursor?.parentId && nodeById.has(cursor.parentId) && guard++ < 1000) {
        rootId = cursor.parentId;
        cursor = nodeById.get(rootId);
      }

      const links = graphData.nodes
        .filter((node) => node.parentId && nodeById.has(node.parentId))
        .map((node) => ({ source: node.parentId!, target: node.id }));

      const graph = new ForceGraph3D(containerRef.current)
        .backgroundColor(palette.background)
        .showNavInfo(false)
        .enableNodeDrag(true)
        .nodeLabel((node: any) => `<div style="max-width:260px;padding:7px 10px;border-radius:8px;background:${palette.labelBackground};color:${palette.labelColor};box-shadow:0 4px 14px rgba(2,6,23,.25);font:500 12px/1.35 system-ui,sans-serif">${escapeHtml(node.label)}</div>`)
        .nodeThreeObject((node: any) => {
          if (node.id === rootId && !node.isCurrent) {
            const group = new THREE.Group();
            const core = new THREE.Mesh(
              new THREE.SphereGeometry(6, 24, 24),
              new THREE.MeshBasicMaterial({ color: palette.nodeRoot, transparent: true, opacity: 1 })
            );
            const halo = new THREE.Mesh(
              new THREE.SphereGeometry(9.5, 20, 20),
              new THREE.MeshBasicMaterial({ color: palette.nodeRoot, transparent: true, opacity: 0.16 })
            );
            group.add(core, halo);
            return group;
          }
          const material = new THREE.MeshBasicMaterial({
            color: node.isCurrent ? palette.nodeCurrent : palette.nodeOther,
            transparent: true,
            opacity: node.isCurrent ? 1 : palette.nodeOtherOpacity,
          });
          return new THREE.Mesh(new THREE.SphereGeometry(node.isCurrent ? 7 : 5, 20, 20), material);
        })
        .linkColor(() => palette.link)
        .linkWidth((link: any) => link.source === graphData.currentId || link.target === graphData.currentId ? 1.8 : 0.9)
        .linkOpacity(palette.linkOpacity)
        .linkCurvature(0.22)
        .linkCurveRotation(() => Math.PI / 5)
        .onNodeClick((node: any) => {
          // Touch devices cannot hover. A tap selects the node and shows its label
          // in the bottom card; it does not navigate or close the map. The card's
          // Open button performs the navigation.
          setSelectedNode({ id: node.id, label: node.label });
        })
        .onBackgroundClick(() => setSelectedNode(null))
        .graphData({ nodes, links });

      graph.d3Force('charge')?.strength(-105);
      graph.d3Force('link')?.distance(78);
      graph.d3Force('center')?.strength(0.45);
      graphRef.current = graph;
    })().catch((reason) => {
      if (active) setError(reason?.message || 'Could not render learning map');
    });

    return () => {
      active = false;
      graphRef.current?._destructor?.();
      graphRef.current = null;
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
  }, [graphData, open, isDark]);

  const surfaceClass = isDark ? 'bg-slate-950/95' : 'bg-slate-50';
  const loadingTextClass = isDark ? 'text-slate-300' : 'text-slate-600';
  const spinnerClass = isDark ? 'text-amber-400' : 'text-amber-500';
  const errorTextClass = isDark ? 'text-red-300' : 'text-red-600';
  const hintClass = isDark
    ? 'border border-white/10 bg-black/50 text-slate-300'
    : 'border border-slate-200 bg-white/70 text-slate-600';
  const cardClass = isDark
    ? 'border-slate-700 bg-slate-900/90 text-slate-100'
    : 'border-slate-200 bg-white/95 text-slate-900';
  const closeClass = isDark ? 'text-slate-400 hover:text-slate-100' : 'text-slate-400 hover:text-slate-700';

  const openLesson = (id: string) => {
    onOpenChange(false);
    router.push(`/primer/${id}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[92vh] w-[96vw] max-w-none flex-col overflow-hidden rounded-2xl p-0 sm:rounded-2xl" aria-describedby={undefined}>
        <DialogHeader className="border-b px-5 py-4 pr-12">
          <DialogTitle className="flex items-center gap-2"><Waypoints className="h-4 w-4 text-primary" />Learning Map</DialogTitle>
        </DialogHeader>
        <div className={`relative w-full flex-1 overflow-hidden ${surfaceClass}`}>
          {loading ? (
            <div className={`flex h-full items-center justify-center gap-2 text-sm ${loadingTextClass}`}><Loader2 className={`h-5 w-5 animate-spin ${spinnerClass}`} />Loading map…</div>
          ) : error ? (
            <div className={`flex h-full items-center justify-center text-sm ${errorTextClass}`}>{error}</div>
          ) : (
            <div ref={containerRef} className="primer-graph h-full w-full" />
          )}
          {!loading && !error && graphData && (
            selectedNode ? (
              <div className={`pointer-events-auto absolute bottom-3 left-1/2 flex max-w-[92%] -translate-x-1/2 items-center gap-2 rounded-xl border px-3 py-2 shadow-lg backdrop-blur ${cardClass}`}>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{selectedNode.label}</span>
                <Button size="sm" className="h-8 shrink-0" onClick={() => openLesson(selectedNode.id)}>
                  Open
                </Button>
                <button type="button" aria-label="Dismiss" className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors ${closeClass}`} onClick={() => setSelectedNode(null)}>
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              !hintDismissed ? (
                <div className={`pointer-events-none absolute bottom-3 left-1/2 flex w-[min(92vw,24rem)] -translate-x-1/2 items-center gap-2 rounded-lg px-3 py-1 text-[11px] backdrop-blur ${hintClass}`}>
                  <span>Tap a node for its title · drag to orbit · two-finger or right-drag to pan · scroll to zoom</span>
                  <button
                    type="button"
                    aria-label="Dismiss hint"
                    className={`pointer-events-auto -mr-1 flex h-4 w-4 items-center justify-center rounded ${closeClass}`}
                    onClick={() => setHintDismissed(true)}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : null
            )
          )}
        </div>
        {graphData?.truncated && <p className="border-t px-5 py-2 text-xs text-muted-foreground">Showing the nearest 200 pages. Expand branches in the sidebar to explore the rest.</p>}
      </DialogContent>
    </Dialog>
  );
}
