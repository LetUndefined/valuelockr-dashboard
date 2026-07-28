import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string
const service = import.meta.env.VITE_SUPABASE_SERVICE_KEY as string

export const sb = createClient(url, anon)
export const sbAdmin = createClient(url, service)

export const GITHUB_TOKEN = import.meta.env.VITE_GITHUB_TOKEN as string
export const GITHUB_REPO = import.meta.env.VITE_GITHUB_REPO as string
export const SYNC_PASSWORD = import.meta.env.VITE_SYNC_PASSWORD as string
