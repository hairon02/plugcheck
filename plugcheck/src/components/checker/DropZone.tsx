'use client'
import { useState, useRef, type DragEvent } from 'react'
import type { PluginInput } from '@/types'

interface DropZoneProps {
  onPluginsAdded: (plugins: PluginInput[]) => void
}

export function DropZone({ onPluginsAdded }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [loadedFileNames, setLoadedFileNames] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  async function processFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    const jarFiles = Array.from(files).filter((f) => f.name.toLowerCase().endsWith('.jar'))
    if (jarFiles.length === 0) return

    setIsProcessing(true)
    setLoadedFileNames(jarFiles.map((f) => f.name))

    try {
      // Dynamic import — JSZip (~100KB) is only loaded when the user actually drops JARs
      const { parseJarFiles } = await import('@/lib/jar-parser')
      const plugins = await parseJarFiles(jarFiles)
      onPluginsAdded(plugins)
    } catch {
      setLoadedFileNames([])
    } finally {
      setIsProcessing(false)
    }
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave(e: DragEvent) {
    // Only clear drag state when leaving the drop zone itself, not its children
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false)
    }
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    processFiles(e.dataTransfer.files)
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className="cursor-pointer rounded-xl p-8 text-center transition-all duration-150 ease-out"
      style={{
        border: isDragging ? '2px dashed var(--color-primary)' : '2px dashed var(--color-border)',
        backgroundColor: isDragging ? '#F0FDF4' : 'var(--color-card)',
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".jar"
        multiple
        className="hidden"
        onChange={(e) => processFiles(e.target.files)}
      />
      {isProcessing ? (
        <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
          Parsing JAR files...
        </p>
      ) : loadedFileNames.length > 0 ? (
        <div>
          <p className="text-sm font-medium" style={{ color: 'var(--color-foreground)' }}>
            {loadedFileNames.length} JAR{loadedFileNames.length !== 1 ? 's' : ''} loaded
          </p>
          <p className="mt-1 text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
            {loadedFileNames.slice(0, 3).join(', ')}{loadedFileNames.length > 3 ? ` +${loadedFileNames.length - 3} more` : ''}
          </p>
        </div>
      ) : (
        <div>
          <p className="text-sm font-medium" style={{ color: 'var(--color-foreground)' }}>
            Drop .jar files here
          </p>
          <p className="mt-1 text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
            or click to browse — files are parsed locally and never uploaded
          </p>
        </div>
      )}
    </div>
  )
}
