import React, { memo } from 'react';
import dynamic from 'next/dynamic';
import { usePdfViewerContext } from '../context';

// Dynamically import react-pdf with SSR disabled
const PDFViewer = dynamic(
  () => import('./PDFViewerClient'),
  { ssr: false }
);

// Memoize the component to prevent unnecessary re-renders
const PdfViewer = memo(() => {
  const { 
    pdfBase64, 
    pdfUrl, 
    isPdfViewerOpen, 
    closePdfViewer, 
    currentPdfPage,
    setPdfBase64
  } = usePdfViewerContext();
  
  // Simply pass props to the dynamically loaded component
  if (!isPdfViewerOpen) return null;
  
  // Ensure initialPage is a valid positive number
  const validatedInitialPage = currentPdfPage && currentPdfPage > 0 ? currentPdfPage : 1;
  
  // If we have pdfBase64, it takes precedence over pdfUrl
  return <PDFViewer 
    pdfBase64={pdfBase64} 
    pdfUrl={pdfUrl}
    setPdfBase64={setPdfBase64}
    isOpen={isPdfViewerOpen} 
    onClose={closePdfViewer} 
    initialPage={validatedInitialPage} 
  />;
});

// Add display name for React DevTools
PdfViewer.displayName = 'PdfViewer';

export default PdfViewer; 