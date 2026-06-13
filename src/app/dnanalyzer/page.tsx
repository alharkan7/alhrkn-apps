'use client'

import React, { useRef } from 'react'
import TextFileList from './components/TextFileList'
import TextDisplay from './components/TextDisplay'
import ResultsSheet from './components/ResultsSheet'
import SettingsDialog from './components/SettingsDialog'
import { Button } from '@/components/ui/button'
import { Download, Save, Eye, EyeOff, Plus, LayoutGrid } from 'lucide-react'
import { AppsGrid } from '@/components/ui/apps-grid'
import AppsFooter from '@/components/apps-footer'
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
  } = useAnalyzerFunctions()

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 max-w-6xl">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">Automatic Discourse Identifier</h1>
              <p className="text-muted-foreground">Identify Discourse Data using AI for Discourse Network Analysis</p>
            </div>
            <div className="flex items-center">
              <AppsGrid
                trigger={
                  <Button
                    variant="default"
                    className="flex items-center px-3 h-fit"
                  >
                    <LayoutGrid size={14} /> Apps
                  </Button>
                }
                useHardReload={false}
              />
            </div>
          </div>

          {/* Save/Load Status Message */}
          {saveStatus !== 'idle' && saveMessage && (
            <div className={`mt-4 p-3 rounded-lg ${saveStatus === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {saveMessage}
            </div>
          )}

          {/* Button Bar */}
          <div className="flex items-center gap-1 mt-4">
            <Button
              onClick={handleSaveToDatabase}
              disabled={saving || !hasConfig}
              variant="secondary"
              className="flex items-center gap-0 sm:gap-2"
            >
              <Save className="w-4 h-4" />
              <span className="hidden sm:inline">
                {saving ? 'Saving...' : 'Save'}
              </span>
            </Button>

            <Button
              onClick={handleLoadData}
              disabled={loadingData || !hasConfig}
              variant="secondary"
              className="flex items-center gap-0 sm:gap-2"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">
                {loadingData ? 'Loading...' : 'Load'}
              </span>
            </Button>

            <Button
              onClick={() => textFileListRef.current?.triggerAddFile()}
              variant="secondary"
              className="flex items-center gap-0 sm:gap-2"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add</span>
            </Button>

            <Button
              onClick={() => setShowResults(!showResults)}
              variant="secondary"
              className="flex items-center gap-0 sm:gap-2"
            >
              {showResults ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              <span className="hidden sm:inline">
                {showResults ? 'Hide' : 'Data'}
              </span>
            </Button>

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

        {/* Text Files List - Top */}
        <div className="mb-6">
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

        {/* Text Display - Middle */}
        <div className="mb-6">
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
      <div className="flex-none mb-1">
        <AppsFooter />
      </div>
    </div>
  )
}
