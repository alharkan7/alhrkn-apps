import React, { useState, useRef, useEffect } from 'react';
import { Share2, FileImage, FileText, Braces, List, Link } from 'lucide-react';
import { getNodesBounds, getViewportForBounds } from 'reactflow';
import { Button } from "@/components/ui/button";
import { useMindMapContext, usePdfViewerContext } from '../context';
import { toast } from "sonner";

interface DownloaderProps {
  // No props needed anymore as we'll use context
}

export default function Downloader({}: DownloaderProps) {
  const { nodes, mindMapData, reactFlowWrapper, reactFlowInstance } = useMindMapContext();
  const { fileName } = usePdfViewerContext();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Log context values on render/change
  useEffect(() => {
    console.log('[Downloader Render] mindMapData:', JSON.stringify(mindMapData));
    console.log('[Downloader Render] nodes:', JSON.stringify(nodes?.map(n => ({ id: n.id, type: n.type, data: { label: n.data.label } }))));
  }, [mindMapData, nodes]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Helper function to prepare the flow for image export
  const prepareExport = (exportType: 'image' | 'pdf') => {
    if (!reactFlowInstance.current || !nodes.length || !reactFlowWrapper.current) {
      console.error('[PrepareExport Error] Conditions not met:', {
        hasReactFlowInstance: !!reactFlowInstance.current,
        nodesLength: nodes?.length,
        hasReactFlowWrapper: !!reactFlowWrapper.current,
        nodes: JSON.stringify(nodes?.map(n => ({ id: n.id, type: n.type, data: { label: n.data.label } })))
      });
      return null;
    }

    // Calculate bounds for all nodes - using nodes passed through props
    const nodesBounds = getNodesBounds(nodes);
    
    // Add some padding to the bounds
    const padding = 50;
    const imageWidth = nodesBounds.width + padding * 2;
    const imageHeight = nodesBounds.height + padding * 2;
    
    // Calculate transform to ensure all nodes are visible
    const viewport = getViewportForBounds(
      nodesBounds,
      imageWidth,
      imageHeight,
      0.5, // minZoom
      2,   // maxZoom
      0    // padding for getViewportForBounds, set to 0 as we manually added padding to imageWidth/Height
    );
    
    // Get the viewport element for export
    const viewportElement = reactFlowWrapper.current!.querySelector('.react-flow__viewport') as HTMLElement;

    // Check if dark mode is active
    const isDarkMode = document.documentElement.classList.contains('dark');
    
    // Return necessary information
    return {
      viewportElement,
      exportOptions: {
        width: imageWidth,
        height: imageHeight,
        style: {
          width: `${imageWidth}px`,
          height: `${imageHeight}px`,
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
          background: exportType === 'image' ? 'transparent' : isDarkMode ? '#020817' : '#ffffff',
        },
        filter: (node: any) => {
          return (
            !node.classList?.contains('react-flow__minimap') &&
            !node.classList?.contains('react-flow__controls') &&
            !(node.getAttribute && node.getAttribute('data-exclude-from-export') === 'true')
          );
        }
      }
    };
  };

  // Download as JPEG
  const downloadAsJpeg = () => {
    console.log('[DownloadAsJpeg] Attempting download. mindMapData:', JSON.stringify(mindMapData), 'Nodes length:', nodes?.length);
    const exportData = prepareExport('image');
    if (!exportData) {
      console.error('[DownloadAsJpeg Error] prepareExport returned null.');
      return;
    }

    const { viewportElement, exportOptions } = exportData;
    const isDarkMode = document.documentElement.classList.contains('dark');

    // Small delay to ensure the view is updated
    setTimeout(async () => {
      const { toJpeg } = await import('html-to-image');
      toJpeg(viewportElement, {
        quality: 0.95,
        backgroundColor: isDarkMode ? '#020817' : '#ffffff',
        ...exportOptions
      })
        .then((dataUrl) => {
          const a = document.createElement('a');
          a.href = dataUrl;
          a.download = `${fileName}_mindmap.jpeg`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        })
        .catch((error) => {
          console.error('Error generating JPEG:', error);
        });
    }, 300);
  };

  // Download as PNG with transparent background
  const downloadAsPng = () => {
    console.log('[DownloadAsPng] Attempting download. mindMapData:', JSON.stringify(mindMapData), 'Nodes length:', nodes?.length);
    const exportData = prepareExport('image');
    if (!exportData) {
      console.error('[DownloadAsPng Error] prepareExport returned null.');
      return;
    }

    const { viewportElement, exportOptions } = exportData;
    const isDarkMode = document.documentElement.classList.contains('dark');

    // Small delay to ensure the view is updated
    setTimeout(async () => {
      const { toPng } = await import('html-to-image');
      toPng(viewportElement, {
        quality: 1,
        backgroundColor: 'transparent',
        ...exportOptions,
        style: {
          ...exportOptions.style,
          background: 'transparent',
        }
      })
        .then((dataUrl) => {
          const a = document.createElement('a');
          a.href = dataUrl;
          a.download = `${fileName}_mindmap.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        })
        .catch((error) => {
          console.error('Error generating PNG:', error);
        });
    }, 300);
  };

  // Download as PDF
  const downloadAsPdf = () => {
    console.log('[DownloadAsPdf] Attempting download. mindMapData:', JSON.stringify(mindMapData), 'Nodes length:', nodes?.length);
    const exportData = prepareExport('pdf');
    if (!exportData) {
      console.error('[DownloadAsPdf Error] prepareExport returned null.');
      return;
    }

    const { viewportElement, exportOptions } = exportData;
    const isDarkMode = document.documentElement.classList.contains('dark');

    // Small delay to ensure the view is updated
    setTimeout(async () => {
      const { toPng } = await import('html-to-image');
      const { jsPDF } = await import('jspdf');
      
      toPng(viewportElement, {
        quality: 0.8, // Reduced quality for better compression
        backgroundColor: isDarkMode ? '#020817' : '#ffffff',
        ...exportOptions
      })
        .then((dataUrl) => {
          // Create PDF with dimensions based on the image
          const img = new Image();
          img.src = dataUrl;

          img.onload = () => {
            // Convert pixel dimensions to points (1/72 inch)
            // 1 pixel = 1/96 inch, 1 point = 1/72 inch
            // Therefore, 1 pixel = 72/96 points ≈ 0.75 points
            const pointsPerPixel = 72/96;
            const widthInPoints = img.width * pointsPerPixel;
            const heightInPoints = img.height * pointsPerPixel;

            // Create PDF with point-based dimensions
            const pdf = new jsPDF({
              orientation: img.width > img.height ? 'landscape' : 'portrait',
              unit: 'pt',
              format: [widthInPoints, heightInPoints]
            });

            // Add the image with compression
            pdf.addImage(dataUrl, 'PNG', 0, 0, widthInPoints, heightInPoints, undefined, 'FAST');
            pdf.save(`${fileName}_mindmap.pdf`);
          };
        })
        .catch((error) => {
          console.error('Error generating PDF:', error);
        });
    }, 300);
  };

  const downloadAsJSON = () => {
    console.log('[DownloadAsJSON] Attempting download. mindMapData:', JSON.stringify(mindMapData));
    if (!mindMapData || !mindMapData.nodes || mindMapData.nodes.length === 0) {
      console.error('[DownloadAsJSON Error] mindMapData is null, has no nodes, or nodes array is empty.', { mindMapDataExists: !!mindMapData, hasNodes: !!mindMapData?.nodes, nodesLength: mindMapData?.nodes?.length });
      return;
    }

    const dataStr = JSON.stringify(mindMapData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName}_mindmap.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Generate and download as bullet point list
  const downloadAsBulletList = () => {
    console.log('[DownloadAsBulletList] Attempting download. mindMapData:', JSON.stringify(mindMapData));
    if (!mindMapData || !mindMapData.nodes || mindMapData.nodes.length === 0) {
      console.error('[DownloadAsBulletList Error] mindMapData is null, has no nodes, or nodes array is empty.', { mindMapDataExists: !!mindMapData, hasNodes: !!mindMapData?.nodes, nodesLength: mindMapData?.nodes?.length });
      return;
    }

    // Create a map of parent ID to child nodes for easier traversal
    const nodeMap = new Map<string | null, Array<typeof mindMapData.nodes[0]>>();
    
    // Group nodes by their parent
    mindMapData.nodes.forEach(node => {
      if (!nodeMap.has(node.parentId)) {
        nodeMap.set(node.parentId, []);
      }
      nodeMap.get(node.parentId)?.push(node);
    });
    
    // Generate the bullet point text
    let bulletText = "";
    let lastLevel = -1; // Track the level of the last processed node
    
    // Function to recursively generate bullet points
    const generateBulletPoints = (nodeId: string | null, level: number = 0) => {
      const nodes = nodeMap.get(nodeId) || [];
      
      // Sort nodes if needed (you can sort by ID, title, or any other property)
      nodes.sort((a, b) => a.level - b.level);
      
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        
        // Add a blank line in these cases:
        // 1. When we're not at the first node overall
        // 2. When the current level is different from the last processed level (moving up or down levels)
        // 3. When we're at the same level but not the first node in a group of siblings
        if (bulletText.length > 0 && (level !== lastLevel || i > 0)) {
          bulletText += "\n";
        }
        
        // Create indentation based on level
        const indent = "  ".repeat(level);
        
        // Add the bullet point line with center dot "•" instead of dash "-"
        bulletText += `${indent}• ${node.title}: ${node.description}\n`;
        
        // Save the current level before recursing
        lastLevel = level;
        
        // Process children recursively
        generateBulletPoints(node.id, level + 1);
      }
    };
    
    // Start with root nodes (nodes with null parentId)
    generateBulletPoints(null);
    
    // Create a blob and download
    const dataBlob = new Blob([bulletText], { type: 'text/plain' });
    const url = URL.createObjectURL(dataBlob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName}_mindmap.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Function to copy URL to clipboard
  const copyUrlToClipboard = async () => {
    const url = window.location.href;
    const textToCopy = `Checkout this interactive AI mindmap on "${fileName}"\n\nPapermap: ${url}`;
    try {
      await navigator.clipboard.writeText(textToCopy);
      toast.success("URL copied to clipboard!");
    } catch (err) {
      console.error('Failed to copy URL: ', err);
      toast.error("Failed to copy URL. Please try again.");
    }
    setShowDropdown(false); // Close dropdown after attempting to copy
  };

  const executeDownload = (downloadAction: () => void) => {
    downloadAction();
    setShowDropdown(false);
  };

  if (nodes.length === 0) {
    console.log('[Downloader] nodes.length is 0, rendering null.');
    return null;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="secondary"
        size="sm"
        className="h-9 border border-black/[0.08] bg-white/60 text-[#191918] hover:bg-white dark:border-white/[0.1] dark:bg-white/[0.06] dark:text-[#f2f2ef] dark:hover:bg-white/[0.1]"
        onClick={() => setShowDropdown(!showDropdown)}
        title="Share"
      >
        <Share2 className="size-4" />
        <span className="hidden sm:inline">Share</span>
      </Button>

      {showDropdown && (
        <div className="absolute right-0 mt-2 w-[100px] rounded-md border border-black/[0.08] bg-[#fbfaf8] shadow-lg z-10 dark:border-white/[0.08] dark:bg-[#161614]">
          <ul className="py-1">
            <li key="jpeg">
              <button
                className="block w-full text-left px-3 py-2 text-[#191918] hover:bg-black/[0.05] dark:text-[#f2f2ef] dark:hover:bg-white/[0.08]"
                onClick={() => executeDownload(downloadAsJpeg)}
              >
                <div className="flex items-center">
                  <FileImage className="mr-2 h-4 w-4" />
                  JPEG
                </div>
              </button>
            </li>
            <li key="png">
              <button
                className="block w-full text-left px-3 py-2 text-[#191918] hover:bg-black/[0.05] dark:text-[#f2f2ef] dark:hover:bg-white/[0.08]"
                onClick={() => executeDownload(downloadAsPng)}
              >
                <div className="flex items-center">
                  <FileImage className="mr-2 h-4 w-4" />
                  PNG
                </div>
              </button>
            </li>
            <li key="pdf">
              <button
                className="block w-full text-left px-3 py-2 text-[#191918] hover:bg-black/[0.05] dark:text-[#f2f2ef] dark:hover:bg-white/[0.08]"
                onClick={() => executeDownload(downloadAsPdf)}
              >
                <div className="flex items-center">
                  <FileText className="h-4 w-4 mr-2" />
                  PDF
                </div>
              </button>
            </li>
            <li key="copy-url">
              <button
                className="block w-full text-left px-3 py-2 text-[#191918] hover:bg-black/[0.05] dark:text-[#f2f2ef] dark:hover:bg-white/[0.08]"
                onClick={copyUrlToClipboard}
              >
                <div className="flex items-center">
                  <Link className="mr-2 h-4 w-4" />
                  URL
                </div>
              </button>
            </li>
            <li key="txt">
              <button
                className="block w-full text-left px-3 py-2 text-[#191918] hover:bg-black/[0.05] dark:text-[#f2f2ef] dark:hover:bg-white/[0.08]"
                onClick={() => executeDownload(downloadAsBulletList)}
              >
                <div className="flex items-center">
                  <List className="mr-2 h-4 w-4" />
                  Text
                </div>
              </button>
            </li>
            <li key="json">
              <button
                className="block w-full text-left px-3 py-2 text-[#191918] hover:bg-black/[0.05] dark:text-[#f2f2ef] dark:hover:bg-white/[0.08]"
                onClick={() => executeDownload(downloadAsJSON)}
              >
                <div className="flex items-center">
                  <Braces className="mr-2 h-4 w-4" />
                  JSON
                </div>
              </button>
            </li>
          </ul>
        </div>
      )}


    </div>
  );
} 