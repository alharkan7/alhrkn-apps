'use client'

import { useState, useRef } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Eye } from 'lucide-react'

interface Statement {
  statement: string
  concept: string
  actor: string
  organization: string
  agree: boolean
  sourceFile?: string // Track which file this statement came from
  isLoaded?: boolean // true if loaded from DB, false if newly analyzed
  isModified?: boolean // true if statement has been edited
  originalStatementId?: number // Original DB statement ID for updates
}

interface EditableCellProps {
  value: string
  onSave: (newValue: string) => void
  className?: string
}

function EditableCell({ value, onSave, className = "" }: EditableCellProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(value)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleDoubleClick = () => {
    setIsEditing(true)
    setEditValue(value)
    setTimeout(() => {
      textareaRef.current?.focus()
      textareaRef.current?.select()
    }, 0)
  }

  const handleSave = () => {
    onSave(editValue)
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditValue(value)
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      handleSave()
    } else if (e.key === 'Escape') {
      handleCancel()
    }
  }

  if (isEditing) {
    return (
      <textarea
        ref={textareaRef}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        rows={3}
        className="w-full px-2 py-1 text-sm border border-ring rounded focus:outline-none focus:ring-2 focus:ring-ring resize-none min-h-[2.5rem]"
      />
    )
  }

  return (
    <div
      className={`text-sm cursor-pointer hover:bg-muted px-2 py-1 rounded min-h-[2rem] flex items-center ${
        !value.trim() ? 'bg-muted/50 border border-dashed border-muted-foreground/30' : ''
      } ${className}`}
      onDoubleClick={handleDoubleClick}
      title="Double-click to edit"
    >
      {value.trim() ? (
        value
      ) : (
        <span className="text-muted-foreground italic">Click to edit</span>
      )}
    </div>
  )
}

interface ResultsSheetProps {
  statements: Statement[]
  onUpdateStatement: (index: number, updatedStatement: Statement) => void
  totalFiles: number
  processedFiles: number
  open: boolean
  onOpenChange: (open: boolean) => void
  filterSourceFile?: string | null
}

export default function ResultsSheet({
  statements,
  onUpdateStatement,
  totalFiles,
  processedFiles,
  open,
  onOpenChange,
  filterSourceFile
}: ResultsSheetProps) {
  // Filter statements based on the filterSourceFile prop
  const filteredStatements = filterSourceFile
    ? statements.filter(stmt => stmt.sourceFile === filterSourceFile)
    : statements
  const handleCellEdit = (rowIndex: number, field: 'statement' | 'concept' | 'actor' | 'organization' | 'agree', newValue: string) => {
    const currentStatement = filteredStatements[rowIndex]
    if (!currentStatement) return

    // Find the actual index in the original statements array
    const actualIndex = statements.findIndex(stmt => stmt === currentStatement)
    if (actualIndex === -1) return

    const updatedStatement = {
      ...currentStatement,
      [field]: field === 'agree' ? (newValue === 'TRUE') : newValue,
      isModified: true
    }

    onUpdateStatement(actualIndex, updatedStatement)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto border-l border-black/[0.07] bg-[#f7f7f5] px-4 shadow-2xl dark:border-white/[0.08] dark:bg-[#151513] sm:max-w-4xl sm:px-6">
        <SheetHeader>
          <SheetTitle className="text-lg font-semibold tracking-[-0.02em]">{filterSourceFile ? `${filterSourceFile}` : 'Discourse results'}</SheetTitle>
          <SheetDescription className="text-xs">
            {/* {filterSourceFile
              ? `Analysis results filtered for: ${filterSourceFile}`
              : 'Accumulated analysis results from all processed text files'
            }.  */}
            Double-click any cell to edit. 
            {/* ({processedFiles}/{totalFiles} files processed) */}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6">
          {filteredStatements.length === 0 ? (
            <div className="flex min-h-[400px] items-center justify-center rounded-2xl border border-dashed border-black/12 p-8 dark:border-white/12">
              <div className="text-center text-muted-foreground">
                <Eye className="mx-auto mb-4 size-9 text-black/25 dark:text-white/25" />
                <p className="font-medium text-foreground">No results yet</p>
                <p className="mt-1 text-sm">Analyze a text source to populate this table.</p>
              </div>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-black/[0.07] bg-white dark:border-white/[0.08] dark:bg-[#1a1a18]">
              <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-black/[0.035] text-xs text-black/55 dark:bg-white/[0.045] dark:text-white/55">
                    {/* <th className="border border-border px-4 py-2 text-left font-semibold">Title</th> */}
                    <th className="border-b border-r border-black/[0.06] px-4 py-3 text-left font-semibold dark:border-white/[0.07]">Statement</th>
                    <th className="border-b border-r border-black/[0.06] px-4 py-3 text-left font-semibold dark:border-white/[0.07]">Concept</th>
                    <th className="border-b border-r border-black/[0.06] px-4 py-3 text-left font-semibold dark:border-white/[0.07]">Actor</th>
                    <th className="border-b border-r border-black/[0.06] px-4 py-3 text-left font-semibold dark:border-white/[0.07]">Organization</th>
                    <th className="border-b border-black/[0.06] px-4 py-3 text-center font-semibold dark:border-white/[0.07]">Agree</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStatements.map((statement, index) => {
                    // Find the original index in the full statements array for editing
                    const originalIndex = filterSourceFile
                      ? statements.findIndex(stmt => stmt === statement)
                      : index
                    return (
                    <tr key={index} className="transition-colors hover:bg-black/[0.025] dark:hover:bg-white/[0.035]">
                      {/* <td className="border border-border px-4 py-2 text-xs">
                          {statement.sourceFile || 'Unknown'}
                      </td> */}
                      <td className="border-b border-r border-black/[0.055] px-4 py-3 align-top dark:border-white/[0.065]">
                        <EditableCell
                          value={statement.statement}
                          onSave={(newValue) => handleCellEdit(originalIndex, 'statement', newValue)}
                        />
                      </td>
                      <td className="border-b border-r border-black/[0.055] px-4 py-3 align-top dark:border-white/[0.065]">
                        <EditableCell
                          value={statement.concept}
                          onSave={(newValue) => handleCellEdit(originalIndex, 'concept', newValue)}
                          className="font-medium"
                        />
                      </td>
                      <td className="border-b border-r border-black/[0.055] px-4 py-3 align-top dark:border-white/[0.065]">
                        <EditableCell
                          value={statement.actor}
                          onSave={(newValue) => handleCellEdit(originalIndex, 'actor', newValue)}
                        />
                      </td>
                      <td className="border-b border-r border-black/[0.055] px-4 py-3 align-top dark:border-white/[0.065]">
                        <EditableCell
                          value={statement.organization}
                          onSave={(newValue) => handleCellEdit(originalIndex, 'organization', newValue)}
                        />
                      </td>
                      <td className="border-b border-black/[0.055] px-4 py-3 text-center align-top dark:border-white/[0.065]">
                        <Select
                          value={statement.agree ? 'TRUE' : 'FALSE'}
                          onValueChange={(newValue) => handleCellEdit(originalIndex, 'agree', newValue)}
                        >
                          <SelectTrigger className="w-20 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="TRUE">TRUE</SelectItem>
                            <SelectItem value="FALSE">FALSE</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
