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
import { cn } from '@/lib/utils'

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
  variant?: 'panel' | 'sidebar'
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
  ({ files, selectedFileId, onFileSelect, onAddFile, onBulkAnalyze, onDeleteFile, loading, variant = 'panel' }, ref) => {
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
    <Card className={cn(
      'h-full bg-white/82 backdrop-blur-xl dark:bg-[#191917]/84',
      variant === 'sidebar'
        ? 'rounded-none border-0 shadow-none'
        : 'rounded-2xl border-black/[0.07] shadow-[0_8px_28px_rgba(25,25,24,0.055)] dark:border-white/[0.08] dark:shadow-[0_10px_32px_rgba(0,0,0,0.24)]',
    )}>
      <CardHeader className={cn(
        'border-b border-black/[0.055] px-4 py-4 dark:border-white/[0.07]',
        variant === 'sidebar' && 'pr-12 pt-5',
      )}>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold tracking-[-0.02em]">Text sources</CardTitle>
            <CardDescription className="mt-1 text-xs">
              {files.length} {files.length === 1 ? 'source' : 'sources'} · {unprocessedCount} pending
            </CardDescription>
          </div>
          <Button
            onClick={onBulkAnalyze}
            disabled={loading || !hasUnprocessedFiles}
            size="sm"
            variant="default"
            className="h-9 rounded-xl bg-[#191918] px-3 text-white shadow-none hover:bg-black disabled:opacity-30 dark:bg-[#f2f2ef] dark:text-[#191918] dark:hover:bg-white"
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Play className="size-4" />
                <span className="hidden sm:inline">Analyze</span> ({unprocessedCount})
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
      <CardContent className="p-3">
        {files.length === 0 ? (
          <div className="rounded-xl border border-dashed border-black/12 px-5 py-10 text-center dark:border-white/12">
            <p className="font-medium">No text sources</p>
            <p className="mt-1 text-sm text-black/42 dark:text-white/42">Use Add in the toolbar to begin.</p>
          </div>
        ) : (
          <div className={cn('overflow-y-auto scrollbar-thin', variant === 'sidebar' ? 'max-h-[calc(100dvh-9.5rem)]' : 'max-h-[calc(100dvh-15rem)]')}>
            <div className="space-y-1 pr-1">
              {[...files].reverse().map((file) => (
                <div
                  key={file.id}
                  className={`cursor-pointer rounded-xl border p-3 transition-colors ${
                    selectedFileId === file.id
                      ? 'border-black/[0.09] bg-black/[0.07] dark:border-white/[0.11] dark:bg-white/[0.1]'
                      : 'border-transparent bg-transparent hover:bg-black/[0.035] dark:hover:bg-white/[0.045]'
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
                            <Badge variant="neutral" className="size-5 rounded-full border-black/[0.09] bg-black/[0.045] p-0 text-black/45 dark:border-white/[0.1] dark:bg-white/[0.07] dark:text-white/45">
                              <Check className="size-3" />
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground ml-2 flex-shrink-0 flex items-center gap-1">
                          {file.content.split(' ').filter(word => word.length > 0).length} words
                          <Trash2
                            className="size-3 cursor-pointer transition-colors hover:text-red-600"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteClick(file)
                            }}
                          />
                        </div>
                      </div>
                      <p className="line-clamp-1 text-xs leading-relaxed text-black/42 dark:text-white/42">
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
