/**
 * AI-first flow константы (см. docs/spec-first/04-ai-first-flow.md §10).
 * Меняются только через PR + согласование с Михаилом.
 */

export const MAX_QUIZ_ATTEMPTS = 3
export const LOCK_DURATION_HOURS = 24

export const BLOCK_QUIZ_PASS_PCT = 75
export const MID_EXAM_PASS_PCT = 80
export const FINAL_EXAM_PASS_PCT = 85

export const VIDEO_COMPLETION_THRESHOLD = 0.95
export const DEFAULT_SIMILARITY_THRESHOLD = 0.85

// Anthropic
export const CLAUDE_SONNET_MODEL = 'claude-sonnet-4-6'
export const CLAUDE_HAIKU_MODEL = 'claude-haiku-4-5'
export const ANTHROPIC_API_VERSION = '2023-06-01'
export const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
export const ANTHROPIC_DEFAULT_MAX_TOKENS = 2048
export const ANTHROPIC_DEFAULT_TIMEOUT_MS = 60_000
export const ANTHROPIC_RETRY_ATTEMPTS = 3

// OpenAI Whisper
export const WHISPER_MODEL = 'whisper-1'
export const WHISPER_API_URL = 'https://api.openai.com/v1/audio/transcriptions'
export const WHISPER_DEFAULT_LANGUAGE = 'ru'
export const WHISPER_DEFAULT_TIMEOUT_MS = 90_000

// Storage bucket для голосовых/видео ученика
export const STUDENT_RECITATIONS_BUCKET = 'student-recitations'
