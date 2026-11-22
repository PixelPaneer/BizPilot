import { useEffect, useRef, useState } from 'react'
import { Camera, Keyboard, LoaderCircle, Mic, Square, Upload } from 'lucide-react'
import { extractBillDraft } from '../../utils/billDraftApi'
import {
  MAX_RECORDING_SECONDS,
  canRecord,
  describeMicError,
  prepareBillImage,
  startRecording,
} from '../../utils/mediaCapture'

const MAX_AUDIO_BYTES = 5 * 1024 * 1024

const cardBase = 'flex flex-col gap-3 rounded-xl border px-4 py-3'
const smallButton =
  'inline-flex items-center gap-1.5 rounded-full border border-forest px-3 py-1.5 text-xs font-medium text-forest transition-colors hover:bg-sage-light disabled:cursor-not-allowed disabled:opacity-60'

function describeReadError(error) {
  if (error?.code === 'AI_UNAVAILABLE') {
    return 'The assistant could not read this right now. Please try again, or type the items.'
  }
  return error?.message || 'Something went wrong. Please try again.'
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60)
  return `${minutes}:${String(totalSeconds % 60).padStart(2, '0')}`
}

// The three ways to fill in the list. Typing is just the editor below. A bill photo (taken with the
// camera or picked from the device) and a voice note (recorded live or picked from the device) are
// sent to the server, which answers with a draft; `onDraft(draft, 'photo' | 'voice')` receives it.
// Nothing is saved here, and the picture or recording is not kept after it is sent.
function ReadInputPanel({ disabled = false, onDraft }) {
  const [status, setStatus] = useState('idle') // 'idle' | 'recording' | 'reading'
  const [error, setError] = useState('')
  const [seconds, setSeconds] = useState(0)
  const [readingWhat, setReadingWhat] = useState('')
  const recorderRef = useRef(null)
  const cameraInput = useRef(null)
  const photoInput = useRef(null)
  const audioInput = useRef(null)

  // Leaving the page while recording lets go of the microphone.
  useEffect(() => () => recorderRef.current?.cancel(), [])

  useEffect(() => {
    if (status !== 'recording') return undefined
    const timer = setInterval(() => setSeconds((value) => value + 1), 1000)
    return () => clearInterval(timer)
  }, [status])

  const busy = disabled || status !== 'idle'

  async function read(input, origin) {
    setStatus('reading')
    setReadingWhat(origin === 'voice' ? 'your voice note' : 'your bill')
    setError('')
    try {
      const draft = await extractBillDraft(input)
      onDraft(draft, origin)
    } catch (caught) {
      setError(describeReadError(caught))
    } finally {
      setStatus('idle')
    }
  }

  async function handlePhoto(event) {
    const file = event.target.files?.[0]
    event.target.value = '' // so choosing the same picture again still works
    if (!file) return
    setStatus('reading')
    setReadingWhat('your bill')
    setError('')
    try {
      const image = await prepareBillImage(file)
      await read({ image }, 'photo')
    } catch (caught) {
      setError(describeReadError(caught))
      setStatus('idle')
    }
  }

  function handleAudioFile(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('audio/')) {
      setError('Choose an audio file (webm, ogg, mp3, m4a or wav).')
      return
    }
    if (file.size > MAX_AUDIO_BYTES) {
      setError('That voice note is larger than 5 MB. Record a shorter one.')
      return
    }
    read({ audio: file }, 'voice')
  }

  async function beginRecording() {
    setError('')
    try {
      recorderRef.current = await startRecording({ onLimit: finishRecording })
      setSeconds(0)
      setStatus('recording')
    } catch (caught) {
      setError(caught?.name ? describeMicError(caught) : caught.message)
    }
  }

  async function finishRecording() {
    const recorder = recorderRef.current
    if (!recorder) return
    recorderRef.current = null
    setStatus('reading')
    const audio = await recorder.stop()
    if (!audio || audio.size === 0) {
      setError('Nothing was recorded. Please try again.')
      setStatus('idle')
      return
    }
    if (audio.size > MAX_AUDIO_BYTES) {
      setError('That recording is too long. Please record a shorter one.')
      setStatus('idle')
      return
    }
    await read({ audio }, 'voice')
  }

  const recording = status === 'recording'

  return (
    <div>
      <div role="group" aria-label="How to add items" className="grid gap-2 sm:grid-cols-3">
        <div className={`${cardBase} border-forest bg-sage-light text-deep`}>
          <span className="flex items-center gap-3">
            <Keyboard size={20} className="shrink-0" aria-hidden="true" />
            <span>
              <span className="block text-sm font-medium">Type items</span>
              <span className="block text-xs text-muted">Add products one by one below</span>
            </span>
          </span>
        </div>

        <div className={`${cardBase} border-line bg-white text-ink`}>
          <span className="flex items-center gap-3">
            <Camera size={20} className="shrink-0 text-forest" aria-hidden="true" />
            <span>
              <span className="block text-sm font-medium">Scan a bill</span>
              <span className="block text-xs text-muted">Take a photo or upload one</span>
            </span>
          </span>
          <span className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => cameraInput.current?.click()} className={smallButton}>
              <Camera size={14} aria-hidden="true" />
              Take photo
            </button>
            <button type="button" disabled={busy} onClick={() => photoInput.current?.click()} className={smallButton}>
              <Upload size={14} aria-hidden="true" />
              Upload photo
            </button>
          </span>
          {/* `capture` opens the camera on a phone; on a computer it is the same as choosing a file. */}
          <input
            ref={cameraInput}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            aria-label="Take a photo of a bill"
            onChange={handlePhoto}
          />
          <input
            ref={photoInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            aria-label="Upload a photo of a bill"
            onChange={handlePhoto}
          />
        </div>

        <div className={`${cardBase} ${recording ? 'border-danger-text bg-danger-bg' : 'border-line bg-white'} text-ink`}>
          <span className="flex items-center gap-3">
            <Mic size={20} className={`shrink-0 ${recording ? 'text-danger-text' : 'text-forest'}`} aria-hidden="true" />
            <span>
              <span className="block text-sm font-medium">Speak</span>
              <span className="block text-xs text-muted">
                {recording
                  ? `Recording ${formatTime(seconds)} of ${formatTime(MAX_RECORDING_SECONDS)}`
                  : 'Say what you sold or received'}
              </span>
            </span>
          </span>
          <span className="flex flex-wrap gap-2">
            {recording ? (
              <button type="button" onClick={finishRecording} className={smallButton}>
                <Square size={14} aria-hidden="true" />
                Stop and read
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled={busy || !canRecord()}
                  title={canRecord() ? undefined : 'Recording is not available in this browser'}
                  onClick={beginRecording}
                  className={smallButton}
                >
                  <Mic size={14} aria-hidden="true" />
                  Record
                </button>
                <button type="button" disabled={busy} onClick={() => audioInput.current?.click()} className={smallButton}>
                  <Upload size={14} aria-hidden="true" />
                  Upload voice note
                </button>
              </>
            )}
          </span>
          <input
            ref={audioInput}
            type="file"
            accept="audio/*"
            hidden
            aria-label="Upload a voice note"
            onChange={handleAudioFile}
          />
        </div>
      </div>

      {status === 'reading' && (
        <p role="status" className="mt-3 flex items-center gap-2 text-sm text-muted">
          <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />
          Reading {readingWhat || 'your input'}... this can take up to a minute.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-danger-text">
          {error}
        </p>
      )}
    </div>
  )
}

export default ReadInputPanel
