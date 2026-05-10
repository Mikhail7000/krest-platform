-- ============================================================
-- v3.0 Stage 4 — расширение allowed_mime_types для student-recitations
-- Зачем: MediaRecorder в браузере для video_note выдаёт 'video/webm'
--   (codecs=vp8,opus). Без явного разрешения bucket отклоняет upload
--   с 400, страница падает с 500 при отправке кружка.
-- Также добавлен 'video/quicktime' (.mov) на случай нативной
--   камеры iPhone/Mac.
-- Связано: docs/spec-first/04-ai-first-flow.md, Stage 4.
-- ============================================================

UPDATE storage.buckets
   SET allowed_mime_types = ARRAY[
     'video/mp4',
     'video/webm',
     'video/quicktime',
     'audio/ogg',
     'audio/mpeg',
     'audio/wav',
     'audio/webm',
     'audio/x-m4a',
     'audio/mp4'
   ]
 WHERE id = 'student-recitations';
