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
import { Plus, Sun, Moon, Sparkles, Loader2, X, LayoutGrid } from 'lucide-react';
import dagre from '@dagrejs/dagre';

import CustomNode from './components/CustomNode';
import Sidebar from './components/Sidebar';
import ContextMenu from './components/ContextMenu';
import { INITIAL_NODES, NoteNode, ContextMenuProps } from './types';
import { AppsGrid } from '@/components/ui/apps-grid';
import { Button } from '@/components/ui/button';


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


function FlowEditor() {
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

  // Load initial nodes from markdown file
  useEffect(() => {
    const loadInitialContent = async () => {
      try {
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
      } catch (error) {
        console.error('Failed to load initial content:', error);
      }
    };

    // Only load if there are no nodes yet
    if (nodes.length === 0) {
      loadInitialContent();
    }
  }, []);

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

  // AI Generation Handler
  const handleAIGenerate = async () => {
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
        setNodes(layoutedNodes);
        setEdges(layoutedEdges);
        setIsAIDialogOpen(false);
        setAiPrompt('');

        // Fit view after a brief delay to ensure rendering
        setTimeout(() => {
          const fitView = (window as any).reactFlowInstance?.fitView;
          if (fitView) fitView({ padding: 0.2 });
        }, 100);
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
    <div className={`w-screen min-h-dvh flex overflow-hidden ${isDarkMode ? 'dark' : ''}`} ref={ref} style={{ height: '100dvh' }}>
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
        style={{ backgroundColor: isDarkMode ? '#020617' : '#f8fafc' }}
        onInit={(instance) => { (window as any).reactFlowInstance = instance; }}
      >
        <Background
          color={isDarkMode ? '#334155' : '#cbd5e1'}
          gap={24}
          size={1}
        />

        <Controls position="bottom-left" showInteractive={false} style={{ marginBottom: 'max(1rem, env(safe-area-inset-bottom))' }} />

        {/* Top Left Panel: AI Button */}
        <Panel position="top-left" className="ml-4 mt-4">
          <button
            onClick={() => setIsAIDialogOpen(true)}
            className="group p-2.5 bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm transition-all focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-700 flex items-center justify-center"
            title="Generate with AI"
          >
            <Sparkles size={20} className="transition-transform group-hover:scale-110" />
          </button>
        </Panel>

        <Panel position="top-right" className={`mr-4 mt-4 flex gap-3${isSidebarOpen ? ' invisible md:visible' : ''}`}>
          <button
            onClick={toggleTheme}
            className="p-2.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm transition-all focus:ring-2 focus:ring-slate-200 dark:focus:ring-slate-700"
            title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>

          <AppsGrid
            trigger={
              <Button
                variant="default"
                className="flex items-center gap-1.5 px-3 py-2 h-auto bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-sm"
              >
                <LayoutGrid size={16} />
                <span className="hidden sm:inline text-sm font-medium">Apps</span>
              </Button>
            }
            useHardReload={false}
          />
        </Panel>

        {/* Bottom Right Panel: New Note Button */}
        <Panel position="bottom-right" className="mr-4" style={{ marginBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          <button
            onClick={() => addNode()}
            className="group flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white rounded-full shadow-lg shadow-blue-500/30 transition-all hover:scale-105 active:scale-95 font-medium tracking-wide px-3 py-3 md:pl-4 md:pr-5 md:py-2.5"
            title="Create New Note"
          >
            <div className="bg-white/20 rounded-full p-1 group-hover:bg-white/30 transition-colors">
              <Plus size={16} strokeWidth={3} />
            </div>
            <span className="hidden md:inline">New</span>
          </button>
        </Panel>
      </ReactFlow>

      {/* AI Dialog Modal */}
      {isAIDialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setIsAIDialogOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 w-full max-w-lg mx-4 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden transform transition-all scale-100 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                What do you want to draft?
              </h3>
              <button
                onClick={() => setIsAIDialogOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <textarea
              className="w-full h-32 p-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none mb-4 custom-scrollbar"
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
                className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAIGenerate}
                disabled={!aiPrompt.trim() || isGenerating}
                className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-md shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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
      />
    </div>
  );
}

export default function App() {
  return (
    <ReactFlowProvider>
      <FlowEditor />
    </ReactFlowProvider>
  );
}