import { Bucket, File } from '@google-cloud/storage'
import { getBucket } from './client'

export type UploadOptions = {
  destination: string
  contentType?: string
  metadata?: Record<string, string>
  public?: boolean
}

export type SignedUrlOptions = {
  action: 'read' | 'write' | 'delete' | 'resumable'
  expires?: number
  version?: 'v2' | 'v4'
  promptSaveAs?: string
  responseDisposition?: string
  responseContentType?: string
  generation?: number
  contentType?: string
}

/**
 * Upload a file to Google Cloud Storage
 */
export async function uploadFile(
  buffer: Buffer | Uint8Array,
  options: UploadOptions
): Promise<string> {
  const bucket = getBucket()
  const { destination, contentType, metadata, public: isPublic = false } = options

  const file = bucket.file(destination)

  await file.save(buffer, {
    contentType,
    metadata: {
      ...metadata,
    },
  })

  if (isPublic) {
    await file.makePublic()
  }

  return destination
}

/**
 * Upload a file from a local path
 */
export async function uploadFileFromPath(
  filePath: string,
  options: UploadOptions
): Promise<string> {
  const bucket = getBucket()
  const { destination, contentType, metadata, public: isPublic = false } = options

  await bucket.upload(filePath, {
    destination,
    contentType,
    metadata,
    public: isPublic,
  })

  return destination
}

/**
 * Download a file from Google Cloud Storage
 */
export async function downloadFile(destination: string): Promise<Buffer> {
  const bucket = getBucket()
  const file = bucket.file(destination)

  const [exists] = await file.exists()
  if (!exists) {
    throw new Error(`File not found: ${destination}`)
  }

  const [buffer] = await file.download()
  return buffer
}

/**
 * Download a file to a local path
 */
export async function downloadFileToPath(
  destination: string,
  localPath: string
): Promise<void> {
  const bucket = getBucket()
  const file = bucket.file(destination)

  const [exists] = await file.exists()
  if (!exists) {
    throw new Error(`File not found: ${destination}`)
  }

  await file.download({ destination: localPath })
}

/**
 * Delete a file from Google Cloud Storage
 */
export async function deleteFile(destination: string): Promise<void> {
  const bucket = getBucket()
  const file = bucket.file(destination)

  const [exists] = await file.exists()
  if (!exists) {
    throw new Error(`File not found: ${destination}`)
  }

  await file.delete()
}

/**
 * Delete multiple files from Google Cloud Storage
 */
export async function deleteFiles(destinations: string[]): Promise<void> {
  const bucket = getBucket()
  const files = destinations.map((dest) => bucket.file(dest))

  await Promise.all(files.map(async (file) => {
    const [exists] = await file.exists()
    if (exists) {
      await file.delete()
    }
  }))
}

/**
 * Delete all files with a given prefix
 */
export async function deleteFilesByPrefix(prefix: string): Promise<number> {
  const bucket = getBucket()
  const [files] = await bucket.getFiles({ prefix })

  await Promise.all(files.map((file) => file.delete()))

  return files.length
}

/**
 * Check if a file exists
 */
export async function fileExists(destination: string): Promise<boolean> {
  const bucket = getBucket()
  const file = bucket.file(destination)

  const [exists] = await file.exists()
  return exists
}

/**
 * Get file metadata
 */
export async function getFileMetadata(destination: string): Promise<File['metadata']> {
  const bucket = getBucket()
  const file = bucket.file(destination)

  const [exists] = await file.exists()
  if (!exists) {
    throw new Error(`File not found: ${destination}`)
  }

  const [metadata] = await file.getMetadata()
  return metadata
}

/**
 * List files in the bucket
 */
export async function listFiles(options?: {
  prefix?: string
  delimiter?: string
  maxResults?: number
  pageToken?: string
}): Promise<{ files: File[]; nextPageToken?: string }> {
  const bucket = getBucket()

  const [files, , apiResponse] = await bucket.getFiles(options)

  return {
    files,
    nextPageToken: (apiResponse as any)?.nextPageToken,
  }
}

/**
 * Generate a signed URL for a file
 */
export async function getSignedUrl(
  destination: string,
  options: SignedUrlOptions = { action: 'read' }
): Promise<string> {
  const bucket = getBucket()
  const file = bucket.file(destination)

  const [exists] = await file.exists()
  if (!exists) {
    throw new Error(`File not found: ${destination}`)
  }

  const config: any = {
    action: options.action,
    expires: options.expires || Date.now() + 15 * 60 * 1000, // Default 15 minutes
    version: options.version || 'v4',
  }

  if (options.promptSaveAs) {
    config.promptSaveAs = options.promptSaveAs
  }

  if (options.responseDisposition) {
    config.responseDisposition = options.responseDisposition
  }

  if (options.responseContentType) {
    config.responseContentType = options.responseContentType
  }

  if (options.generation) {
    config.generation = options.generation
  }

  if (options.contentType) {
    config.contentType = options.contentType
  }

  const [url] = await file.getSignedUrl(config)
  return url
}

/**
 * Make a file public
 */
export async function makeFilePublic(destination: string): Promise<string> {
  const bucket = getBucket()
  const file = bucket.file(destination)

  await file.makePublic()

  return `https://storage.googleapis.com/${bucket.name}/${destination}`
}

/**
 * Make a file private
 */
export async function makeFilePrivate(destination: string): Promise<void> {
  const bucket = getBucket()
  const file = bucket.file(destination)

  await file.makePrivate()
}

/**
 * Get the public URL for a file (if it's public)
 */
export function getPublicUrl(destination: string): string {
  const bucket = getBucket()
  return `https://storage.googleapis.com/${bucket.name}/${destination}`
}

/**
 * Copy a file within the bucket
 */
export async function copyFile(
  source: string,
  destination: string
): Promise<string> {
  const bucket = getBucket()
  const sourceFile = bucket.file(source)
  const destinationFile = bucket.file(destination)

  const [exists] = await sourceFile.exists()
  if (!exists) {
    throw new Error(`Source file not found: ${source}`)
  }

  await sourceFile.copy(destinationFile)

  return destination
}

/**
 * Move/rename a file within the bucket
 */
export async function moveFile(
  source: string,
  destination: string
): Promise<string> {
  const bucket = getBucket()
  const sourceFile = bucket.file(source)
  const destinationFile = bucket.file(destination)

  const [exists] = await sourceFile.exists()
  if (!exists) {
    throw new Error(`Source file not found: ${source}`)
  }

  await sourceFile.move(destinationFile)

  return destination
}

/**
 * Get file size in bytes
 */
export async function getFileSize(destination: string): Promise<number> {
  const metadata = await getFileMetadata(destination)
  return Number(metadata.size)
}

/**
 * Check if a file is public
 */
export async function isFilePublic(destination: string): Promise<boolean> {
  const bucket = getBucket()
  const file = bucket.file(destination)

  try {
    const [acl] = await file.acl.get()
    const aclArray = Array.isArray(acl) ? acl : [acl]
    return aclArray.some((entry: any) => entry.entity === 'allUsers' && entry.role === 'READER')
  } catch {
    return false
  }
}
