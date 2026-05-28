#!/usr/bin/env node
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(new URL('..', import.meta.url).pathname)
const distDir = join(root, 'dist')
const indexPath = join(distDir, 'index.html')
const nginxPath = join(root, 'nginx.conf')

function fail(message) {
  console.error(`✗ ${message}`)
  process.exitCode = 1
}

function pass(message) {
  console.log(`✓ ${message}`)
}

function assertFile(path, label) {
  if (!existsSync(path)) {
    fail(`${label} missing: ${path}`)
    return false
  }
  if (!statSync(path).isFile()) {
    fail(`${label} is not a file: ${path}`)
    return false
  }
  pass(`${label} exists`)
  return true
}

function assertIncludes(text, needle, label) {
  if (!text.includes(needle)) {
    fail(`${label} missing ${JSON.stringify(needle)}`)
    return
  }
  pass(label)
}

async function fetchWithTimeout(url) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)

  try {
    return await fetch(url, { signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

async function checkHealthUrl(url) {
  if (!url) {
    pass('BHK_HEALTH_URL not set; skipped live health check')
    return
  }

  try {
    const response = await fetchWithTimeout(url)
    if (!response.ok) {
      fail(`health endpoint ${url} returned HTTP ${response.status}`)
      return
    }
    pass(`health endpoint ${url} returned HTTP ${response.status}`)
  } catch (error) {
    fail(`health endpoint ${url} failed: ${error.message}`)
  }
}

async function checkStaticUrl(baseUrl) {
  if (!baseUrl) {
    pass('BHK_STATIC_URL not set; skipped live static preview check')
    return
  }

  const normalized = baseUrl.replace(/\/$/, '')
  for (const path of ['/', '/tasks/t_smoke_static']) {
    const url = `${normalized}${path}`
    try {
      const response = await fetchWithTimeout(url)
      const body = await response.text()
      if (!response.ok) {
        fail(`static preview ${url} returned HTTP ${response.status}`)
      } else if (!body.includes('<div id="root"></div>')) {
        fail(`static preview ${url} did not return SPA index.html`)
      } else {
        pass(`static preview ${url} returned SPA index.html`)
      }
    } catch (error) {
      fail(`static preview ${url} failed: ${error.message}`)
    }
  }
}

if (assertFile(indexPath, 'dist/index.html')) {
  const indexHtml = readFileSync(indexPath, 'utf8')
  const refs = [...indexHtml.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((match) => match[1])

  if (refs.length === 0) {
    fail('dist/index.html does not reference any /assets/ files')
  } else {
    pass(`dist/index.html references ${refs.length} built asset(s)`)
  }

  for (const ref of refs) {
    assertFile(join(distDir, ref), `asset ${ref}`)
  }
}

if (assertFile(nginxPath, 'nginx.conf')) {
  const nginx = readFileSync(nginxPath, 'utf8')
  assertIncludes(nginx, 'try_files $uri $uri/ /index.html;', 'nginx SPA fallback configured')
  assertIncludes(nginx, 'Cache-Control "public, max-age=31536000, immutable"', 'nginx immutable asset cache configured')
  assertIncludes(nginx, 'location = /healthz', 'nginx health endpoint configured')
  assertIncludes(nginx, 'location /api/plugins/kanban/', 'nginx BHK bridge proxy path documented in config')
}

await checkHealthUrl(process.env.BHK_HEALTH_URL)
await checkStaticUrl(process.env.BHK_STATIC_URL)

if (process.exitCode) {
  process.exit(process.exitCode)
}

console.log('Static deployment smoke passed')
