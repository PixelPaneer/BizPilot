// Browser helpers for the Update Stock page: recording a voice note with the microphone and
// getting a bill photo ready to upload. Nothing here is stored or sent anywhere by itself.

export const MAX_RECORDING_SECONDS = 120
const MAX_PHOTO_SIDE = 2000 // longest side in pixels; plenty to read a bill, far below the 10 MB limit
const MAX_PHOTO_BYTES = 10 * 1024 * 1024
const KEEP_AS_IS_BYTES = 1.5 * 1024 * 1024
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp']

// What the browser can record as, best first. Chrome and Firefox give webm or ogg, Safari gives mp4;
// the server accepts all of them.
const RECORDER_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']

export function pickRecorderType(isSupported) {
  return RECORDER_TYPES.find((type) => isSupported(type)) ?? ''
}

// The size an image shrinks to so its longest side is at most `maxSide` (never larger than it is).
export function fitWithin(width, height, maxSide) {
  const longest = Math.max(width, height)
  if (longest <= maxSide) return { width, height }
  const scale = maxSide / longest
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

export function canRecord() {
  return (
    typeof navigator !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== 'undefined'
  )
}

// Plain-language reason for a failed microphone request.
export function describeMicError(error) {
  switch (error?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Microphone access was blocked. Allow the microphone for this site in your browser, then try again.'
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'No microphone was found on this device.'
    case 'NotReadableError':
      return 'The microphone is being used by another app.'
    default:
      return 'Could not start recording. Please try again.'
  }
}

// Starts recording from the microphone. Resolves to { stop, cancel }: `stop()` ends the recording
// and resolves to the audio Blob; `cancel()` throws the recording away. It stops by itself after
// MAX_RECORDING_SECONDS (then `onLimit` runs, and `stop()` still returns what was recorded).
// The microphone is released as soon as recording ends.
export async function startRecording({ onLimit } = {}) {
  if (!canRecord()) {
    throw new Error('Recording is not supported in this browser. Upload a voice note instead.')
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  const type = pickRecorderType((candidate) => MediaRecorder.isTypeSupported(candidate))
  const recorder = new MediaRecorder(stream, {
    ...(type ? { mimeType: type } : {}),
    audioBitsPerSecond: 32000, // speech does not need more, and it keeps the file small
  })

  const chunks = []
  let discard = false
  let timer = null

  const finished = new Promise((resolve) => {
    recorder.addEventListener('stop', () => {
      clearTimeout(timer)
      stream.getTracks().forEach((track) => track.stop())
      resolve(discard ? null : new Blob(chunks, { type: recorder.mimeType || type || 'audio/webm' }))
    })
  })
  recorder.addEventListener('dataavailable', (event) => {
    if (event.data.size > 0) chunks.push(event.data)
  })

  recorder.start()
  timer = setTimeout(() => {
    if (recorder.state === 'recording') {
      recorder.stop()
      onLimit?.()
    }
  }, MAX_RECORDING_SECONDS * 1000)

  return {
    stop() {
      if (recorder.state === 'recording') recorder.stop()
      return finished
    },
    cancel() {
      discard = true
      if (recorder.state === 'recording') recorder.stop()
      else stream.getTracks().forEach((track) => track.stop())
    },
  }
}

// Gets a picture ready for upload: checks it is a photo the server can read, and shrinks a large one
// (phone cameras take 5 to 15 MB pictures) so it uploads quickly and stays under the size limit.
export async function prepareBillImage(file) {
  const fail = () =>
    new Error('This picture could not be read. Use a JPG, PNG or WebP image.')

  if (!file.type.startsWith('image/')) throw fail()

  let bitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw fail() // for example an iPhone HEIC picture the browser cannot open
  }

  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height, MAX_PHOTO_SIDE)
    const alreadyFine =
      PHOTO_TYPES.includes(file.type) &&
      file.size <= KEEP_AS_IS_BYTES &&
      width === bitmap.width &&
      height === bitmap.height
    if (alreadyFine) return file

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height)
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
    if (!blob || blob.size > MAX_PHOTO_BYTES) throw fail()
    return new File([blob], 'bill.jpg', { type: 'image/jpeg' })
  } finally {
    bitmap.close?.()
  }
}
