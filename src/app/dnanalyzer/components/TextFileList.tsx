'use client'

import { useState, forwardRef, useImperativeHandle, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Play, Loader2, Check, Trash2 } from 'lucide-react'

interface TextFile {
  id: string
  title: string
  content: string
  processed?: boolean
  isLoaded?: boolean
}

interface TextFileListProps {
  files: TextFile[]
  selectedFileId: string | null
  onFileSelect: (fileId: string) => void
  onAddFile: (title: string, content: string) => void
  onBulkAnalyze: () => void
  onDeleteFile: (fileId: string) => void
  loading: boolean
}

function useScreenSize() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768) // md breakpoint
    }

    checkScreenSize()
    window.addEventListener('resize', checkScreenSize)
    return () => window.removeEventListener('resize', checkScreenSize)
  }, [])

  return isMobile
}

function truncateText(text: string, isMobile: boolean): string {
  const maxLength = isMobile ? 120 : 200 // Shorter on mobile, longer on desktop
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength).trim() + '...'
}

const TextFileList = forwardRef<{ triggerAddFile: () => void }, TextFileListProps>(
  ({ files, selectedFileId, onFileSelect, onAddFile, onBulkAnalyze, onDeleteFile, loading }, ref) => {
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
    const [fileToDelete, setFileToDelete] = useState<TextFile | null>(null)
    const [newTitle, setNewTitle] = useState('')
    const [newContent, setNewContent] = useState('')
    const isMobile = useScreenSize()

    useImperativeHandle(ref, () => ({
      triggerAddFile: () => setIsDialogOpen(true)
    }))

    const handleAddFile = () => {
      if (newTitle.trim() && newContent.trim()) {
        onAddFile(newTitle.trim(), newContent.trim())
        setNewTitle('')
        setNewContent('')
        setIsDialogOpen(false)
      }
    }

    const handleDialogClose = () => {
      setIsDialogOpen(false)
      setNewTitle('')
      setNewContent('')
    }

    const handleDeleteClick = (file: TextFile) => {
      setFileToDelete(file)
      setIsDeleteDialogOpen(true)
    }

    const handleDeleteConfirm = () => {
      if (fileToDelete) {
        onDeleteFile(fileToDelete.id)
        setIsDeleteDialogOpen(false)
        setFileToDelete(null)
      }
    }

    const handleDeleteCancel = () => {
      setIsDeleteDialogOpen(false)
      setFileToDelete(null)
    }

  const unprocessedCount = files.filter(file => !file.processed).length
  const hasUnprocessedFiles = unprocessedCount > 0

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Text Sources</CardTitle>
            <CardDescription>
              Select a text source to analyze discourse
            </CardDescription>
          </div>
          <Button
            onClick={onBulkAnalyze}
            disabled={loading || !hasUnprocessedFiles}
            size="sm"
            variant="secondary"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Play />
                Analyze ({unprocessedCount})
              </>
            )}
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Add New Text Source</DialogTitle>
                <DialogDescription>
                  Enter a title and paste or type your text content. This could be a news article, blog post, or any textual content you want to analyze.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    placeholder="e.g., Climate Policy Article"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="content">Content</Label>
                  <Textarea
                    id="content"
                    placeholder="Paste your text here... (news articles, blog posts, etc.)"
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    className="min-h-[200px] resize-none"
                  />
                  <div className="text-sm text-muted-foreground">
                    {newContent.split(' ').filter(word => word.length > 0).length} words
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="secondary" onClick={handleDialogClose}>
                  Cancel
                </Button>
                <Button variant="secondary" onClick={handleAddFile} disabled={!newTitle.trim() || !newContent.trim()}>
                  Add Source
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Delete Confirmation Dialog */}
          <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Delete Document</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete "{fileToDelete?.title}"? This action cannot be undone and will also remove all associated statements from the database.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="secondary" onClick={handleDeleteCancel}>
                  Cancel
                </Button>
                <Button variant="secondary" className="bg-red-600 text-white hover:bg-red-700" onClick={handleDeleteConfirm}>
                  Delete
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {files.length === 0 ? (
          <div className="text-center py-8">
            <p className="mb-4">No text sources added yet</p>
            <p className="text-sm">Click "Add Source" to get started</p>
          </div>
        ) : (
          <div className="max-h-[400px] overflow-y-auto">
            <div className="space-y-3 pr-2">
              {[...files].reverse().map((file) => (
                <div
                  key={file.id}
                  className={`p-4 border rounded-lg bg-white cursor-pointer transition-colors ${
                    selectedFileId === file.id
                      ? 'border-accent bg-accent/20 shadow-sm ring-1 ring-accent/30'
                      : 'border-border hover:border-accent/70 hover:bg-accent/10'
                  }`}
                  onClick={() => onFileSelect(file.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <h3 className="font-medium text-foreground truncate">
                            {file.title}
                          </h3>
                          {file.processed && (
                            <Badge variant="default" className="text-xs rounded-full">
                              <Check className="h-3 w-3" />
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground ml-2 flex-shrink-0 flex items-center gap-1">
                          {file.content.split(' ').filter(word => word.length > 0).length} words
                          <Trash2
                            className="h-3 w-3 cursor-pointer hover:text-red-600 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteClick(file)
                            }}
                          />
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed line-clamp-1">
                        {truncateText(file.content, isMobile)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
})

TextFileList.displayName = 'TextFileList'

export default TextFileList

