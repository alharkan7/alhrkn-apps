import { Storage } from '@google-cloud/storage'

let storageInstance: Storage | null = null

export function getStorageClient(): Storage {
  if (storageInstance) {
    return storageInstance
  }

  const options: any = {
    projectId: process.env.GOOGLE_CLOUD_PROJECT,
  }

  if (process.env.GOOGLE_CREDENTIALS_JSON) {
    options.credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON)
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    options.keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS
  }

  storageInstance = new Storage(options)

  return storageInstance
}

export function getBucket() {
  const storage = getStorageClient()
  const bucketName = process.env.GOOGLE_CLOUD_BUCKET!

  return storage.bucket(bucketName)
}
