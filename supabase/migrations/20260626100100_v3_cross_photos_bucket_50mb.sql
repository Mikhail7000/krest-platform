-- Лимит бакета student-cross-photos был 10 МБ. iPhone-фото (HEIC/высокое разрешение)
-- часто крупнее → upload падал 500 STORAGE_ERROR, запись дня не создавалась
-- («загрузил фото, а оно не засчиталось»). Поднимаем лимит до 50 МБ.

UPDATE storage.buckets SET file_size_limit = 52428800 WHERE id = 'student-cross-photos';
