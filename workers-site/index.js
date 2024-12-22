import { getAssetFromKV } from '@cloudflare/kv-asset-handler'
import { createPythonWorker } from '@cloudflare/workers-python'

const pythonWorker = createPythonWorker()

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event))
})

async function handleRequest(event) {
  try {
    // Try to serve static assets first
    const response = await getAssetFromKV(event)
    return response
  } catch (e) {
    // If not a static asset, pass to Flask application
    return pythonWorker.fetch(event.request)
  }
}
