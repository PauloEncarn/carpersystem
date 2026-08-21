-- Os registros persistem URLs públicas para uso na supervisão, relatórios e e-mails.
-- Escrita e exclusão continuam controladas pelas policies de storage.objects.
update storage.buckets
set public = true,
    file_size_limit = 10485760,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'rg-fotos';
