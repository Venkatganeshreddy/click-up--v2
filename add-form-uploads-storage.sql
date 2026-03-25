-- Create storage bucket for form uploads
-- Run this in Supabase SQL Editor

-- First, create the bucket via Supabase dashboard or API:
-- Go to Storage > Create Bucket > Name: "form-uploads" > Public: true

-- Then add this policy to allow uploads:
INSERT INTO storage.buckets (id, name, public)
VALUES ('form-uploads', 'form-uploads', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to upload files (for public form submissions)
CREATE POLICY "Allow public uploads to form-uploads" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'form-uploads');

-- Allow anyone to view uploaded files
CREATE POLICY "Allow public reads from form-uploads" ON storage.objects
FOR SELECT USING (bucket_id = 'form-uploads');

-- Allow anyone to delete their own uploads (optional)
CREATE POLICY "Allow public deletes from form-uploads" ON storage.objects
FOR DELETE USING (bucket_id = 'form-uploads');
