import React, { useState, useEffect, useRef, memo } from 'react';
import { Handle, Position, useUpdateNodeInternals } from 'reactflow';
import '@reactflow/node-resizer/dist/style.css';
import FollowUpCard from './FollowUpCard';
import ReactMarkdown from 'react-markdown';
import { MessageCircle, FileText, ChevronDown, ChevronUp, Plus, Trash2, ChevronRight, ChevronLeft } from 'lucide-react';
import { STICKY_NOTE_COLORS, BLANK_NODE_COLOR, ANSWER_NODE_COLOR, stickyNoteStyles, nodeAnimationStyles } from '../styles/styles';
import { usePdfViewerContext } from '../context'; // Import usePdfViewerContext

// Node component props type
interface CustomNodeProps {
  data: {
    title: string;
    description: string;
    updateNodeData?: (id: string, newData: { title?: string; description?: string; width?: number; pageNumber?: number; expanded?: boolean }) => void;
    addFollowUpNode?: (parentId: string, question: string, answer: string, customNodeId?: string) => string;
    nodeType?: 'regular' | 'qna' | 'blank'; // Add 'blank' type to identify blank nodes
    lastCreatedNodeId?: string; // ID of the most recently created node
    hasChildren?: boolean; // Whether this node has children
    childrenCollapsed?: boolean; // Whether children are collapsed
    toggleChildrenVisibility?: (nodeId: string) => void; // Function to toggle children visibility
    width?: number; // Width of the node
    pageNumber?: number; // Page number in the PDF
    openPdfViewer?: (pageNumber: number) => void; // Function to open PDF viewer
    columnLevel?: number; // Column level for color assignment
    layoutDirection?: 'LR' | 'TB' | 'RL' | 'BT'; // Current layout direction
    deleteNode?: (nodeId: string) => void;
    expanded?: boolean;
    isOwner?: boolean;
    onInteract?: () => void;
  };
  id: string;
  selected?: boolean; // Add selected prop
}

// Custom node component
const CustomNodeComponent = ({ data, id, selected }: CustomNodeProps) => {
  const [showInfo, setShowInfo] = useState(false);
  const [expanded, setExpanded] = useState(data.expanded !== undefined ? data.expanded : true); // Expand all nodes by default
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [titleValue, setTitleValue] = useState(data.title);
  const [descriptionValue, setDescriptionValue] = useState(data.description);
  const [showChatButton, setShowChatButton] = useState(false);
  const [showFollowUpCard, setShowFollowUpCard] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [width, setWidth] = useState(data.width || 256); // Default width 256px (64*4)
  const [isResizing, setIsResizing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false); // State for highlight effect
  const [isDescriptionScrollable, setIsDescriptionScrollable] = useState(false); // State for scroll fade cue
  const [isScrolledToBottom, setIsScrolledToBottom] = useState(false); // State to track if scrolled to bottom

  const titleRef = useRef<HTMLTextAreaElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const descriptionContainerRef = useRef<HTMLDivElement>(null); // Ref for the scrollable description container
  const nodeRef = useRef<HTMLDivElement>(null);
  const updateNodeInternals = useUpdateNodeInternals();
  const { 
    inputType: contextInputType, 
    pdfUrl: contextPdfUrl, 
    // sourceUrl: contextSourceUrl, // Not directly needed here for button logic if relying on isPdfAccessExpired
    openPdfViewer: contextOpenPdfViewer, 
    isPdfAccessExpired, 
    parsedPdfContent: contextParsedPdfContent, 
    openArchivedContentViewer // Use new function
  } = usePdfViewerContext(); // Get context values

  // Check if this is a QnA node
  const isQnANode = data.nodeType === 'qna';

  // Check if this is a blank node by nodeType first, then fallback to title check for backward compatibility
  const isBlankNode = data.nodeType === 'blank' || (data.nodeType !== 'qna' && data.title === 'Double Click to Edit');

  // Determine if a PDF is available and what its source is.
  // A PDF is considered available if:
  // 1. The mindmap inputType is 'pdf' (meaning it originated from a PDF upload or direct PDF URL).
  // 2. There's a valid pdfUrl in the context (this could be a blob URL or a direct PDF URL).
  const isPdfAvailable = contextInputType === 'pdf' && !!contextPdfUrl;

  // Check if this is a PDF-based node (i.e., it has a pageNumber and a PDF is available for the mindmap)
  const isPdfNode = isPdfAvailable && data.pageNumber !== undefined && data.pageNumber !== null;

  // Get color based on node type or column level
  let nodeColor;

  if (isBlankNode) {
    // Use white/plain color for blank nodes (created with + button)
    nodeColor = BLANK_NODE_COLOR;
  } else if (isQnANode) {
    // Use light blue color for answer nodes (created with follow-up questions)
    nodeColor = ANSWER_NODE_COLOR;
  } else {
    // Use regular column-based color scheme for other nodes
    const columnLevel = data.columnLevel || 0;
    const colorIndex = columnLevel % STICKY_NOTE_COLORS.length;
    nodeColor = STICKY_NOTE_COLORS[colorIndex];
  }

  // Determine handle positions based on layout direction
  const isHorizontalFlow = !data.layoutDirection || data.layoutDirection === 'LR' || data.layoutDirection === 'RL';
  const sourcePosition = isHorizontalFlow ? Position.Right : Position.Bottom;
  const targetPosition = isHorizontalFlow ? Position.Left : Position.Top;

  // Ref to track previous data for highlighting
  const prevDataRef = useRef(data);

  // Update local state when data from parent changes
  useEffect(() => {
    let shouldHighlight = false;
    if (prevDataRef.current.title !== data.title) {
      setTitleValue(data.title);
      shouldHighlight = true;
    }
    if (prevDataRef.current.description !== data.description) {
      setDescriptionValue(data.description);
      shouldHighlight = true;
    }
    
    // Only update expanded state from props on initial render or when explicitly changed from parent
    // This allows the local toggle to work without being overridden
    if (prevDataRef.current.expanded !== data.expanded && data.expanded !== undefined) {
      setExpanded(data.expanded);
    }

    if (shouldHighlight) {
      setIsUpdating(true);
      const timer = setTimeout(() => {
        setIsUpdating(false);
      }, 1000); // Duration of the highlight effect

      // Update previous data ref
      prevDataRef.current = data;

      return () => clearTimeout(timer);
    } else {
      // Update ref even if no highlight to keep it current
      prevDataRef.current = data;
    }
  }, [data.title, data.description, data.expanded, data]);

  // Set cursor position to end of text
  const setCursorToEnd = (element: HTMLTextAreaElement) => {
    const length = element.value.length;
    element.setSelectionRange(length, length);
  };

  useEffect(() => {
    if (editingTitle && titleRef.current) {
      titleRef.current.focus();
      // Reset height first to ensure accurate calculation
      titleRef.current.style.height = '0';
      titleRef.current.style.height = `${titleRef.current.scrollHeight}px`;
      // Set cursor at the end
      setCursorToEnd(titleRef.current);
    }
    if (editingDescription && descriptionRef.current) {
      descriptionRef.current.focus();
      // Reset height first to ensure accurate calculation
      descriptionRef.current.style.height = '0';
      descriptionRef.current.style.height = `${descriptionRef.current.scrollHeight}px`;
      // Set cursor at the end
      setCursorToEnd(descriptionRef.current);
    }
  }, [editingTitle, editingDescription]);

  const checkInteraction = (e?: React.MouseEvent | React.TouchEvent | React.KeyboardEvent) => {
    if (data.isOwner === false) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      if (data.onInteract) data.onInteract();
      return false;
    }
    return true;
  };

  const handleTitleDoubleClick = (e: React.MouseEvent) => {
    if (!checkInteraction(e)) return;
    // Clear placeholder text if it matches before editing
    if (titleValue === 'Double Click to Edit') {
      setTitleValue('');
    }
    setEditingTitle(true);
    setShowInfo(false);
  };

  const handleDescriptionDoubleClick = (e: React.MouseEvent) => {
    if (!checkInteraction(e)) return;
    // Clear placeholder text if it matches before editing
    if (descriptionValue === 'Double-click to add a description') {
      setDescriptionValue('');
    }
    setEditingDescription(true);
    setShowInfo(false);
  };

  const handleTitleBlur = () => {
    setEditingTitle(false);
    const trimmedTitle = titleValue.trim(); // Trim whitespace
    if (data.updateNodeData) {
      // If the title is empty after trimming, revert to placeholder
      if (trimmedTitle === '') {
        // Only update if the original title wasn't already the placeholder
        if (data.title !== 'Double Click to Edit') {
            setTitleValue('Double Click to Edit'); // Update local state for immediate feedback
            data.updateNodeData(id, { title: 'Double Click to Edit' });
        } else {
            // If the original title was already placeholder, no need to update
            setTitleValue('Double Click to Edit'); // Ensure local state is placeholder
        }
      } else if (trimmedTitle !== data.title) {
        // Otherwise, update with the new trimmed title if it changed
        setTitleValue(trimmedTitle); // Update local state with trimmed value
        data.updateNodeData(id, { title: trimmedTitle });
      }
      // If trimmedTitle is the same as data.title, do nothing
    }
  };

  const handleDescriptionBlur = () => {
    setEditingDescription(false);
    if (data.updateNodeData && descriptionValue !== data.description) {
      data.updateNodeData(id, { description: descriptionValue });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, field: 'title' | 'description') => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      if (field === 'title') {
        handleTitleBlur();
      } else {
        handleDescriptionBlur();
      }
    }
  };

  const handleTextAreaChange = (e: React.ChangeEvent<HTMLTextAreaElement>, setter: React.Dispatch<React.SetStateAction<string>>) => {
    // Update the text value
    setter(e.target.value);

    // Auto-adjust height with a small delay to ensure proper calculation
    requestAnimationFrame(() => {
      e.target.style.height = '0';
      e.target.style.height = `${e.target.scrollHeight}px`;
    });
  };

  // Toggle expanded state and sync with data if needed
  const toggleExpanded = () => {
    setShowInfo(false);

    // Update node size immediately to prepare for animation
    updateNodeInternals(id);

    // Toggle expanded state after a small delay to ensure proper animation start
    requestAnimationFrame(() => {
      const newExpandedState = !expanded;
      setExpanded(newExpandedState);
      
      // If updateNodeData exists, update the expanded state in the data
      if (data.updateNodeData) {
        data.updateNodeData(id, { expanded: newExpandedState });
      }

      // Update node internals after animation completes
      setTimeout(() => {
        updateNodeInternals(id);
      }, 250); // Match the transition duration (0.2s) with some buffer
    });
  };

  const handleChatButtonClick = (e: React.MouseEvent) => {
    if (!checkInteraction(e)) return;
    e.stopPropagation();
    setShowFollowUpCard(true);
  };

  // Function to handle document button click
  const handleDocumentButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPdfNode) {
      if (isPdfAccessExpired) {
        if (contextParsedPdfContent) {
          openArchivedContentViewer(); // This is the new way
        } else {
          // Optionally, handle the case where PDF is expired AND no archived content exists
          // (e.g., alert the user, or the button might be disabled/hidden by other logic)
          console.warn('PDF expired and no archived content available for this node.');
        }
      } else if (contextOpenPdfViewer) {
        // PDF not expired, open PDF viewer
        const pageToOpen = data.pageNumber && data.pageNumber > 0 ? data.pageNumber : 1;
        contextOpenPdfViewer(pageToOpen);
      }
    }
  };

  const handleChildrenToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (data.toggleChildrenVisibility) {
      data.toggleChildrenVisibility(id);
    }
  };

  const handleAddBlankChildNode = (e: React.MouseEvent) => {
    if (!checkInteraction(e)) return;
    e.stopPropagation();
    if (data.addFollowUpNode) {
      // Create a blank child node with placeholder title and default description
      data.addFollowUpNode(id, 'Double Click to Edit', 'Double-click to add a description', undefined);
    }
  };

  // Use the imported handleFollowUpSave but bind it to this component's context
  const handleFollowUpSave = async (parentId: string, question: string) => {
    if (!data.addFollowUpNode) {
      console.error('Cannot create follow-up: addFollowUpNode function not available');
      return '';
    }
    
    // Hide the follow-up card
    setShowFollowUpCard(false);
    
    // Create a loading child node immediately
    const nodeId = data.addFollowUpNode(
      id, 
      question, // Use the question as the title
      '<div class="flex items-center justify-center p-2"><div class="flex flex-col items-center"><div class="flex space-x-1"><div class="h-2 w-2 bg-blue-600 rounded-full animate-[bounce_1s_ease-in-out_0s_infinite]"></div><div class="h-2 w-2 bg-blue-600 rounded-full animate-[bounce_1s_ease-in-out_0.2s_infinite]"></div><div class="h-2 w-2 bg-blue-600 rounded-full animate-[bounce_1s_ease-in-out_0.4s_infinite]"></div></div><div class="text-blue-600 font-medium mt-2">Answering</div></div></div>', // Wave animation with dots
      undefined // Let the system generate a node ID
    );
    
    try {
      // Get chat history from localStorage instead of sessionId
      const rawChatHistory = JSON.parse(localStorage.getItem('chatHistory') || '[]');
      
      // Ensure chat history has the correct role format for Gemini API
      const chatHistory = rawChatHistory.map((msg: any) => ({
        ...msg,
        role: msg.role === 'assistant' ? 'model' : msg.role
      }));
      
      // Call API endpoint with follow-up question
      const response = await fetch('/api/papermap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isFollowUp: true,
          question: question,
          nodeContext: {
            title: data.title,
            description: data.description
          },
          chatHistory: chatHistory
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get answer');
      }
      
      const result = await response.json();
      
      // Save updated chat history to localStorage
      if (result.chatHistory) {
        localStorage.setItem('chatHistory', JSON.stringify(result.chatHistory));
      }
      
      if (result.success && result.answer) {
        // Update the child node with the answer
        if (data.updateNodeData) {
          // Ensure answer is string, or convert it to a string
          const answerContent = typeof result.answer === 'string' 
            ? result.answer 
            : JSON.stringify(result.answer);
            
          data.updateNodeData(nodeId, { description: answerContent });
        }
        
        return nodeId;
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      console.error('Error processing follow-up question:', error);
      // Update the child node with error message
      if (data.updateNodeData) {
        data.updateNodeData(
          nodeId,
          { description: `Failed to get answer: ${error instanceof Error ? error.message : 'Unknown error'}` }
        );
      }
      return nodeId;
    }
  };

  const handleFollowUpCancel = () => {
    setShowFollowUpCard(false);
  };

  // Update reactflow when resizing starts or ends
  useEffect(() => {
    if (isResizing) {
      // Set a data attribute that can be used by the parent ReactFlow component
      const nodeElement = nodeRef.current;
      if (nodeElement) {
        nodeElement.setAttribute('data-nodedrag', 'false');
      }
    } else {
      const nodeElement = nodeRef.current;
      if (nodeElement) {
        nodeElement.setAttribute('data-nodedrag', 'true');
      }
    }
  }, [isResizing]);

  // Update node internals when content changes or width changes
  useEffect(() => {
    // Use a small delay to ensure DOM has updated
    const timeoutId = setTimeout(() => {
      updateNodeInternals(id);
    }, 50);

    return () => clearTimeout(timeoutId);
  }, [id, updateNodeInternals, width, titleValue, descriptionValue, expanded]);

  // CSS injection for animations and scroll fade
  useEffect(() => {
    const scrollFadeStyle = `
      .node-description-wrapper {
        position: relative; /* Needed for ::after positioning */
      }
      .node-description-wrapper.has-scroll-fade::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 100px; /* Adjust height as needed */
        background: linear-gradient(to bottom, transparent, var(--node-bg-color, #fff));
        pointer-events: none; /* Prevent blocking interaction */
        z-index: 1; /* Ensure it's above the text */
        border-bottom-left-radius: inherit; /* Match parent rounding */
        border-bottom-right-radius: inherit;
        transition: opacity 0.2s ease-in-out; /* Add transition for fade */
        opacity: 1;
      }
      .node-description-wrapper.collapsed .node-description-content.has-scroll-fade::after {
        opacity: 0; /* Hide fade when wrapper is collapsed */
      }
    `;

    const styleId = 'custom-node-styles';
    let styleTag = document.getElementById(styleId) as HTMLStyleElement | null;

    if (!styleTag) {
      styleTag = document.createElement('style');
      styleTag.id = styleId;
      // Combine base animation styles and scroll fade styles
      styleTag.innerHTML = nodeAnimationStyles + scrollFadeStyle;
      document.head.appendChild(styleTag);
    } else {
      // If tag exists, ensure both sets of styles are present (idempotent)
      let updatedStyles = styleTag.innerHTML;
      if (!updatedStyles.includes('.node-card.updating')) { // Check for a unique string from nodeAnimationStyles
        updatedStyles += nodeAnimationStyles;
      }
      if (!updatedStyles.includes('.has-scroll-fade::after')) { // Check for a unique string from scrollFadeStyle
        updatedStyles += scrollFadeStyle;
      }
      styleTag.innerHTML = updatedStyles;
    }
    // No cleanup function needed, let the styles persist globally
  }, []); // Run only once on mount

  // Effect to check if description is scrollable
  useEffect(() => {
    const element = descriptionContainerRef.current;

    // If not expanded or element doesn't exist, it's not scrollable
    if (!expanded || !element) {
      if (isDescriptionScrollable) setIsDescriptionScrollable(false);
      return;
    }

    let observer: ResizeObserver | null = null;

    const checkScrollability = () => {
      // Check element exists again inside the potentially delayed callback
      if (element) {
        // RAF ensures we check *after* rendering and layout calculation
        requestAnimationFrame(() => {
          if (element) { // Final check inside RAF
            const scrollable = element.scrollHeight > element.clientHeight + 1; // Add 1px tolerance
            const scrolledToBottom = element.scrollTop + element.clientHeight >= element.scrollHeight - 1; // Check if scrolled near bottom

            // Only update state if the value actually changes
            if (scrollable !== isDescriptionScrollable) {
              setIsDescriptionScrollable(scrollable);
            }
            if (scrolledToBottom !== isScrolledToBottom) {
              setIsScrolledToBottom(scrolledToBottom);
            }
          }
        });
      }
    };

    // Initial check slightly delayed to allow for rendering/transitions
    const initialCheckTimeout = setTimeout(checkScrollability, 50);

    // Use ResizeObserver for robust detection of size changes
    observer = new ResizeObserver(checkScrollability);
    observer.observe(element);

    // Also observe children as direct content changes might not trigger observer on parent
    const childNodes = Array.from(element.children);
    childNodes.forEach(child => observer?.observe(child));

    // Re-check when scrolling occurs (handles edge cases like async content load)
    element.addEventListener('scroll', checkScrollability);

    return () => {
      clearTimeout(initialCheckTimeout);
      observer?.disconnect();
      element?.removeEventListener('scroll', checkScrollability);
    };

    // Key dependencies: expansion state, content, dimensions, and current scrollable status
  }, [expanded, descriptionValue, width, id, isDescriptionScrollable, isScrolledToBottom]);

  // Measure node content and synchronize with ReactFlow
  useEffect(() => {
    if (!nodeRef.current) return;

    // Function to measure and update node dimensions
    const syncNodeSize = () => {
      const nodeElement = nodeRef.current;
      if (!nodeElement) return;

      // Force a reflow to ensure accurate measurements
      void nodeElement.offsetHeight;

      // Get actual content height
      const contentHeight = nodeElement.getBoundingClientRect().height;

      // Update ReactFlow node dimensions
      updateNodeInternals(id);

      // Access parent ReactFlow node if possible and update its height
      const reactFlowNode = nodeElement.closest('.react-flow__node');
      if (reactFlowNode && reactFlowNode instanceof HTMLElement) {
        reactFlowNode.style.height = `${contentHeight}px`;
      }
    };

    // Sync node size initially
    syncNodeSize();

    // Sync node size after resize and when content changes
    const resizeObserver = new ResizeObserver(() => {
      syncNodeSize();
    });

    resizeObserver.observe(nodeRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [id, updateNodeInternals, width, expanded]);

  useEffect(() => {
  }, [id, data.pageNumber, data.openPdfViewer]);

  // Add optimized sticky note style to document - only once
  useEffect(() => {
    // Check if style already exists to prevent duplicates
    const existingStyle = document.getElementById('sticky-note-style');
    if (!existingStyle) {
      const styleEl = document.createElement('style');
      styleEl.id = 'sticky-note-style';
      styleEl.textContent = stickyNoteStyles;
      document.head.appendChild(styleEl);
    }

    // No need to clean up since we're sharing a single style element across all nodes
  }, []);

  // Ensure border styles are consistent to prevent conflicts
  useEffect(() => {
    if (!nodeRef.current) return;

    // Function to ensure consistent border styles
    const ensureConsistentStyles = () => {
      const nodeElement = nodeRef.current;
      if (!nodeElement) return;

      // Ensure the parent ReactFlow node has consistent border style
      const reactFlowNode = nodeElement.closest('.react-flow__node');
      if (reactFlowNode && reactFlowNode instanceof HTMLElement) {
        if (reactFlowNode.style.borderColor && !reactFlowNode.style.border) {
          // If borderColor is set without border, fix it
          const color = reactFlowNode.style.borderColor;
          reactFlowNode.style.border = `2px solid ${color}`;
          reactFlowNode.style.borderColor = '';
        }
      }
    };

    // Run once on mount and whenever relevant props change
    ensureConsistentStyles();

    // Set up a MutationObserver to watch for style changes
    const observer = new MutationObserver(ensureConsistentStyles);
    observer.observe(nodeRef.current, {
      attributes: true,
      attributeFilter: ['style'],
      subtree: true
    });

    return () => observer.disconnect();
  }, [id, width, selected, isResizing]);

  // Add handler for delete button click
  const handleDeleteButtonClick = (e: React.MouseEvent) => {
    if (!checkInteraction(e)) return;
    e.stopPropagation();
    setShowDeleteConfirm(true);
  };

  // Add handler for confirming deletion
  const handleConfirmDelete = () => {
    if (data.deleteNode) {
      data.deleteNode(id);
    }
    setShowDeleteConfirm(false);
  };

  // Add handler for canceling deletion
  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
  };

  // Add useEffect for event listeners on description container
  useEffect(() => {
    const element = descriptionContainerRef.current;
    if (!element) return;

    const handleWheel = (event: WheelEvent) => {
      if (!element) return;
      const { scrollTop, scrollHeight, clientHeight } = element;
      const deltaY = event.deltaY;
      const isScrollable = scrollHeight > clientHeight;

      if (!isScrollable) {
        return; // Don't stop propagation if not scrollable
      }

      // Check if scrolling up is possible and intended
      if (deltaY < 0 && scrollTop > 0) {
        event.stopPropagation();
        return;
      }

      // Check if scrolling down is possible and intended
      // Allow a small tolerance (e.g., 1px) for floating point inaccuracies
      if (deltaY > 0 && scrollTop + clientHeight < scrollHeight - 1) {
        event.stopPropagation();
        return;
      }

      // If trying to scroll past boundaries, allow event to bubble up (for zoom/pan)
    };

    const handleTouchMove = (event: TouchEvent) => {
       if (!element) return;
       const isScrollable = element.scrollHeight > element.clientHeight;
       if (isScrollable) {
         // Stop propagation if the content area is scrollable
         // This prioritizes content scrolling over node dragging/panning on touch devices
         event.stopPropagation();
       }
    };

    // Attach listeners with passive: false to allow stopPropagation
    element.addEventListener('wheel', handleWheel, { passive: false });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      // Clean up listeners
      element.removeEventListener('wheel', handleWheel);
      element.removeEventListener('touchmove', handleTouchMove);
    };
  }, [expanded]); // Re-attach listeners if expanded state changes (might affect scrollability)

  return (
      <div
        ref={nodeRef}
        className={[
          'node-card', // Base class
          'p-4', // Padding
          'rounded-lg', // Rounded corners
          'shadow-md', // Shadow
          'relative', // For absolute positioning of children
          'group', // For group hover states (if used)
          'sticky-note', // Specific styling class
          isUpdating ? 'updating' : '', // Conditional updating class
          showFollowUpCard ? 'active-with-followup' : '', // Conditional class
        ].filter(Boolean).join(' ')} // Combine classes safely
        style={{
          // Apply background from nodeColor
          backgroundColor: nodeColor.bg,
          // Apply border/shadow from nodeColor, override with selected/resizing states
          border: isResizing
            ? '1px solid #191918'
            : selected
              ? '1.5px solid #191918'
              : `1px solid ${nodeColor.border || 'transparent'}`,
          boxShadow: selected
            ? '0 0 0 3px rgba(25, 25, 24, 0.14)'
            : nodeColor.shadow || '0 4px 6px rgba(0, 0, 0, 0.1)',
          // Apply width and height
          width: `${width}px`,
          height: 'auto',
          minHeight: 'fit-content',
          // Apply transitions (unless resizing)
          transition: isResizing ? 'none' : 'border 0.3s, box-shadow 0.3s, background-color 0.2s', 
          // Other necessary styles
          userSelect: isResizing ? 'none' : 'auto',
          zIndex: selected || isHovering || showFollowUpCard ? 1001 : 'auto',
          transformOrigin: 'center',
        }}
        onMouseEnter={() => {
          setIsHovering(true);
          setShowChatButton(true);
        }}
        onMouseLeave={() => {
          setIsHovering(false);
          setShowChatButton(false);
        }}
      >
        {/* Handles are direct children */}
        <Handle
          type="target"
          position={targetPosition}
          style={{ background: nodeColor.border, width: '10px', height: '10px', opacity: 0, border: 'none' }}
          id="target"
        />
        <Handle
          type="source"
          position={sourcePosition}
          style={{ background: nodeColor.border, width: '10px', height: '10px', zIndex: 100, opacity: 0, border: 'none' }}
          id="source"
        />

        {/* Inner content wrapper (removed extra classes/styles from here) */}
        <div className="flex justify-between items-start">
          {editingTitle ? (
             <textarea
              ref={titleRef}
              value={titleValue}
              onChange={(e) => handleTextAreaChange(e, setTitleValue)}
              onBlur={handleTitleBlur}
              onKeyDown={(e) => handleKeyDown(e, 'title')}
              className="font-bold text-lg mb-2 w-full resize-none overflow-hidden bg-transparent border-none outline-none p-0 shadow-none"
              style={{ minHeight: '1.5rem'}}
              rows={1}
            />
          ) : (
            <h3
              className="font-bold text-lg mb-2 cursor-text"
              style={{ color: '#191918' }}
              onDoubleClick={handleTitleDoubleClick}
            >
              {data.title}
            </h3>
          )}
          <div className="flex flex-shrink-0">
            <button 
              className="mt-1 font-bold text-gray-800" 
              onClick={toggleExpanded} 
              title={expanded ? "Collapse" : "Expand"}
            >
              {expanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Description container */}
        {!showInfo && (
          <div
            className={`node-description-wrapper ${!expanded ? 'collapsed' : ''} ${isDescriptionScrollable && !isScrolledToBottom ? 'has-scroll-fade' : ''}`}
            style={{ '--node-bg-color': nodeColor.bg } as React.CSSProperties} // Pass bg color to wrapper for gradient
          >
            <div
              ref={descriptionContainerRef} // Assign the ref here
              className={`node-description-content ${expanded ? 'expanded' : 'collapsed'} max-h-80 overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-gray-400 hover:scrollbar-thumb-gray-500`}
              onTransitionEnd={() => updateNodeInternals(id)}
            >
              {editingDescription ? (
                <div>
                  <textarea
                    ref={descriptionRef}
                    value={descriptionValue}
                    onChange={(e) => handleTextAreaChange(e, setDescriptionValue)}
                    onBlur={handleDescriptionBlur}
                    onKeyDown={(e) => handleKeyDown(e, 'description')}
                    className="w-full text-sm resize-none overflow-hidden font-mono"
                    style={{
                      outline: 'none',
                      border: 'none',
                      padding: 0,
                      minHeight: '2rem',
                      background: 'transparent',
                      boxShadow: 'none'
                    }}
                    placeholder="Markdown formatting supported"
                  />
                </div>
              ) : (
                <div
                  className="text-sm cursor-text"
                  onDoubleClick={handleDescriptionDoubleClick}
                >
                  {typeof data.description === 'string' && data.description.includes('<div class=') ? (
                    <div dangerouslySetInnerHTML={{ __html: data.description }} />
                  ) : (
                    <div className="markdown-content prose prose-sm max-w-none prose-headings:mt-2 prose-headings:mb-1 prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-pre:my-1 prose-blockquote:my-1" style={{ color: 'rgba(0, 0, 0, 0.85)' }}>
                      <ReactMarkdown>
                        {extractMarkdownContent(typeof data.description === 'string' ? data.description : JSON.stringify(data.description)) || 'Double-click to add a description'}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              )}
            </div>
            {editingDescription && (
              <div className="text-xs text-gray-500 mt-2 italic">
                Example: **bold**, *italic*, lists, `code`, etc.
              </div>
            )}
          </div>
        )}

        {/* Floating buttons are direct children */}
        {isHovering && !editingTitle && !editingDescription && !showFollowUpCard && (
          <div 
            className={`absolute ${isHorizontalFlow ? '-bottom-6 left-1/2 transform -translate-x-1/2' : 'left-[-25px] top-1/2 transform -translate-y-1/2'} cursor-pointer flex ${isHorizontalFlow ? 'space-x-1' : 'flex-col space-y-1'}`}
            style={{ zIndex: 1000 }} 
            data-exclude-from-export="true"
          >
            {/* Show FileText icon only if it's a PDF node and not a blank node */}
            {isPdfNode && !isBlankNode && (
              <button
                className="flex h-8 w-8 items-center justify-center rounded-full border border-black/[0.08] bg-white/85 p-2 text-[#191918] shadow-sm backdrop-blur transition-all hover:bg-black/[0.05] dark:border-white/[0.1] dark:bg-[#1b1b19]/85 dark:text-[#f2f2ef] dark:hover:bg-white/[0.1]"
                onClick={handleDocumentButtonClick}
                title={
                  isPdfAccessExpired 
                    ? (contextParsedPdfContent ? "View Archived Text" : "PDF Expired (No Archive)") 
                    : `View page ${data.pageNumber} in the PDF`
                }
                // Disable button if PDF expired and no archived content
                disabled={isPdfAccessExpired && !contextParsedPdfContent}
              >
                <FileText className="h-6 w-6 text-foreground" />
              </button>
            )}

            {showChatButton && (
              <button
                className="flex h-8 w-8 items-center justify-center rounded-full border border-black/[0.08] bg-white/85 p-2 text-[#191918] shadow-sm backdrop-blur transition-all hover:bg-black/[0.05] dark:border-white/[0.1] dark:bg-[#1b1b19]/85 dark:text-[#f2f2ef] dark:hover:bg-white/[0.1]"
                onClick={handleAddBlankChildNode}
                title="Add blank child node"
              >
                <Plus className="h-5 w-5 text-foreground" />
              </button>
            )}

            {showChatButton && !isBlankNode && (
              <button
                className="flex h-8 w-8 items-center justify-center rounded-full border border-black/[0.08] bg-white/85 p-2 text-[#191918] shadow-sm backdrop-blur transition-all hover:bg-black/[0.05] dark:border-white/[0.1] dark:bg-[#1b1b19]/85 dark:text-[#f2f2ef] dark:hover:bg-white/[0.1]"
                onClick={handleChatButtonClick}
                title="Ask a follow-up question"
              >
                <MessageCircle className="h-5 w-5 text-foreground" />
              </button>
            )}
          </div>
        )}

        {/* Toggle Children Button - Corrected Positioning and Icons */}
        {data.hasChildren && (
          <div 
            className={`absolute cursor-pointer p-0.5 rounded-full border border-black/[0.12] bg-white/85 backdrop-blur hover:border-black/[0.2] hover:bg-black/[0.05] z-10 dark:border-white/[0.14] dark:bg-[#1b1b19]/85 dark:hover:bg-white/[0.1]
              ${isHorizontalFlow
                ? 'right-[-12px] top-1/2 transform -translate-y-1/2' // Centered on Right for LR/RL
                : 'bottom-[-12px] left-1/2 transform -translate-x-1/2' // Centered on Bottom for TB/BT
              }`}
            style={{ zIndex: 1000 }} 
            onClick={handleChildrenToggle}
            title={data.childrenCollapsed ? "Show Children" : "Hide Children"}
            data-exclude-from-export="true"
          >
            {isHorizontalFlow ? (
              // Icons for Horizontal flow (LR/RL)
              data.childrenCollapsed ? (
                <ChevronRight className="w-4 h-4 text-black/60 dark:text-white/60" />
              ) : (
                <ChevronLeft className="w-4 h-4 text-black/60 dark:text-white/60" />
              )
            ) : (
              // Icons for Vertical flow (TB/BT)
              data.childrenCollapsed ? (
                <ChevronDown className="w-4 h-4 text-black/60 dark:text-white/60" />
              ) : (
                <ChevronUp className="w-4 h-4 text-black/60 dark:text-white/60" />
              )
            )}
          </div>
        )}
        
        {showFollowUpCard && (
          <FollowUpCard
            parentId={id}
            onSave={handleFollowUpSave}
            onCancel={handleFollowUpCancel}
            loading={loading}
          />
        )}

        {selected && !showDeleteConfirm && (
           <div 
             className="absolute top-[-10px] right-[-10px] cursor-pointer p-1 bg-destructive text-destructive-foreground rounded-full shadow-md border border-border hover:bg-destructive/80" 
             onClick={handleDeleteButtonClick}
             title="Delete node"
             data-exclude-from-export="true"
           >
             <Trash2 className="w-3.5 h-3.5" />
           </div>
        )}

        {showDeleteConfirm && (
          <div
            className="absolute bottom-0 left-0 right-0 top-0 z-50 flex flex-col items-center justify-center rounded-lg border border-destructive bg-[#f7f7f5]/85 p-4 backdrop-blur-sm dark:bg-[#10100f]/85"
            data-exclude-from-export="true"
          >
             <p className="text-sm font-medium text-center mb-3">Delete this node?</p>
             <div className="flex space-x-2">
               <button 
                 onClick={handleConfirmDelete} 
                 className="px-3 py-1 text-xs bg-destructive text-destructive-foreground rounded hover:bg-destructive/80"
               >
                 Delete
               </button>
               <button 
                 onClick={handleCancelDelete} 
                 className="px-3 py-1 text-xs bg-secondary text-secondary-foreground rounded hover:bg-secondary/80"
               >
                 Cancel
               </button>
             </div>
           </div>
        )}
      </div>
  );
};

// Wrap the component with React.memo
const CustomNode = memo(CustomNodeComponent);

// Add this utility function at the top of the file (after imports)
const extractMarkdownContent = (content: any): string => {
  // Handle non-string content
  if (typeof content !== 'string') {
    try {
      // If it's an object, try to stringify it
      if (typeof content === 'object' && content !== null) {
        if (content.answer) {
          return content.answer;
        }
        return JSON.stringify(content);
      }
      // Convert to string for any other type
      return String(content);
    } catch (e) {
      console.error('Failed to convert content to string:', e);
      return '';
    }
  }

  if (!content) return '';

  // First attempt: Try to directly parse as JSON
  if (content.trim().startsWith('{') && content.includes('"answer"')) {
    try {
      const parsed = JSON.parse(content);
      if (parsed.answer) {
        return parsed.answer;
      }
    } catch (e) {
      console.log('Failed to parse as JSON object, trying other methods');
    }
  }

  // Second attempt: Find JSON by manually locating braces
  const openBraceIndex = content.indexOf('{');
  const closeBraceIndex = content.lastIndexOf('}');

  if (openBraceIndex >= 0 && closeBraceIndex > openBraceIndex) {
    const potentialJson = content.substring(openBraceIndex, closeBraceIndex + 1);

    try {
      const parsed = JSON.parse(potentialJson);
      if (parsed.answer) {
        return parsed.answer;
      }
    } catch (e) {
      // Try with unescaped version
      try {
        const unescaped = potentialJson
          .replace(/\\"/g, '"')
          .replace(/\\n/g, '\n')
          .replace(/\\t/g, '\t')
          .replace(/\\\\/g, '\\');

        const parsed = JSON.parse(unescaped);
        if (parsed.answer) {
          return parsed.answer;
        }
      } catch (e2) {
        console.log('Failed to parse potential JSON with unescaping');
      }
    }
  }

  // Third attempt: Check if content is just a code block
  const codeBlockStart = content.indexOf('```');
  if (codeBlockStart >= 0) {
    const afterLanguage = content.indexOf('\n', codeBlockStart);
    const codeBlockEnd = content.indexOf('```', afterLanguage);

    if (afterLanguage >= 0 && codeBlockEnd > afterLanguage) {
      const codeContent = content.substring(afterLanguage + 1, codeBlockEnd).trim();

      // If the code content itself looks like JSON with an answer field, try to parse it
      if (codeContent.includes('"answer"')) {
        try {
          const parsed = JSON.parse(codeContent);
          if (parsed.answer) {
            return parsed.answer;
          }
        } catch (e) {
          // Just return the code content if we can't parse it
          return codeContent;
        }
      }

      return codeContent;
    }
  }

  // Just return the original content if all extraction attempts fail
  return content;
};

export default CustomNode; 