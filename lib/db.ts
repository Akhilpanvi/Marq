import mongoose from 'mongoose'

const g = globalThis as unknown as { mongoose?: Promise<typeof mongoose> }

export function db() {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI is not set')
  g.mongoose ??= mongoose.connect(uri, { maxPoolSize: 10, serverSelectionTimeoutMS: 8000 }).catch(e => {
    g.mongoose = undefined
    throw e
  })
  return g.mongoose
}
