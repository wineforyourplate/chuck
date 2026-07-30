import { useCallback, useEffect, useState } from 'react'
import type { DatastoreFileSummary } from 'lemma-sdk'
import { lemmaClient } from './lemma-client'

export const DEVELOPER_ROOT = '/me/developer'
export const DEVELOPER_REFERENCES_PATH = `${DEVELOPER_ROOT}/references`
export const DEVELOPER_DRAFTS_PATH = `${DEVELOPER_ROOT}/drafts`

export type DeveloperReference = DatastoreFileSummary

async function folderExists(path: string): Promise<boolean> {
  try {
    const file = await lemmaClient.files.get(path)
    return String(file.kind).toLowerCase() === 'folder'
  } catch {
    return false
  }
}

async function ensureFolder(path: string, parent: string, name: string, description: string) {
  if (await folderExists(path)) return
  await lemmaClient.files.folder.create(name, { directoryPath: parent, description })
}

export async function ensureDeveloperFolders() {
  await ensureFolder(
    DEVELOPER_ROOT,
    '/me',
    'developer',
    'Private inputs and outputs used only by the Developer Agent.',
  )
  await ensureFolder(
    DEVELOPER_REFERENCES_PATH,
    DEVELOPER_ROOT,
    'references',
    'Writing samples and source documents explicitly supplied for development.',
  )
  await ensureFolder(
    DEVELOPER_DRAFTS_PATH,
    DEVELOPER_ROOT,
    'drafts',
    'Separate documents created by the Developer Agent.',
  )
}

export function useDeveloperReferences() {
  const [references, setReferences] = useState<DeveloperReference[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      await ensureDeveloperFolders()
      const response = await lemmaClient.files.list({ directoryPath: DEVELOPER_REFERENCES_PATH, limit: 100 })
      const files = (response.items || [])
        .filter((item) => item.kind !== 'folder')
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
      setReferences(files)
      return files
    } catch {
      setError('Writing references could not be loaded.')
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  const upload = useCallback(async (file: File) => {
    setUploading(true)
    setError('')
    try {
      await ensureDeveloperFolders()
      await lemmaClient.files.upload(file, {
        directoryPath: DEVELOPER_REFERENCES_PATH,
        name: file.name,
        searchEnabled: true,
        description: 'Private Developer Agent writing reference.',
      })
      await refresh()
      return true
    } catch {
      setError('That document could not be uploaded. Your existing references are unchanged.')
      return false
    } finally {
      setUploading(false)
    }
  }, [refresh])

  const remove = useCallback(async (path: string) => {
    setError('')
    try {
      await lemmaClient.files.delete(path)
      setReferences((current) => current.filter((item) => item.path !== path))
      return true
    } catch {
      setError('That reference could not be removed.')
      return false
    }
  }, [])

  return { references, loading, uploading, error, refresh, upload, remove }
}

export async function readDraft(path: string): Promise<string> {
  if (!path) return ''
  const blob = await lemmaClient.files.download(path)
  return blob.text()
}

export async function writeDraft(path: string, text: string): Promise<void> {
  const blob = new Blob([text], { type: 'text/markdown' })
  try {
    await lemmaClient.files.update(path, { file: blob, searchEnabled: true })
  } catch {
    const name = path.split('/').pop() || 'draft.md'
    const directoryPath = path.slice(0, -(name.length + 1)) || DEVELOPER_DRAFTS_PATH
    await lemmaClient.files.upload(blob, { directoryPath, name, searchEnabled: true })
  }
}
