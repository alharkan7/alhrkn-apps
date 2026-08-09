'use client';

import { useState, useEffect, useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  useReactFlow,
  EdgeTypes
} from 'reactflow';
import 'reactflow/dist/style.css';
import CustomNode from './CustomNode';
import { Network } from 'lucide-react';
import { useMindMapContext, usePdfViewerContext } from '../context';
import { reactFlowStyles } from '../styles/styles';
import { LAYOUT_PRESETS } from '../types';
import MindMapLoader from './MindMapLoader';
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

// Node types for ReactFlow
const nodeTypes = {
  custom: CustomNode,
};

// Edge types for ReactFlow
const edgeTypes = {};

const defaultEdgeOptions = {
  type: 'default',
  style: {
    stroke: '#9a978f',
    strokeWidth: 1.5,
    strokeOpacity: 0.7,
    strokeDasharray: '0',
    zIndex: 1000
  },
  animated: false
};

// Pro options to remove attribution
const proOptions = { hideAttribution: true };

const MindMapFlow = ({ isOwner = true, onInteract }: { isOwner?: boolean, onInteract?: () => void }) => {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    reactFlowInstance,
    reactFlowWrapper,
    loading,
    loadingStage,
    currentLayoutIndex,
    cycleLayout,
  } = useMindMapContext();

  const { openPdfViewer } = usePdfViewerContext();

  const reactFlow = useReactFlow();
  const [nodesDraggable, setNodesDraggable] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [isDark, setIsDark] = useState(false);

  // Get current layout direction from the layout preset
  const currentLayout = LAYOUT_PRESETS[currentLayoutIndex];
  const currentLayoutDirection = currentLayout.direction;

  // Set isClient to true when component mounts on client
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Check if device is mobile
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768); // Common breakpoint for mobile
    };

    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);

    return () => {
      window.removeEventListener('resize', checkIfMobile);
    };
  }, []);

  // Track dark mode (toggle-based .dark class or system preference) so the
  // ReactFlow background dots stay calm in both themes.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setIsDark(document.documentElement.classList.contains('dark') || mq.matches);
    update();
    mq.addEventListener('change', update);
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => {
      mq.removeEventListener('change', update);
      observer.disconnect();
    };
  }, []);

  // Enhance nodes with PDF viewer capability and layout direction
  const enhancedNodes = nodes.map(node => {

    return {
      ...node,
      data: {
        ...node.data,
        openPdfViewer, // Pass the openPdfViewer function to all nodes
        isOwner,
        onInteract,
        // Only set layoutDirection if it doesn't already exist to avoid overriding initial value
        ...(node.data.layoutDirection ? {} : { layoutDirection: currentLayoutDirection })
      }
    };
  });

  // Detect when the data-nodedrag attribute is set to false
  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        if (mutation.attributeName === 'data-nodedrag') {
          const nodes = document.querySelectorAll('[data-nodedrag="false"]');
          setNodesDraggable(nodes.length === 0);
        }
      });
    });

    // Observe the entire react-flow container for attribute changes
    const reactFlowPane = document.querySelector('.react-flow');
    if (reactFlowPane) {
      observer.observe(reactFlowPane, {
        attributes: true,
        attributeFilter: ['data-nodedrag'],
        subtree: true // Observe all descendants
      });
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (reactFlow && nodes.length > 0) {
      // Remove the automatic fitView call to maintain user's view
      // setTimeout(() => {
      //   reactFlow.fitView({ padding: 0.4, duration: 800 });
      // }, 200);
    }
  }, [reactFlow]); // Only depend on reactFlow, not nodes.length

  // Canvas is transparent so the warm page shell shows through; the Background
  // component draws warm dots that adapt to the active theme.
  const bgColor = 'transparent';
  const dotColor = isDark ? 'rgba(242,242,239,0.10)' : 'rgba(25,25,24,0.16)';
  const dotSize = 1.5; // Slightly larger dots for better visibility
  const dotGap = 24;

  // Changed from "loading || nodes.length === 0" to just "loading"
  // This way we only show the loader when loading is true, but still display any existing nodes
  const showLoadingIndicator = loading;

  // Get loading stage text
  const getLoadingText = () => {
    switch (loadingStage) {
      case 'uploading':
        return 'Uploading...';
      case 'analyzing':
        return 'AI is reading...';
      case 'generating':
        return 'Creating mindmap...';
      case 'saving':
        return 'Saving...';
      case 'building':
        return 'Almost done...';
      default:
        return 'Loading...';
    }
  };

  return (
    <div ref={reactFlowWrapper} className="relative w-full h-full">
      {/* Keep only essential styles, portal handles the FollowUpCard positioning */}
      <style jsx global>{reactFlowStyles}</style>

      <ReactFlow
        nodes={enhancedNodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onInit={(instance) => {
          reactFlowInstance.current = instance;
        }}
        nodesDraggable={nodesDraggable} // Use the state to control whether nodes are draggable
        proOptions={proOptions}
        elementsSelectable={true}
        zoomOnScroll={true}
        minZoom={0.2} // Set the minimum zoom level (max zoom-out)
        maxZoom={4} // Set the maximum zoom level (max zoom-in)
        defaultEdgeOptions={defaultEdgeOptions}
        className="h-full"
        style={{ width: '100%', height: '100%', background: bgColor }}
        fitView
      >
        <Controls className="print:hidden text-foreground dark:text-foreground !fill-current" />
        <Background color={dotColor} gap={dotGap} size={dotSize} />
      </ReactFlow>

      {/* Layout Switcher Button */}
      <div
        className="fixed bottom-4 right-4 z-20 flex flex-col gap-3 print:hidden"
        {...(isClient ? { title: `Switch to ${LAYOUT_PRESETS[(currentLayoutIndex + 1) % LAYOUT_PRESETS.length].name}` } : {})}
      >
        <button
          onClick={cycleLayout}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-black/[0.08] bg-white/85 text-black/70 shadow-sm backdrop-blur transition-colors hover:bg-black/[0.05] hover:text-black focus:outline-none dark:border-white/[0.1] dark:bg-[#1b1b19]/85 dark:text-white/70 dark:hover:bg-white/[0.1] dark:hover:text-white"
        >
          <Network
            size={16}
            className={`${isClient && currentLayoutDirection === 'LR' ? '-rotate-90' : ''} transition-transform`}
          />
        </button>
      </div>

      {showLoadingIndicator && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50">
          <div className="flex scale-75 flex-col items-center p-8">
            <MindMapLoader />
            <div className="text-base font-medium text-[#191918] dark:text-[#f2f2ef]">
              {getLoadingText()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MindMapFlow; 