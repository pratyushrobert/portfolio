import { loadEnvironment } from '../src/config/env.js';
import { createClient } from '@supabase/supabase-js';

async function auditStorage() {
  const env = loadEnvironment();
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY);

  console.log('--- AUDITING SUPABASE STORAGE ---');

  // 1. Get bucket metadata
  const { data: buckets, error: bucketErr } = await supabase.storage.listBuckets();
  if (bucketErr) {
    throw new Error(`Failed to list buckets: ${bucketErr.message}`);
  }

  const assetBucket = buckets.find((b) => b.name === env.SUPABASE_STORAGE_BUCKET);
  if (!assetBucket) {
    throw new Error(`Bucket '${env.SUPABASE_STORAGE_BUCKET}' not found!`);
  }

  console.log(`Bucket name: ${assetBucket.name}`);
  console.log(`Bucket ID: ${assetBucket.id}`);
  console.log(`Public status: ${assetBucket.public ? 'PUBLIC' : 'PRIVATE'}`);
  console.log(`File size limit: ${assetBucket.file_size_limit ?? 'None'}`);
  console.log(`Allowed mime types: ${assetBucket.allowed_mime_types ? JSON.stringify(assetBucket.allowed_mime_types) : 'Any'}`);

  // 2. List objects in bucket
  const { data: files, error: filesErr } = await supabase.storage
    .from(env.SUPABASE_STORAGE_BUCKET)
    .list('', { limit: 100, offset: 0, sortBy: { column: 'name', order: 'asc' } });

  if (filesErr) {
    throw new Error(`Failed to list files: ${filesErr.message}`);
  }

  console.log(`\nFiles in bucket (${files.length} total):`);
  for (const f of files) {
    console.log(`- Name: ${f.name}`);
    console.log(`  Size: ${f.metadata?.size ?? 'Unknown'} bytes`);
    console.log(`  MIME: ${f.metadata?.mimetype ?? 'Unknown'}`);
    console.log(`  Created: ${f.created_at}`);
    const publicUrl = supabase.storage.from(env.SUPABASE_STORAGE_BUCKET).getPublicUrl(f.name).data.publicUrl;
    console.log(`  Public URL: ${publicUrl}`);
    try {
      const headRes = await fetch(publicUrl, { method: 'HEAD' });
      console.log(`  HTTP HEAD status: ${headRes.status} ${headRes.statusText}`);
    } catch (e) {
      console.log(`  HTTP HEAD error: ${e.message}`);
    }
  }

  console.log('\n>>> STORAGE AUDIT COMPLETE <<<');
}

auditStorage().catch((err) => {
  console.error('STORAGE AUDIT FAILED:', err.message);
  process.exit(1);
});
