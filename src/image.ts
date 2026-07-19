// Client-side image handling: read files, downscale before sending to Gemini
// (keeps payloads small and inference fast).

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image()
    img.onload = () => res(img)
    img.onerror = rej
    img.src = src
  })
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result as string)
    r.onerror = rej
    r.readAsDataURL(file)
  })
}

export async function fileToDataUrl(file: File, maxDim = 1280, quality = 0.85): Promise<string> {
  const dataUrl = await readAsDataUrl(file)
  try {
    const img = await loadImage(dataUrl)
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
    if (scale >= 1) return dataUrl
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.width * scale)
    canvas.height = Math.round(img.height * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) return dataUrl
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', quality)
  } catch {
    return dataUrl
  }
}

export async function filesToImages(files: FileList | File[], max = 8): Promise<string[]> {
  const arr = Array.from(files).filter((f) => f.type.startsWith('image/')).slice(0, max)
  return Promise.all(arr.map((f) => fileToDataUrl(f)))
}
