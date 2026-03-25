import 'dotenv/config';
import { supabaseAdmin } from './src/lib/supabase.js';

async function fixMemberStatus() {
  const email = 'venkatganeshreddy4212@gmail.com';
  
  console.log(`Updating member status for ${email}...`);
  
  const { data, error } = await supabaseAdmin
    .from('members')
    .update({ status: 'active' })
    .eq('email', email)
    .select()
    .single();
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('✓ Member status updated to active');
  console.log('Member:', JSON.stringify(data, null, 2));
}

fixMemberStatus();
