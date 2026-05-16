-- v3 AI-first: добавляем колонку summary_md в block_resources.
-- transcript_md остаётся «сырым» (что выдал ASR / руками собранный поток слов),
-- summary_md — markdown-конспект, переписанный Sonnet через scripts/transcripts-to-summaries.mjs.
-- См. docs/spec-first/04-ai-first-flow.md и memory/project_authors_methodology_vs_content.md.

ALTER TABLE public.block_resources
  ADD COLUMN IF NOT EXISTS summary_md text;

COMMENT ON COLUMN public.block_resources.summary_md IS
  'Markdown-конспект, сгенерированный Claude Sonnet из transcript_md. NULL = ещё не сгенерирован.';

-- Индекс не нужен: выборка идёт по resource_type + транскрипт, summary_md только читается/пишется по строке.
