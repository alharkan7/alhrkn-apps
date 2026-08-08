'use client';

// Suppress React Flow nodeTypes warning in development (known HMR issue with Next.js)
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  const originalWarn = console.warn;
  console.warn = (...args) => {
    if (typeof args[0] === 'string' && args[0].includes('[React Flow]: It looks like you')) {
      return;
    }
    originalWarn.apply(console, args);
  };
}

import React, { useCallback, useRef, useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ReactFlow, {
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  MarkerType,
  ReactFlowProvider,
  Node,
  useReactFlow,
  Panel,
  getOutgoers,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { v4 as uuidv4 } from 'uuid';
import { Plus, Sun, Moon, Sparkles, Loader2, X, FileText, Menu } from 'lucide-react';
import dagre from '@dagrejs/dagre';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

import CustomNode from './CustomNode';
import Sidebar from './Sidebar';
import ContextMenu from './ContextMenu';
import { INITIAL_NODES, NoteNode, ContextMenuProps } from '../types';
import { Button } from '@/components/ui/button';
import { AppsHeader } from '@/components/apps-header';


const nodeTypes = Object.freeze({
  note: CustomNode,
});

// Helper: Parse Markdown to Nodes & Edges
const parseMarkdownToGraph = (markdown: string) => {
  const lines = markdown.split('\n');
  const nodes: NoteNode[] = [];
  const edges: Edge[] = [];
  const stack: { level: number; id: string }[] = [];

  let currentNodeId: string | null = null;
  let currentContent: string[] = [];
  let hasCreatedRoot = false;

  const flushContent = () => {
    if (currentNodeId && currentContent.length > 0) {
      const nodeIndex = nodes.findIndex(n => n.id === currentNodeId);
      if (nodeIndex !== -1) {
        // Convert markdown content to proper HTML
        let htmlContent = '';
        let inList = false;
        let listItems: string[] = [];

        const flushList = () => {
          if (listItems.length > 0) {
            htmlContent += '<ul>' + listItems.map(item => `<li>${item}</li>`).join('') + '</ul>';
            listItems = [];
            inList = false;
          }
        };

        currentContent.forEach((line) => {
          const trimmed = line.trim();

          // Handle bullet points
          if (trimmed.startsWith('- ')) {
            inList = true;
            let item = trimmed.substring(2);
            // Apply inline formatting
            item = item
              .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
              .replace(/\*(.*?)\*/g, '<em>$1</em>');
            listItems.push(item);
          }
          // Handle regular paragraphs
          else if (trimmed) {
            flushList();
            let paragraph = trimmed;
            // Apply inline formatting
            paragraph = paragraph
              .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
              .replace(/\*(.*?)\*/g, '<em>$1</em>');
            htmlContent += `<p>${paragraph}</p>`;
          }
        });

        flushList(); // Flush any remaining list items

        nodes[nodeIndex].data.content = htmlContent || '<p></p>';
      }
    }
    currentContent = [];
  };

  lines.forEach((line) => {
    const headingMatch = line.match(/^(#+)\s+(.*)/);

    if (headingMatch) {
      flushContent();

      const level = headingMatch[1].length;
      const title = headingMatch[2];
      const id = uuidv4();

      const newNode: NoteNode = {
        id,
        type: 'note',
        position: { x: 0, y: 0 },
        data: { title, content: '' },
        style: { width: 300, height: 200 }, // Slightly larger default for AI nodes
      };

      nodes.push(newNode);
      currentNodeId = id;

      // Logic: Find parent by looking at stack
      while (stack.length > 0 && stack[stack.length - 1].level >= level) {
        stack.pop();
      }

      if (stack.length > 0) {
        const parentId = stack[stack.length - 1].id;
        edges.push({
          id: `e${parentId}-${id}`,
          source: parentId,
          target: id,
          sourceHandle: 'source-bottom',
          targetHandle: 'target-top',
          type: 'default',
          animated: true,
          markerEnd: { type: MarkerType.ArrowClosed },
          style: { stroke: '#94a3b8', strokeWidth: 2, strokeDasharray: '5,5' },
        });
      }

      stack.push({ level, id });

    } else {
      if (line.trim() !== '') {
        if (!currentNodeId && !hasCreatedRoot) {
          const id = uuidv4();
          nodes.push({
            id,
            type: 'note',
            position: { x: 0, y: 0 },
            data: { title: 'Document', content: '' },
            style: { width: 300, height: 200 },
          });
          currentNodeId = id;
          hasCreatedRoot = true;
          stack.push({ level: 1, id });
        }
        currentContent.push(line);
      }
    }
  });

  flushContent();
  return { nodes, edges };
};

// Helper: Run Dagre Layout on data
const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'TB') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  dagreGraph.setGraph({ rankdir: direction, ranksep: 100, nodesep: 60 });

  nodes.forEach((node) => {
    const width = typeof node.style?.width === 'number' ? node.style.width : 300;
    const height = typeof node.style?.height === 'number' ? node.style.height : 200;
    dagreGraph.setNode(node.id, { width, height });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const width = typeof node.style?.width === 'number' ? node.style.width : 300;
    const height = typeof node.style?.height === 'number' ? node.style.height : 200;

    return {
      ...node,
      position: {
        x: nodeWithPosition.x - width / 2,
        y: nodeWithPosition.y - height / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};


import { toast } from 'sonner';

function FlowEditor({ flownoteId, isOwner = true }: { flownoteId?: string, isOwner?: boolean }) {
  const router = useRouter();
  const [nodes, setNodes, onNodesChange] = useNodesState(INITIAL_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [copiedNode, setCopiedNode] = useState<NoteNode | null>(null);
  const [mounted, setMounted] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);

  // AI State
  const [isAIDialogOpen, setIsAIDialogOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Document Menu State
  const [isNewDocAlertOpen, setIsNewDocAlertOpen] = useState(false);
  const [isImportDocAlertOpen, setIsImportDocAlertOpen] = useState(false);

  const handleMakeCopy = async () => {
    if (!flownoteId) return;
    try {
      const res = await fetch(`/api/flownote/${flownoteId}/duplicate`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to duplicate');
      const data = await res.json();
      window.location.href = `/flownote/${data.newId}`;
    } catch (error) {
      console.error('Failed to duplicate document', error);
      toast.error('Failed to copy document. Please try again.');
    }
  };

  const handleInteract = (e?: React.SyntheticEvent | Event) => {
    if (!isOwner) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      toast('View Only', {
        description: "You're not the owner of this document.",
        action: {
          label: 'Make Copy',
          onClick: handleMakeCopy
        }
      });
      return false;
    }
    return true;
  };

  // File Upload State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!handleInteract()) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/flownote/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to upload document');
      }

      if (data.markdown) {
        const { nodes: newNodes, edges: newEdges } = parseMarkdownToGraph(data.markdown);
        
        if (newNodes.length > 0) {
          const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(newNodes, newEdges, 'TB');
          
          const res = await fetch('/api/flownote', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: file.name,
              nodes: layoutedNodes,
              edges: layoutedEdges,
              originalFileUrl: data.path,
              originalFileName: data.fileName,
            })
          });
          if (res.ok) {
            const json = await res.json();
            router.push(`/flownote/${json.flownote.id}`);
          }
        }
      }
    } catch (error) {
      console.error('File upload failed:', error);
      alert(error instanceof Error ? error.message : 'Failed to process document');
    } finally {
      setIsUploadingFile(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Track window width for responsive behavior
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Initialize theme after component mounts to avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('theme');
    if (saved) {
      setIsDarkMode(saved === 'dark');
    } else {
      setIsDarkMode(window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
  }, []);

  // Load initial nodes
  useEffect(() => {
    const loadInitialContent = async () => {
      try {
        if (flownoteId) {
          // Load from DB
          const response = await fetch(`/api/flownote/${flownoteId}`);
          if (response.ok) {
            const data = await response.json();
            if (data.flownote) {
              setNodes(data.flownote.nodes || []);
              setEdges(data.flownote.edges || []);
              setTimeout(() => {
                const fitView = (window as any).reactFlowInstance?.fitView;
                if (fitView) fitView({ padding: 0.2 });
              }, 100);
            }
          }
        } else {
          // Load demo data
          const response = await fetch('/flownote-initial.md');
          if (response.ok) {
            const markdown = await response.text();
            const { nodes: initialNodes, edges: initialEdges } = parseMarkdownToGraph(markdown);

            if (initialNodes.length > 0) {
              const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(initialNodes, initialEdges, 'TB');
              setNodes(layoutedNodes);
              setEdges(layoutedEdges);
            }
          }
        }
      } catch (error) {
        console.error('Failed to load initial content:', error);
      }
    };

    if (nodes.length === 0) {
      loadInitialContent();
    }
  }, [flownoteId]);

  // Auto-save logic
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (!flownoteId || !mounted || nodes.length === 0 || !isOwner) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await fetch(`/api/flownote/${flownoteId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: nodes[0]?.data?.title || 'FlowNote',
            nodes,
            edges,
          }),
        });
      } catch (error) {
        console.error('Failed to auto-save:', error);
      }
    }, 2000); // 2 second debounce

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [nodes, edges, flownoteId, mounted]);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<ContextMenuProps | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const { project, getNodes, getEdges } = useReactFlow();

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) || null,
    [nodes, selectedNodeId]
  );

  // --- Theme Toggle ---
  useEffect(() => {
    if (!mounted) return; // Skip during SSR and initial render

    const root = window.document.body;
    root.classList.remove('light', 'dark');
    if (isDarkMode) {
      root.classList.add('dark');
    } else {
      root.classList.add('light');
    }
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode, mounted]);

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  // --- Keyboard Shortcuts ---
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        (event.target as HTMLElement).isContentEditable
      ) {
        return;
      }

      if (event.metaKey || event.ctrlKey) {
        if (event.key === 'c' && selectedNode) {
          setCopiedNode(selectedNode);
        }
        if (event.key === 'v' && copiedNode) {
          const id = uuidv4();
          const position = {
            x: copiedNode.position.x + 50,
            y: copiedNode.position.y + 50,
          };

          const newNode: NoteNode = {
            ...copiedNode,
            id,
            position,
            selected: true,
            data: { ...copiedNode.data, title: `${copiedNode.data.title} (Copy)` }
          };

          setNodes((nds) =>
            [...nds.map(n => ({ ...n, selected: false })), newNode]
          );
          setSelectedNodeId(id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNode, copiedNode, setNodes]);

  // --- Listen for Eye Icon Click Event ---
  useEffect(() => {
    const handleOpenEditor = (event: Event) => {
      const customEvent = event as CustomEvent;
      const nodeId = customEvent.detail?.nodeId;
      if (nodeId) {
        setSelectedNodeId(nodeId);
        setIsSidebarOpen(true);
      }
    };

    window.addEventListener('openNodeEditor', handleOpenEditor);
    return () => window.removeEventListener('openNodeEditor', handleOpenEditor);
  }, []);

  const onConnect = useCallback(
    (params: Connection) => {
      if (!handleInteract()) return;
      const alreadyConnected = edges.some(
        (edge) => edge.source === params.source && edge.target === params.target
      );
      if (alreadyConnected) return;

      setEdges((eds) =>
        addEdge(
          {
            ...params,
            type: 'default',
            animated: true,
            markerEnd: { type: MarkerType.ArrowClosed },
            style: { stroke: '#94a3b8', strokeWidth: 2, strokeDasharray: '5,5' },
          },
          eds
        )
      );
    },
    [edges, setEdges]
  );

  const onReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      if (!handleInteract()) return;
      setEdges((eds) =>
        eds.map((edge) => {
          if (edge.id === oldEdge.id) {
            return {
              ...edge,
              source: newConnection.source || edge.source,
              target: newConnection.target || edge.target,
              sourceHandle: newConnection.sourceHandle,
              targetHandle: newConnection.targetHandle
            };
          }
          return edge;
        })
      );
    },
    [setEdges]
  );

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    if (event.nativeEvent.button === 0) {
      setSelectedNodeId(node.id);
      setContextMenu(null);

      // On mobile (< 768px), open sidebar with single click/tap
      // On desktop, use double-click (see onNodeDoubleClick)
      if (windowWidth < 768) {
        setIsSidebarOpen(true);
      }
    }
  }, [windowWidth]);

  const onNodeDoubleClick = useCallback((event: React.MouseEvent, node: Node) => {
    if (event.nativeEvent.button === 0) {
      setSelectedNodeId(node.id);
      setIsSidebarOpen(true);
      setContextMenu(null);
    }
  }, []);

  const onPaneClick = useCallback(() => {
    setContextMenu(null);
    setIsSidebarOpen(false);
    setSelectedNodeId(null);
  }, []);

  const addNode = useCallback(
    (x?: number, y?: number) => {
      if (!handleInteract()) return;
      const id = uuidv4();
      const position =
        x !== undefined && y !== undefined
          ? { x, y }
          : {
            x: Math.random() * 400 + 100,
            y: Math.random() * 400 + 100,
          };

      const newNode: NoteNode = {
        id,
        type: 'note',
        position,
        data: { title: 'New Idea', content: 'Double-click to edit content.' },
        style: { width: 240, height: 160 },
      };

      setNodes((nds) => nds.concat(newNode));

      if (x === undefined) {
        setSelectedNodeId(id);
        setIsSidebarOpen(true);
      }
    },
    [setNodes]
  );

  const addChildNode = useCallback((parentId: string) => {
    if (!handleInteract()) return;
    const parentNode = nodes.find(n => n.id === parentId);
    if (!parentNode) return;

    const id = uuidv4();
    // Position child below the parent
    const position = {
      x: parentNode.position.x,
      y: parentNode.position.y + 300,
    };

    const newNode: NoteNode = {
      id,
      type: 'note',
      position,
      data: { title: 'New Sub-topic', content: '' },
      style: { width: 240, height: 160 },
    };

    setNodes((nds) => nds.concat(newNode));
    setEdges((eds) =>
      addEdge({
        id: `e${parentId}-${id}`,
        source: parentId,
        target: id,
        sourceHandle: 'source-bottom',
        targetHandle: 'target-top',
        type: 'default',
        animated: true,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { stroke: '#94a3b8', strokeWidth: 2, strokeDasharray: '5,5' },
      }, eds)
    );
  }, [nodes, setNodes, setEdges]);

  const toggleBranchVisibility = useCallback((nodeId: string) => {
    const allNodes = getNodes();
    const allEdges = getEdges();

    const descendants = new Set<string>();

    const findDescendants = (currentId: string) => {
      const children = getOutgoers({ id: currentId } as Node, allNodes, allEdges);
      children.forEach(child => {
        if (!descendants.has(child.id)) {
          descendants.add(child.id);
          findDescendants(child.id);
        }
      });
    };

    findDescendants(nodeId);

    if (descendants.size === 0) return;

    // Determine state based on the first descendant
    const firstDescendantId = Array.from(descendants)[0];
    const firstDescendant = allNodes.find(n => n.id === firstDescendantId);
    const shouldHide = !firstDescendant?.hidden;

    setNodes((nds) =>
      nds.map(node => {
        if (descendants.has(node.id)) {
          return { ...node, hidden: shouldHide };
        }
        return node;
      })
    );

    setEdges((eds) =>
      eds.map(edge => {
        // Hide edge if its target (the node being hidden) is in descendants
        // This covers edges within the branch
        if (descendants.has(edge.target)) {
          return { ...edge, hidden: shouldHide };
        }
        return edge;
      })
    );
  }, [getNodes, getEdges, setNodes, setEdges]);

  const onAutoLayout = useCallback((direction = 'TB') => {
    const currentNodes = getNodes();
    const currentEdges = getEdges();
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(currentNodes, currentEdges, direction);

    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  }, [getNodes, getEdges, setNodes, setEdges]);

  const onClearCanvas = useCallback(() => {
    setNodes([]);
    setEdges([]);
    setSelectedNodeId(null);
    setIsSidebarOpen(false);
  }, [setNodes, setEdges]);

  const handleNewDocument = useCallback(async () => {
    if (!handleInteract()) return;
    const id = uuidv4();
    const position = { x: 250, y: 250 };
    
    const newNode: NoteNode = {
      id,
      type: 'note',
      position,
      data: { title: 'New Document', content: '' },
      style: { width: 300, height: 200 },
    };

    const res = await fetch('/api/flownote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'New Document',
        nodes: [newNode],
        edges: [],
      })
    });
    if (res.ok) {
      const json = await res.json();
      router.push(`/flownote/${json.flownote.id}`);
    }
  }, [flownoteId, router, setNodes, setEdges]);

  // AI Generation Handler
  const handleAIGenerate = async () => {
    if (!handleInteract()) return;
    if (!aiPrompt.trim()) return;
    setIsGenerating(true);

    try {
      const response = await fetch('/api/flownote/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: aiPrompt }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle specific error messages from the API
        if (response.status === 503) {
          alert(data.error || 'AI service is temporarily overloaded. Please try again in a moment.');
          return;
        }
        throw new Error(data.error || 'Failed to generate content');
      }

      if (!data.markdown) {
        throw new Error('No content was generated');
      }

      const { nodes: newNodes, edges: newEdges } = parseMarkdownToGraph(data.markdown);

      // Apply layout immediately
      if (newNodes.length > 0) {
        const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(newNodes, newEdges, 'TB');
        
        const res = await fetch('/api/flownote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: layoutedNodes[0]?.data?.title || 'AI Generated FlowNote',
            nodes: layoutedNodes,
            edges: layoutedEdges,
            aiPrompt: aiPrompt
          })
        });
        if (res.ok) {
          const json = await res.json();
          setIsAIDialogOpen(false);
          setAiPrompt('');
          router.push(`/flownote/${json.flownote.id}`);
        }
      }
    } catch (error) {
      console.error("AI Generation failed:", error);
      alert(error instanceof Error ? error.message : "Failed to generate content. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  // Context Menu Handlers
  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      if (!handleInteract(event)) return;
      const currentNodes = getNodes();
      const currentEdges = getEdges();
      const outgoers = getOutgoers(node, currentNodes, currentEdges);
      const hasChildren = outgoers.length > 0;

      setContextMenu({
        id: node.id,
        top: event.clientY,
        left: event.clientX,
        right: 0,
        bottom: 0,
        type: 'node',
        hasChildren,
      });
    },
    [getNodes, getEdges]
  );

  const onEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      event.preventDefault();
      if (!handleInteract(event)) return;
      setContextMenu({
        id: edge.id,
        top: event.clientY,
        left: event.clientX,
        right: 0,
        bottom: 0,
        type: 'edge',
      });
    },
    []
  );

  const onPaneContextMenu = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      if (!handleInteract(event)) return;
      setContextMenu({
        id: null,
        top: event.clientY,
        left: event.clientX,
        right: 0,
        bottom: 0,
        type: 'pane',
      });
    },
    []
  );

  const onContextMenuAddNode = useCallback(() => {
    if (!handleInteract()) return;
    if (!contextMenu || !ref.current) return;
    const paneBounds = ref.current.getBoundingClientRect();
    const position = project({
      x: contextMenu.left - paneBounds.left,
      y: contextMenu.top - paneBounds.top,
    });
    addNode(position.x, position.y);
    setContextMenu(null);
  }, [contextMenu, addNode, project]);

  const updateNodeData = useCallback(
    (id: string, newData: Partial<NoteNode['data']>) => {
      if (!handleInteract()) return;
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === id) {
            return { ...node, data: { ...node.data, ...newData } };
          }
          return node;
        })
      );
    },
    [setNodes]
  );

  const updateNodeColor = useCallback(
    (color: string) => {
      if (!contextMenu?.id) return;
      updateNodeData(contextMenu.id, { color });
      setContextMenu(null);
    },
    [contextMenu, updateNodeData]
  );

  return (
    <div className={`relative flex min-h-dvh w-screen overflow-hidden bg-[#f7f7f5] text-[#191918] dark:bg-[#10100f] dark:text-[#f2f2ef] ${isDarkMode ? 'dark' : ''}`} ref={ref} style={{ height: '100dvh' }}>
      <div className="fixed left-0 right-0 top-0 z-50 border-b border-black/[0.06] bg-[#f7f7f5]/82 backdrop-blur-xl dark:border-white/[0.08] dark:bg-[#10100f]/82">
        <AppsHeader
          leftButton={
            <Button
              variant="ghost"
              size="icon"
              onClick={() => window.dispatchEvent(new CustomEvent('toggleHistorySidebar'))}
              className="sidebar-toggle size-9 rounded-xl text-black/60 hover:bg-black/[0.06] hover:text-black dark:text-white/60 dark:hover:bg-white/[0.08] dark:hover:text-white"
              aria-label="Open FlowNote history"
            >
              <Menu size={18} />
            </Button>
          }
          title={<span className="text-sm font-semibold tracking-[-0.01em]">FlowNote</span>}
          rightContent={
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="size-9 rounded-xl border border-black/[0.06] bg-black/[0.025] text-black/55 shadow-none hover:bg-black/[0.06] hover:text-black dark:border-white/[0.08] dark:bg-white/[0.035] dark:text-white/55 dark:hover:bg-white/[0.08] dark:hover:text-white"
              title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
            </Button>
          }
        />
      </div>
      {!isOwner && (
        <div 
          className="absolute right-4 top-[4.25rem] z-40 flex cursor-pointer select-none items-center gap-1 rounded-full border border-black/[0.08] bg-white/90 px-3 py-1.5 font-sans text-xs font-medium text-black/60 shadow-sm backdrop-blur-lg transition-colors hover:text-black dark:border-white/[0.1] dark:bg-[#252523]/90 dark:text-white/60 dark:hover:text-white"
          onClick={handleMakeCopy}
        >
          <span>View Only - Make a Copy</span>
        </div>
      )}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onReconnect={onReconnect}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onPaneClick={onPaneClick}
        onNodeContextMenu={onNodeContextMenu}
        onEdgeContextMenu={onEdgeContextMenu}
        onPaneContextMenu={onPaneContextMenu}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.1}
        proOptions={{ hideAttribution: true }}
        style={{ backgroundColor: isDarkMode ? '#10100f' : '#f7f7f5' }}
        onInit={(instance) => { (window as any).reactFlowInstance = instance; }}
      >
        <Background
          color={isDarkMode ? '#3a3a36' : '#cfcec8'}
          gap={24}
          size={1}
        />

        <Controls position="bottom-left" showInteractive={false} style={{ marginBottom: 'max(1rem, env(safe-area-inset-bottom))' }} />

        {/* Top Left Panel */}
        <Panel position="top-left" className="ml-2 mt-16 flex gap-2 md:ml-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="group flex items-center justify-center gap-2 rounded-xl border border-black/[0.07] bg-white/90 px-3 py-2 text-sm font-medium text-black/65 shadow-[0_2px_8px_rgba(25,25,24,0.07)] backdrop-blur-lg transition-colors hover:bg-white hover:text-black focus:outline-none focus:ring-2 focus:ring-black/10 dark:border-white/[0.09] dark:bg-[#232321]/90 dark:text-white/65 dark:hover:bg-[#292927] dark:hover:text-white dark:focus:ring-white/10">
                <Plus size={17} className="transition-transform group-hover:rotate-90" />
                New
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuItem onClick={(e) => {
                if (!handleInteract(e)) return;
                setIsAIDialogOpen(true);
              }} className="cursor-pointer">
                <Sparkles size={16} className="mr-2" />
                Create with AI
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => {
                if (!handleInteract(e)) return;
                setIsNewDocAlertOpen(true);
              }} className="cursor-pointer">
                <Plus size={16} className="mr-2" />
                New from Blank
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => {
                if (!handleInteract(e)) return;
                setIsImportDocAlertOpen(true);
              }} disabled={isUploadingFile} className="cursor-pointer">
                {isUploadingFile ? <Loader2 size={16} className="mr-2 animate-spin" /> : <FileText size={16} className="mr-2" />}
                Generate from Doc
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <AlertDialog open={isNewDocAlertOpen} onOpenChange={setIsNewDocAlertOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Create New Document?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will clear your current canvas and any unsaved changes will be lost. Do you want to continue?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => { setIsNewDocAlertOpen(false); handleNewDocument(); }}>Continue</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept=".docx,.odt,.epub,.html,.md,.txt,.rst,.latex"
            onChange={handleFileUpload} 
          />

          <AlertDialog open={isImportDocAlertOpen} onOpenChange={setIsImportDocAlertOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Import Document?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will clear your current canvas and visualize the uploaded document. Any unsaved changes will be lost. Do you want to continue?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => { setIsImportDocAlertOpen(false); fileInputRef.current?.click(); }}>Continue</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </Panel>

      </ReactFlow>

      {/* AI Dialog Modal */}
      {isAIDialogOpen && (
        <div
          className="fixed inset-0 z-[120] flex animate-in items-center justify-center bg-black/20 backdrop-blur-[3px] duration-200 fade-in"
          onClick={() => setIsAIDialogOpen(false)}
        >
          <div
            className="mx-4 w-full max-w-lg scale-100 overflow-hidden rounded-2xl border border-black/[0.08] bg-[#fafaf8] p-6 shadow-2xl transition-all dark:border-white/[0.09] dark:bg-[#1a1a18]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-lg font-semibold tracking-[-0.02em] text-[#191918] dark:text-[#f2f2ef]">
                What do you want to draft?
              </h3>
              <button
                onClick={() => setIsAIDialogOpen(false)}
                className="rounded-lg p-1 text-black/35 transition-colors hover:bg-black/[0.05] hover:text-black dark:text-white/35 dark:hover:bg-white/[0.07] dark:hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <textarea
              className="custom-scrollbar mb-4 h-36 w-full resize-none rounded-xl border border-black/[0.08] bg-white p-4 text-[#191918] outline-none transition-shadow placeholder:text-black/30 focus:border-black/15 focus:ring-2 focus:ring-black/[0.05] dark:border-white/[0.09] dark:bg-[#111110] dark:text-[#f2f2ef] dark:placeholder:text-white/28 dark:focus:border-white/16 dark:focus:ring-white/[0.05]"
              placeholder="e.g., Explain the process of photosynthesis, or Write a marketing strategy for a coffee shop..."
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (aiPrompt.trim() && !isGenerating) {
                    handleAIGenerate();
                  }
                }
              }}
              autoFocus
            />

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setIsAIDialogOpen(false)}
                className="rounded-xl px-4 py-2 text-sm font-medium text-black/55 transition-colors hover:bg-black/[0.05] hover:text-black dark:text-white/55 dark:hover:bg-white/[0.07] dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleAIGenerate}
                disabled={!aiPrompt.trim() || isGenerating}
                className="flex items-center gap-2 rounded-xl bg-[#191918] px-5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-30 dark:bg-[#f2f2ef] dark:text-[#191918] dark:hover:bg-white"
              >
                {isGenerating ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    Create
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          {...contextMenu}
          onClose={() => setContextMenu(null)}
          onAddNode={onContextMenuAddNode}
          onAddChild={() => {
            if (contextMenu.id) addChildNode(contextMenu.id);
            setContextMenu(null);
          }}
          onToggleBranch={() => {
            if (contextMenu.id) toggleBranchVisibility(contextMenu.id);
            setContextMenu(null);
          }}
          onAutoLayout={() => onAutoLayout('TB')}
          onClearCanvas={onClearCanvas}
          onColorChange={updateNodeColor}
        />
      )}

      {/* Sidebar Sheet */}
      <Sidebar
        isOpen={isSidebarOpen}
        selectedNode={selectedNode as NoteNode}
        allNodes={nodes as NoteNode[]}
        allEdges={edges}
        onClose={() => setIsSidebarOpen(false)}
        onUpdateNode={updateNodeData}
        onAddChild={addChildNode}
        isOwner={isOwner}
        onInteract={handleInteract}
      />
    </div>
  );
}

export default function App({ flownoteId, isOwner = true }: { flownoteId?: string, isOwner?: boolean }) {
  return (
    <ReactFlowProvider>
      <FlowEditor flownoteId={flownoteId} isOwner={isOwner} />
    </ReactFlowProvider>
  );
}
