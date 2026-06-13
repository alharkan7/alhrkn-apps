// Database
export {
  fetchRecords,
  fetchById,
  insertRecord,
  insertRecords,
  updateRecords,
  updateById,
  deleteRecords,
  deleteById,
  countRecords,
} from './db'

// Supabase clients
export { createClient } from './supabase/client'
export { createServerSupabaseClient } from './supabase/server'

// Storage
export {
  uploadFile,
  uploadFileFromPath,
  downloadFile,
  downloadFileToPath,
  deleteFile,
  deleteFiles,
  deleteFilesByPrefix,
  fileExists,
  getFileMetadata,
  listFiles,
  getSignedUrl,
  makeFilePublic,
  makeFilePrivate,
  getPublicUrl,
  copyFile,
  moveFile,
  getFileSize,
  isFilePublic,
} from './storage'

export type { UploadOptions, SignedUrlOptions } from './storage'
