'use client'

import React, { useRef, useState } from 'react'
import TextFileList from './components/TextFileList'
import TextDisplay from './components/TextDisplay'
import ResultsSheet from './components/ResultsSheet'
import SettingsDialog from './components/SettingsDialog'
import { Button } from '@/components/ui/button'
import { ChevronLeft, Download, Save, Eye, EyeOff, Menu, Plus, X } from 'lucide-react'
import AppsFooter from '@/components/apps-footer'
import { AppsHeader } from '@/components/apps-header'
import { useAnalyzerFunctions } from './hooks/useAnalyzerFunctions'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

export default function DNAnalyzerPage() {
  const textFileListRef = useRef<any>(null)
  const prefersReducedMotion = useReducedMotion()
  const [isSourcesOpen, setIsSourcesOpen] = useState(false)
  const {
    // State
    files,
    selectedFileId,
    selectedFile,
    allStatements,
    loading,
    error,
    saving,
    saveStatus,
    saveMessage,
    loadingData,
    showResults,
    filteredFileId,
    processedFilesCount,

    // Configuration
    mysqlConfig,
    setMysqlConfig,
    googleApiKey,
    setGoogleApiKey,
    isConfigDialogOpen,
    setIsConfigDialogOpen,
    savingConfig,
    hasConfig,
    showMySQLPassword,
    setShowMySQLPassword,
    showApiKey,
    setShowApiKey,

    // Handlers
    handleFileSelect,
    handleAddFile,
    handleDeleteFile,
    handleAnalyze,
    handleBulkAnalyze,
    handleUpdateStatement,
    handleDeleteStatement,
    handleAddManualStatement,
    handleToggleFilteredResults,
    handleUpdateContent,
    handleSaveToDatabase,
    handleLoadData,
    saveUserConfig,
    setShowResults,
    setSaveStatus,
  } = useAnalyzerFunctions()

  return (
    <div className="relative flex h-[100dvh] flex-col overflow-hidden bg-[#f3f3f0] font-sans text-[#191918] dark:bg-[#10100f] dark:text-[#f2f2ef]">
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_55%_0%,rgba(255,255,255,0.96),rgba(243,243,240,0.74)_48%,rgba(237,237,233,0.86)_100%)] dark:bg-[radial-gradient(circle_at_55%_0%,rgba(35,35,32,0.72),rgba(16,16,15,1)_58%)]" />
        <div className="absolute inset-0 opacity-[0.2] [background-image:radial-gradient(rgba(25,25,24,0.17)_0.7px,transparent_0.7px)] [background-size:18px_18px] dark:opacity-[0.08] dark:[background-image:radial-gradient(rgba(255,255,255,0.35)_0.7px,transparent_0.7px)]" />
        <motion.div
          className="absolute left-[58%] top-16 size-72 rounded-full bg-blue-400/[0.035] blur-3xl dark:bg-blue-500/[0.045]"
          animate={prefersReducedMotion ? undefined : { opacity: [0.25, 0.45, 0.25], scale: [1, 1.05, 1] }}
          transition={prefersReducedMotion ? undefined : { duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <AnimatePresence>
        {isSourcesOpen && (
          <motion.button
            type="button"
            aria-label="Close text sources"
            className="fixed inset-0 z-[54] cursor-default bg-black/15 backdrop-blur-[2px]"
            initial={prefersReducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setIsSourcesOpen(false)}
          />
        )}
      </AnimatePresence>
      <motion.aside
        className={`fixed left-0 top-0 z-[55] h-full w-[min(22rem,calc(100vw-2rem))] overflow-hidden border-r border-black/[0.07] bg-white shadow-[16px_0_48px_rgba(25,25,24,0.1)] dark:border-white/[0.08] dark:bg-[#191917] dark:shadow-[16px_0_54px_rgba(0,0,0,0.34)] ${isSourcesOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
        initial={false}
        animate={{ x: isSourcesOpen ? 0 : '-100%' }}
        transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        aria-hidden={!isSourcesOpen}
      >
        <Button type="button" variant="ghost" size="icon" className="absolute right-3 top-3 z-10 size-8 rounded-lg text-black/45 hover:bg-black/[0.06] hover:text-black dark:text-white/45 dark:hover:bg-white/[0.07] dark:hover:text-white" onClick={() => setIsSourcesOpen(false)} aria-label="Close text sources">
          <ChevronLeft size={16} />
        </Button>
        <TextFileList
          ref={textFileListRef}
          files={files}
          selectedFileId={selectedFileId}
          onFileSelect={(fileId) => {
            handleFileSelect(fileId)
            setIsSourcesOpen(false)
          }}
          onAddFile={handleAddFile}
          onBulkAnalyze={handleBulkAnalyze}
          onDeleteFile={handleDeleteFile}
          loading={loading}
          variant="sidebar"
        />
      </motion.aside>

      <div className="fixed left-0 right-0 top-0 z-50 border-b border-black/[0.06] bg-[#f3f3f0]/82 backdrop-blur-xl dark:border-white/[0.08] dark:bg-[#10100f]/82">
        <AppsHeader
          leftButton={
            <Button type="button" variant="ghost" size="icon" className="size-9 rounded-xl text-black/60 hover:bg-black/[0.06] hover:text-black dark:text-white/60 dark:hover:bg-white/[0.08] dark:hover:text-white" onClick={() => setIsSourcesOpen(true)} aria-label="Open text sources">
              <Menu size={18} />
            </Button>
          }
          title={<span className="text-sm font-semibold tracking-[-0.01em]">Discourse Analyzer</span>}
        />
      </div>

      <div className="relative z-10 flex-1 overflow-x-hidden overflow-y-auto px-2 pb-14 pt-[4.5rem] scrollbar-thin md:px-4">
        <motion.div initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }} className="mx-auto w-full max-w-6xl">
          
          <div className="mb-4 flex w-full items-center gap-1.5 overflow-x-auto rounded-2xl border border-black/[0.065] bg-white/72 p-1.5 shadow-[0_2px_10px_rgba(25,25,24,0.035)] backdrop-blur-xl scrollbar-none dark:border-white/[0.08] dark:bg-[#1a1a18]/78">
              <Button
                  onClick={handleSaveToDatabase}
                  disabled={saving || !hasConfig}
                  variant="secondary"
                  size="sm"
                  className="h-9 flex-shrink-0 rounded-xl border border-transparent bg-transparent px-3 text-black/55 shadow-none hover:bg-black/[0.055] hover:text-black dark:text-white/55 dark:hover:bg-white/[0.07] dark:hover:text-white"
              >
                  <Save className="size-4" />
                  <span className="hidden sm:inline ml-2">
                  {saving ? 'Saving...' : 'Save'}
                  </span>
              </Button>
              <Button
                  onClick={handleLoadData}
                  disabled={loadingData || !hasConfig}
                  variant="secondary"
                  size="sm"
                  className="h-9 flex-shrink-0 rounded-xl border border-transparent bg-transparent px-3 text-black/55 shadow-none hover:bg-black/[0.055] hover:text-black dark:text-white/55 dark:hover:bg-white/[0.07] dark:hover:text-white"
              >
                  <Download className="size-4" />
                  <span className="hidden sm:inline ml-2">
                  {loadingData ? 'Loading...' : 'Load'}
                  </span>
              </Button>
              <Button
                  onClick={() => textFileListRef.current?.triggerAddFile()}
                  variant="secondary"
                  size="sm"
                  className="h-9 flex-shrink-0 rounded-xl border border-transparent bg-transparent px-3 text-black/55 shadow-none hover:bg-black/[0.055] hover:text-black dark:text-white/55 dark:hover:bg-white/[0.07] dark:hover:text-white"
              >
                  <Plus className="size-4" />
                  <span className="hidden sm:inline ml-2">Add</span>
              </Button>
              <Button
                  onClick={() => setShowResults(!showResults)}
                  variant="secondary"
                  size="sm"
                  className={`h-9 flex-shrink-0 rounded-xl border px-3 shadow-none ${showResults ? 'border-black/[0.08] bg-black/[0.075] text-black hover:bg-black/[0.1] dark:border-white/[0.1] dark:bg-white/[0.1] dark:text-white dark:hover:bg-white/[0.14]' : 'border-transparent bg-transparent text-black/55 hover:bg-black/[0.055] hover:text-black dark:text-white/55 dark:hover:bg-white/[0.07] dark:hover:text-white'}`}
              >
                  {showResults ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  <span className="hidden sm:inline ml-2">
                  {showResults ? 'Hide' : 'Data'}
                  </span>
              </Button>
              <div className="ml-auto flex-shrink-0">
                <SettingsDialog
                    isOpen={isConfigDialogOpen}
                    onOpenChange={setIsConfigDialogOpen}
                    mysqlConfig={mysqlConfig}
                    setMysqlConfig={setMysqlConfig}
                    googleApiKey={googleApiKey}
                    setGoogleApiKey={setGoogleApiKey}
                    showMySQLPassword={showMySQLPassword}
                    setShowMySQLPassword={setShowMySQLPassword}
                    showApiKey={showApiKey}
                    setShowApiKey={setShowApiKey}
                    savingConfig={savingConfig}
                    onSaveConfig={saveUserConfig}
                />
              </div>
          </div>

          {saveStatus !== 'idle' && saveMessage && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className={`mb-4 flex items-center justify-between rounded-xl border px-4 py-3 text-sm ${saveStatus === 'success' ? 'border-emerald-500/15 bg-emerald-500/[0.06] text-emerald-700 dark:text-emerald-400' : 'border-red-500/15 bg-red-500/[0.06] text-red-700 dark:text-red-400'}`}>
              <div className="flex-1 font-medium">{saveMessage}</div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="size-8 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"
                onClick={() => setSaveStatus('idle')}
              >
                <X className="h-4 w-4" />
              </Button>
            </motion.div>
          )}

          <div className="mb-8">
            <TextDisplay
              selectedFile={selectedFile}
              statements={allStatements}
              onAnalyze={handleAnalyze}
              onUpdateContent={handleUpdateContent}
              onAddManualStatement={handleAddManualStatement}
              onUpdateStatement={handleUpdateStatement}
              onDeleteStatement={handleDeleteStatement}
              onToggleFilteredResults={handleToggleFilteredResults}
              isFilteredForFile={filteredFileId === selectedFileId}
              loading={loading}
              error={error}
            />
          </div>
        </motion.div>
      </div>

      {/* Results Sheet - Right Side */}
      <ResultsSheet
        statements={allStatements}
        onUpdateStatement={handleUpdateStatement}
        totalFiles={files.length}
        processedFiles={processedFilesCount}
        open={showResults}
        onOpenChange={setShowResults}
        filterSourceFile={filteredFileId ? files.find(f => f.id === filteredFileId)?.title || null : null}
      />

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-black/[0.045] bg-[#f3f3f0]/75 py-1 text-center text-xs text-black/45 backdrop-blur-lg dark:border-white/[0.06] dark:bg-[#10100f]/75 dark:text-white/40">
        <div className="flex-none">
          <AppsFooter />
        </div>
      </div>
    </div>
  )
}
