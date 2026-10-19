-- Clear legacy relative cache paths and temp paths from `library_items.cover`.
-- Display uses canonical `userData/covers/<id>.webp` when `cover` is null, or a custom absolute path when set.
UPDATE `library_items` SET `cover` = NULL;