'use client'

import React, { useRef } from 'react'
import TextFileList from './components/TextFileList'
import TextDisplay from './components/TextDisplay'
import ResultsSheet from './components/ResultsSheet'
import SettingsDialog from './components/SettingsDialog'
import { Button } from '@/components/ui/button'
import { Download, Save, Eye, EyeOff, Plus, LayoutGrid, X } from 'lucide-react'
import { AppsGrid } from '@/components/ui/apps-grid'
import AppsFooter from '@/components/apps-footer'
import { AppsHeader } from '@/components/apps-header'
import { useAnalyzerFunctions } from './hooks/useAnalyzerFunctions'

export default function DNAnalyzerPage() {
  const textFileListRef = useRef<any>(null)
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
    <div className="flex flex-col h-[100dvh] bg-background text-foreground overflow-hidden relative font-sans">
      {/* --- Ambient Background --- */}
      <div className="fixed inset-0 w-screen h-screen z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/10 dark:bg-indigo-900/20 blur-[120px] mix-blend-screen animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-blue-500/10 dark:bg-blue-900/20 blur-[150px] mix-blend-screen animate-pulse" style={{ animationDuration: '12s', animationDelay: '2s' }} />
        <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] rounded-full bg-cyan-500/10 dark:bg-cyan-900/10 blur-[100px] mix-blend-screen animate-pulse" style={{ animationDuration: '10s', animationDelay: '4s' }} />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px]"></div>
      </div>

      {/* --- Top Navigation --- */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-background/60 backdrop-blur-xl border-b">
        <AppsHeader 
            title={<><span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 via-cyan-500 to-emerald-500 animate-gradient-x font-bold">Discourse</span> <span className="font-bold">Analyzer</span></>}
        />
      </div>

      <div className="relative z-10 flex-1 overflow-y-auto scrollbar-thin overflow-x-hidden pt-20 pb-12 px-2 md:px-4">
        <div className="w-full max-w-6xl mx-auto">
          
          {/* Action Toolbar */}
          <div className="flex items-center gap-2 mb-6 p-2 bg-muted/20 rounded-[1.25rem] border border-border shadow-sm backdrop-blur-sm overflow-x-auto scrollbar-none w-full">
              <Button
                  onClick={handleSaveToDatabase}
                  disabled={saving || !hasConfig}
                  variant="secondary"
                  size="sm"
                  className="rounded-full shadow-sm flex-shrink-0"
              >
                  <Save className="w-4 h-4" />
                  <span className="hidden sm:inline ml-2">
                  {saving ? 'Saving...' : 'Save'}
                  </span>
              </Button>
              <Button
                  onClick={handleLoadData}
                  disabled={loadingData || !hasConfig}
                  variant="secondary"
                  size="sm"
                  className="rounded-full shadow-sm flex-shrink-0"
              >
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline ml-2">
                  {loadingData ? 'Loading...' : 'Load'}
                  </span>
              </Button>
              <Button
                  onClick={() => textFileListRef.current?.triggerAddFile()}
                  variant="secondary"
                  size="sm"
                  className="rounded-full shadow-sm flex-shrink-0"
              >
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline ml-2">Add</span>
              </Button>
              <Button
                  onClick={() => setShowResults(!showResults)}
                  variant="secondary"
                  size="sm"
                  className="rounded-full shadow-sm flex-shrink-0"
              >
                  {showResults ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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

          {/* Save/Load Status Message */}
          {saveStatus !== 'idle' && saveMessage && (
            <div className={`mb-6 p-4 rounded-[1rem] flex items-center justify-between shadow-sm backdrop-blur-sm border ${saveStatus === 'success' ? 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20'}`}>
              <div className="flex-1 font-medium">{saveMessage}</div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 rounded-full hover:bg-black/5 dark:hover:bg-white/10" 
                onClick={() => setSaveStatus('idle')}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
            {/* Text Files List - Sidebar */}
            <div className="lg:col-span-4">
          <TextFileList
            ref={textFileListRef}
            files={files}
            selectedFileId={selectedFileId}
            onFileSelect={handleFileSelect}
            onAddFile={handleAddFile}
            onBulkAnalyze={handleBulkAnalyze}
            onDeleteFile={handleDeleteFile}
            loading={loading}
          />
        </div>

        {/* Text Display - Main Content */}
        <div className="lg:col-span-8">
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
          </div>
        </div>
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

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 py-1 px-0 text-center text-gray-600 text-xs bg-background/60 backdrop-blur-md z-50">
        <div className="flex-none">
          <AppsFooter />
        </div>
      </div>
    </div>
  )
}
