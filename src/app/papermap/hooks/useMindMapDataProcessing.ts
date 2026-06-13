'use client';

import { useCallback, Dispatch, SetStateAction, RefObject } from 'react';
import { Node, Edge, ReactFlowInstance } from 'reactflow';
import { MindMapData, NodePosition } from '../types';
import { EXAMPLE_MINDMAP, EXAMPLE_PDF_URL } from '../data/sampleMindmap';

interface UseMindMapDataProcessingProps {
  setLoading: Dispatch<SetStateAction<boolean>>;
  setLoadingStage: Dispatch<SetStateAction<'uploading' | 'analyzing' | 'generating' | 'saving' | 'building' | null>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setUploadError: Dispatch<SetStateAction<Error | null>>;
  setMindMapData: Dispatch<SetStateAction<MindMapData | null>>;
  setPdfUrl: Dispatch<SetStateAction<string | null>>;
  setFileName: Dispatch<SetStateAction<string>>;
  setNodes: Dispatch<SetStateAction<Node[]>>;
  setEdges: Dispatch<SetStateAction<Edge[]>>;
  setNodePositions: Dispatch<SetStateAction<Record<string, NodePosition>>>;
  setCollapsedNodes: Dispatch<SetStateAction<Set<string>>>;
  reactFlowInstanceRef: RefObject<ReactFlowInstance | null>;
  // fileLoading and setFileLoading were present in original state, but not directly used by these functions.
  // If they are needed for UI elsewhere, the main hook can still expose them from useMindMapState.
}

export function useMindMapDataProcessing({
  setLoading,
  setLoadingStage,
  setError,
  setUploadError,
  setMindMapData,
  setPdfUrl,
  setFileName,
  setNodes,
  setEdges,
  setNodePositions,
  setCollapsedNodes,
  reactFlowInstanceRef,
}: UseMindMapDataProcessingProps) {

  const loadExampleMindMap = useCallback(() => {
    setLoading(true);
    setLoadingStage('generating');
    setError(null);
    setMindMapData(EXAMPLE_MINDMAP);
    setPdfUrl(EXAMPLE_PDF_URL);
    setFileName('mindmap');
    setCollapsedNodes(new Set());
    setNodes([]); // Clear existing nodes to trigger re-render from new mindMapData
    setEdges([]); // Clear existing edges
    setNodePositions({});

    localStorage.setItem('pdfBlobUrl', EXAMPLE_PDF_URL);
    localStorage.removeItem('userHasUploadedPdf'); // Reset this flag for example
    localStorage.removeItem('chatHistory');
    localStorage.removeItem('currentSessionId');

    setTimeout(() => {
      setLoading(false);
      setLoadingStage(null);
      setTimeout(() => {
        if (reactFlowInstanceRef.current) {
          reactFlowInstanceRef.current.fitView({ padding: 0.4, duration: 800, includeHiddenNodes: false });
        }
      }, 300);
    }, 100);
  }, [setLoading, setLoadingStage, setError, setMindMapData, setPdfUrl, setFileName, setCollapsedNodes, setNodes, setEdges, setNodePositions, reactFlowInstanceRef]);

  const generateInitialMindMap = useCallback(async (fileNameInput: string, pdfBlobUrl: string) => {
    setError(null);
    setLoadingStage('analyzing');
    try {
      const response = await fetch('/api/papermap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blobUrl: pdfBlobUrl, fileName: fileNameInput, chatHistory: [] }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process PDF');
      }
      const data = await response.json();
      setLoadingStage('saving');
      if (data && data.mindmap && typeof data.mindmap === 'object') {
        setMindMapData(data.mindmap);
        if (data.chatHistory) {
          try {
            const formattedChatHistory = data.chatHistory.map((msg: any) => ({ ...msg, role: msg.role === 'assistant' ? 'model' : msg.role }));
            localStorage.setItem('chatHistory', JSON.stringify(formattedChatHistory));
          } catch (storageError) { console.warn('Failed to store chat history:', storageError); }
        }
      } else { throw new Error('Invalid mind map data received'); }

      // Nodes/edges will be set by the layout effect in useMindMapLayout based on new mindMapData
      // Fit view after layout is applied
      setTimeout(() => {
        if (reactFlowInstanceRef.current) {
          reactFlowInstanceRef.current.fitView({ padding: 0.4, duration: 800, includeHiddenNodes: false });
        }
      }, 100); // Adjust timing if needed, should be after layout effect
      return true;
    } catch (err) {
      console.error('Error generating mindmap:', err);
      throw err;
    }
  }, [setMindMapData, setError, setLoadingStage, reactFlowInstanceRef]); // Removed setNodes, setEdges as layout hook handles this

  const handleFileUpload = useCallback(async (file: File, blobUrl?: string, originalFileName?: string, sourceUrl?: string) => {
    if (!file) return null;
    setLoading(true);
    setLoadingStage('uploading');
    setError(null);
    setUploadError(null);

    try {
      if (file.type !== 'application/pdf') throw new Error('Only PDF files are supported');
      localStorage.removeItem('chatHistory');
      localStorage.removeItem('pdfSessionId');
      localStorage.removeItem('pdfSessionData');
      const existingPdfUrl = localStorage.getItem('pdfBlobUrl');
      if (existingPdfUrl && existingPdfUrl.includes('Steve_Jobs_Stanford_Commencement_Speech_2015.pdf')) {
        localStorage.removeItem('pdfBlobUrl');
      }
      try { localStorage.setItem('userHasUploadedPdf', 'true'); }
      catch (error) { console.warn('Failed to set userHasUploadedPdf flag'); }

      let uploadedBlobUrl: string;
      if (!blobUrl) {
        const formData = new FormData();
        formData.append('file', file);
        const uploadRes = await fetch('/api/papermap/upload', {
          method: 'POST',
          body: formData,
        });
        if (!uploadRes.ok) {
          const errData = await uploadRes.json();
          throw new Error(errData.error || 'Failed to upload to Google Cloud Storage');
        }
        const blob = await uploadRes.json();
        if (!blob.url) throw new Error('No blob URL returned from upload');
        uploadedBlobUrl = blob.url;
      } else {
        uploadedBlobUrl = blobUrl;
      }

      localStorage.setItem('pdfBlobUrl', uploadedBlobUrl);
      localStorage.setItem('currentPdfBlobUrl', uploadedBlobUrl);
      setPdfUrl(uploadedBlobUrl);
      setFileName(file.name);

      setMindMapData(null); // Clear old data
      setNodes([]);
      setEdges([]);
      setNodePositions({});
      setCollapsedNodes(new Set());

      // setLoadingStage('processing'); // generateInitialMindMap sets this
      const response = await fetch('/api/papermap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blobUrl: uploadedBlobUrl,
          // Use originalFileName if provided, otherwise fall back to file.name
          originalFileName: originalFileName || file.name,
          sourceUrl,
          chatHistory: []
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process PDF');
      }
      const data = await response.json();
      setLoadingStage('saving');
      if (data && data.mindmap && typeof data.mindmap === 'object') {
        setMindMapData(data.mindmap);
        if (data.chatHistory) {
          try {
            const formattedChatHistory = data.chatHistory.map((msg: any) => ({ ...msg, role: msg.role === 'assistant' ? 'model' : msg.role }));
            localStorage.setItem('chatHistory', JSON.stringify(formattedChatHistory));
          } catch (storageError) { console.warn('Failed to store chat history:', storageError); }
        }
      } else { throw new Error('Invalid mind map data received'); }
      setTimeout(() => {
        if (reactFlowInstanceRef.current) {
          reactFlowInstanceRef.current.fitView({ padding: 0.4, duration: 800, includeHiddenNodes: false });
        }
      }, 100);
      setLoading(false);
      setLoadingStage(null);
      return data; // Return full API response (with mindmapId)
    } catch (error) {
      console.error('Error handling file upload:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to process PDF';
      setUploadError(error instanceof Error ? error : new Error('Unknown upload error'));
      setError(errorMessage);
      setLoading(false);
      setLoadingStage(null);
      return null;
    }
  }, [setLoading, setLoadingStage, setError, setUploadError, setPdfUrl, setFileName,
    setMindMapData, setNodes, setEdges, setNodePositions, setCollapsedNodes,
    reactFlowInstanceRef]);

  const handleTextInput = useCallback(async (text: string, sourceUrl?: string) => {
    setLoading(true);
    setLoadingStage('analyzing');
    setError(null);
    setUploadError(null);

    try {
      localStorage.removeItem('chatHistory');
      localStorage.removeItem('pdfSessionId');
      localStorage.removeItem('pdfSessionData');
      localStorage.removeItem('pdfBlobUrl'); // Clear any PDF URL for text input
      localStorage.removeItem('currentPdfBlobUrl');

      setMindMapData(null);
      setNodes([]);
      setEdges([]);
      setNodePositions({});
      setCollapsedNodes(new Set());

      if (sourceUrl) {
        try { const url = new URL(sourceUrl); setFileName(`URL: ${url.hostname}${url.pathname}`); }
        catch (e) { setFileName(`URL: ${sourceUrl}`); }
      } else {
        setFileName(text.length > 60 ? `${text.substring(0, 60)}...` : text);
      }
      setPdfUrl(null);
      if (sourceUrl) localStorage.setItem('sourceUrl', sourceUrl); else localStorage.removeItem('sourceUrl');

      const response = await fetch('/api/papermap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ textInput: text, sourceUrl: sourceUrl, chatHistory: [] }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process text input');
      }
      const data = await response.json();
      setLoadingStage('saving');
      if (data && data.mindmap && typeof data.mindmap === 'object') {
        setMindMapData(data.mindmap);
        if (data.chatHistory) {
          try {
            const formattedChatHistory = data.chatHistory.map((msg: any) => ({ ...msg, role: msg.role === 'assistant' ? 'model' : msg.role }));
            localStorage.setItem('chatHistory', JSON.stringify(formattedChatHistory));
          } catch (storageError) { console.warn('Failed to store chat history:', storageError); }
        }
        if (data.mindmapId && sourceUrl) {
          fetch(`/api/papermap/proxy?url=${encodeURIComponent(sourceUrl)}&mindmapId=${encodeURIComponent(data.mindmapId)}`)
            .then(res => {
              if (!res.ok) {
                console.warn('Proxy Jina save failed:', res.status, res.statusText);
              }
            })
            .catch(err => {
              console.warn('Proxy Jina save error:', err);
            });
        }
      } else { throw new Error('Invalid mind map data received'); }
      setTimeout(() => {
        if (reactFlowInstanceRef.current) {
          reactFlowInstanceRef.current.fitView({ padding: 0.4, duration: 800, includeHiddenNodes: false });
        }
      }, 100);
      setLoading(false);
      setLoadingStage(null);
      return data; // Return full API response (with mindmapId)
    } catch (error) {
      console.error('Error handling text input:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to process text input';
      setUploadError(error instanceof Error ? error : new Error('Unknown error'));
      setError(errorMessage);
      setLoading(false);
      setLoadingStage(null);
      return null;
    }
  }, [setLoading, setLoadingStage, setError, setUploadError, setMindMapData, setNodes, setEdges,
    setNodePositions, setCollapsedNodes, setFileName, setPdfUrl, reactFlowInstanceRef]);

  // === STREAMING METHODS FOR PHASE 2 ===

  /**
   * Handle file upload with streaming - shows overview first, then progressively adds nodes
   */
  const handleFileUploadStreaming = useCallback(async (
    file: File,
    blobUrl?: string,
    originalFileName?: string,
    sourceUrl?: string
  ): Promise<{ mindmapId: string } | null> => {
    if (!file) return null;
    setLoading(true);
    setLoadingStage('uploading');
    setError(null);
    setUploadError(null);

    try {
      if (file.type !== 'application/pdf') throw new Error('Only PDF files are supported');

      // Clear stored data
      localStorage.removeItem('chatHistory');
      localStorage.removeItem('pdfSessionId');
      localStorage.removeItem('pdfSessionData');
      const existingPdfUrl = localStorage.getItem('pdfBlobUrl');
      if (existingPdfUrl?.includes('Steve_Jobs_Stanford_Commencement_Speech_2015.pdf')) {
        localStorage.removeItem('pdfBlobUrl');
      }
      try { localStorage.setItem('userHasUploadedPdf', 'true'); } catch { }

      // Upload to blob if needed
      let uploadedBlobUrl: string;
      if (!blobUrl) {
        const formData = new FormData();
        formData.append('file', file);
        const uploadRes = await fetch('/api/papermap/upload', {
          method: 'POST',
          body: formData,
        });
        if (!uploadRes.ok) {
          const errData = await uploadRes.json();
          throw new Error(errData.error || 'Failed to upload to Google Cloud Storage');
        }
        const blob = await uploadRes.json();
        if (!blob.url) throw new Error('No blob URL returned from upload');
        uploadedBlobUrl = blob.url;
      } else {
        uploadedBlobUrl = blobUrl;
      }

      localStorage.setItem('pdfBlobUrl', uploadedBlobUrl);
      localStorage.setItem('currentPdfBlobUrl', uploadedBlobUrl);
      setPdfUrl(uploadedBlobUrl);
      setFileName(originalFileName || file.name);

      // Clear existing mindmap data
      setMindMapData(null);
      setNodes([]);
      setEdges([]);
      setNodePositions({});
      setCollapsedNodes(new Set());

      setLoadingStage('analyzing');

      // Use streaming endpoint
      return await processStreamingResponse({
        blobUrl: uploadedBlobUrl,
        originalFileName: originalFileName || file.name,
        sourceUrl
      });
    } catch (error) {
      console.error('Error handling streaming file upload:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to process PDF';
      setUploadError(error instanceof Error ? error : new Error('Unknown upload error'));
      setError(errorMessage);
      setLoading(false);
      setLoadingStage(null);
      return null;
    }
  }, [setLoading, setLoadingStage, setError, setUploadError, setPdfUrl, setFileName,
    setMindMapData, setNodes, setEdges, setNodePositions, setCollapsedNodes, reactFlowInstanceRef]);

  /**
   * Handle text input with streaming - shows overview first, then progressively adds nodes
   */
  const handleTextInputStreaming = useCallback(async (
    text: string,
    sourceUrl?: string
  ): Promise<{ mindmapId: string } | null> => {
    setLoading(true);
    setLoadingStage('analyzing');
    setError(null);
    setUploadError(null);

    try {
      // Clear stored data
      localStorage.removeItem('chatHistory');
      localStorage.removeItem('pdfSessionId');
      localStorage.removeItem('pdfSessionData');
      localStorage.removeItem('pdfBlobUrl');
      localStorage.removeItem('currentPdfBlobUrl');

      setMindMapData(null);
      setNodes([]);
      setEdges([]);
      setNodePositions({});
      setCollapsedNodes(new Set());

      if (sourceUrl) {
        try {
          const url = new URL(sourceUrl);
          setFileName(`URL: ${url.hostname}${url.pathname}`);
        } catch {
          setFileName(`URL: ${sourceUrl}`);
        }
      } else {
        setFileName(text.length > 60 ? `${text.substring(0, 60)}...` : text);
      }
      setPdfUrl(null);
      if (sourceUrl) localStorage.setItem('sourceUrl', sourceUrl);
      else localStorage.removeItem('sourceUrl');

      // Use streaming endpoint
      return await processStreamingResponse({
        textInput: text,
        sourceUrl
      });
    } catch (error) {
      console.error('Error handling streaming text input:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to process text input';
      setUploadError(error instanceof Error ? error : new Error('Unknown error'));
      setError(errorMessage);
      setLoading(false);
      setLoadingStage(null);
      return null;
    }
  }, [setLoading, setLoadingStage, setError, setUploadError, setMindMapData, setNodes, setEdges,
    setNodePositions, setCollapsedNodes, setFileName, setPdfUrl, reactFlowInstanceRef]);

  /**
   * Process streaming response from the SSE endpoint
   */
  const processStreamingResponse = useCallback(async (params: {
    blobUrl?: string;
    textInput?: string;
    sourceUrl?: string;
    originalFileName?: string;
  }): Promise<{ mindmapId: string } | null> => {
    let mindmapId: string | null = null;

    try {
      const response = await fetch('/api/papermap/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      setLoadingStage('generating');

      // Read the SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE messages
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const message = JSON.parse(line.slice(6));

              switch (message.type) {
                case 'overview':
                  if (message.nodes && message.mindmapId) {
                    mindmapId = message.mindmapId;
                    setLoadingStage('building');
                    // Set initial mindmap data (overview only)
                    setMindMapData({ nodes: message.nodes });
                    // Fit view after initial render
                    setTimeout(() => {
                      if (reactFlowInstanceRef.current) {
                        reactFlowInstanceRef.current.fitView({ padding: 0.4, duration: 800, includeHiddenNodes: false });
                      }
                    }, 300);
                  }
                  break;

                case 'expansion':
                  if (message.nodes && message.nodes.length > 0) {
                    // Add expanded nodes to existing mindmap data
                    setMindMapData(prevData => {
                      if (!prevData) return { nodes: message.nodes, __nodeAddition: true };
                      return {
                        nodes: [...prevData.nodes, ...message.nodes],
                        __nodeAddition: true // Flag to indicate this is a node addition
                      };
                    });
                  }
                  break;

                case 'complete':
                  setLoading(false);
                  setLoadingStage(null);
                  break;

                case 'error':
                  throw new Error(message.error || 'Streaming error');
              }
            } catch (parseError) {
              console.error('Failed to parse SSE message:', line, parseError);
            }
          }
        }
      }

      return mindmapId ? { mindmapId } : null;
    } catch (error) {
      console.error('Streaming process error:', error);
      throw error;
    }
  }, [setMindMapData, setLoading, setLoadingStage, reactFlowInstanceRef]);

  // === PHASE 3: REAL-TIME STREAMING METHODS ===

  /**
   * Handle file upload with real-time streaming - nodes appear one by one
   */
  const handleFileUploadRealtime = useCallback(async (
    file: File,
    blobUrl?: string,
    originalFileName?: string,
    sourceUrl?: string
  ): Promise<{ mindmapId: string } | null> => {
    if (!file) return null;
    setLoading(true);
    setLoadingStage('uploading');
    setError(null);
    setUploadError(null);

    try {
      if (file.type !== 'application/pdf') throw new Error('Only PDF files are supported');

      // Clear stored data
      localStorage.removeItem('chatHistory');
      localStorage.removeItem('pdfSessionId');
      localStorage.removeItem('pdfSessionData');
      const existingPdfUrl = localStorage.getItem('pdfBlobUrl');
      if (existingPdfUrl?.includes('Steve_Jobs_Stanford_Commencement_Speech_2015.pdf')) {
        localStorage.removeItem('pdfBlobUrl');
      }
      try { localStorage.setItem('userHasUploadedPdf', 'true'); } catch { }

      // Upload to blob if needed
      let uploadedBlobUrl: string;
      if (!blobUrl) {
        const formData = new FormData();
        formData.append('file', file);
        const uploadRes = await fetch('/api/papermap/upload', {
          method: 'POST',
          body: formData,
        });
        if (!uploadRes.ok) {
          const errData = await uploadRes.json();
          throw new Error(errData.error || 'Failed to upload to Google Cloud Storage');
        }
        const blob = await uploadRes.json();
        if (!blob.url) throw new Error('No blob URL returned from upload');
        uploadedBlobUrl = blob.url;
      } else {
        uploadedBlobUrl = blobUrl;
      }

      localStorage.setItem('pdfBlobUrl', uploadedBlobUrl);
      localStorage.setItem('currentPdfBlobUrl', uploadedBlobUrl);
      setPdfUrl(uploadedBlobUrl);
      setFileName(originalFileName || file.name);

      // Clear existing mindmap data
      setMindMapData(null);
      setNodes([]);
      setEdges([]);
      setNodePositions({});
      setCollapsedNodes(new Set());

      setLoadingStage('analyzing');

      // Use real-time streaming endpoint
      return await processRealtimeStreamingResponse({
        blobUrl: uploadedBlobUrl,
        originalFileName: originalFileName || file.name,
        sourceUrl
      });
    } catch (error) {
      console.error('Error handling realtime file upload:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to process PDF';
      setUploadError(error instanceof Error ? error : new Error('Unknown upload error'));
      setError(errorMessage);
      setLoading(false);
      setLoadingStage(null);
      return null;
    }
  }, [setLoading, setLoadingStage, setError, setUploadError, setPdfUrl, setFileName,
    setMindMapData, setNodes, setEdges, setNodePositions, setCollapsedNodes, reactFlowInstanceRef]);

  /**
   * Handle text input with real-time streaming - nodes appear one by one
   */
  const handleTextInputRealtime = useCallback(async (
    text: string,
    sourceUrl?: string
  ): Promise<{ mindmapId: string } | null> => {
    setLoading(true);
    setLoadingStage('analyzing');
    setError(null);
    setUploadError(null);

    try {
      // Clear stored data
      localStorage.removeItem('chatHistory');
      localStorage.removeItem('pdfSessionId');
      localStorage.removeItem('pdfSessionData');
      localStorage.removeItem('pdfBlobUrl');
      localStorage.removeItem('currentPdfBlobUrl');

      setMindMapData(null);
      setNodes([]);
      setEdges([]);
      setNodePositions({});
      setCollapsedNodes(new Set());

      if (sourceUrl) {
        try {
          const url = new URL(sourceUrl);
          setFileName(`URL: ${url.hostname}${url.pathname}`);
        } catch {
          setFileName(`URL: ${sourceUrl}`);
        }
      } else {
        setFileName(text.length > 60 ? `${text.substring(0, 60)}...` : text);
      }
      setPdfUrl(null);
      if (sourceUrl) localStorage.setItem('sourceUrl', sourceUrl);
      else localStorage.removeItem('sourceUrl');

      // Use real-time streaming endpoint
      return await processRealtimeStreamingResponse({
        textInput: text,
        sourceUrl
      });
    } catch (error) {
      console.error('Error handling realtime text input:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to process text input';
      setUploadError(error instanceof Error ? error : new Error('Unknown error'));
      setError(errorMessage);
      setLoading(false);
      setLoadingStage(null);
      return null;
    }
  }, [setLoading, setLoadingStage, setError, setUploadError, setMindMapData, setNodes, setEdges,
    setNodePositions, setCollapsedNodes, setFileName, setPdfUrl, reactFlowInstanceRef]);

  /**
   * Process real-time streaming response from the NDJSON endpoint
   * Returns mindmapId IMMEDIATELY when available, allowing instant redirect
   * Streaming continues in background via callback
   */
  const processRealtimeStreamingResponse = useCallback(async (params: {
    blobUrl?: string;
    textInput?: string;
    sourceUrl?: string;
    originalFileName?: string;
  }): Promise<{ mindmapId: string } | null> => {
    try {
      const response = await fetch('/api/papermap/stream-realtime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      setLoadingStage('generating');

      // Read the SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let mindmapId: string | null = null;

      // Process stream until we get the mindmapId, then return immediately
      // Continue processing in background
      return await new Promise<{ mindmapId: string } | null>((resolve, rejected) => {
        let resolved = false;
        let isFirstNode = true;

        const processStream = async () => {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });

              // Process complete SSE messages
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';

              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  try {
                    const message = JSON.parse(line.slice(6));

                    switch (message.type) {
                      case 'init':
                        if (message.mindmapId) {
                          mindmapId = message.mindmapId;
                          setLoadingStage('building');

                          // IMMEDIATELY resolve with mindmapId - don't wait for streaming to complete
                          if (!resolved) {
                            resolved = true;
                            resolve({ mindmapId: message.mindmapId });
                          }
                        }
                        break;

                      case 'node':
                        if (message.node) {
                          // Update mindmap data with the new node
                          setMindMapData(prevData => {
                            const newNodes = prevData ? [...prevData.nodes, message.node] : [message.node];
                            return {
                              nodes: newNodes,
                              __realtimeAddition: true
                            };
                          });

                          // Fit view after first node
                          if (isFirstNode) {
                            isFirstNode = false;
                            setTimeout(() => {
                              if (reactFlowInstanceRef.current) {
                                reactFlowInstanceRef.current.fitView({
                                  padding: 0.5,
                                  duration: 500,
                                  includeHiddenNodes: false
                                });
                              }
                            }, 200);
                          }
                        }
                        break;

                      case 'complete':
                        setLoading(false);
                        setLoadingStage(null);
                        setTimeout(() => {
                          if (reactFlowInstanceRef.current) {
                            reactFlowInstanceRef.current.fitView({
                              padding: 0.4,
                              duration: 800,
                              includeHiddenNodes: false
                            });
                          }
                        }, 300);
                        break;

                      case 'error':
                        if (!resolved) {
                          resolved = true;
                          rejected(new Error(message.error || 'Streaming error'));
                        }
                        break;
                    }
                  } catch (parseError) {
                    console.error('Failed to parse SSE message:', line, parseError);
                  }
                }
              }
            }

            // If stream ended without getting mindmapId
            if (!resolved) {
              resolve(null);
            }
          } catch (error) {
            if (!resolved) {
              rejected(error);
            }
          }
        };

        processStream();
      });
    } catch (error) {
      console.error('Realtime streaming process error:', error);
      throw error;
    }
  }, [setMindMapData, setLoading, setLoadingStage, reactFlowInstanceRef]);

  return {
    loadExampleMindMap,
    handleFileUpload,
    handleTextInput,
    handleFileUploadStreaming,
    handleTextInputStreaming,
    handleFileUploadRealtime,
    handleTextInputRealtime,
    generateInitialMindMap,
  };
}
