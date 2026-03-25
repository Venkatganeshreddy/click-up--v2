import 'dotenv/config';
import { supabaseAdmin } from './src/lib/supabase.js';

async function checkAuthUsers() {
  try {
    console.log('Fetching all auth users...\n');

    const { data, error } = await supabaseAdmin.auth.admin.listUsers();

    if (error) {
      console.error('Error fetching users:', error);
      return;
    }

    console.log(`Total auth users: ${data.users.length}\n`);

    for (const user of data.users) {
      console.log(`Email: ${user.email}`);
      console.log(`ID: ${user.id}`);
      console.log(`Created: ${user.created_at}`);
      console.log(`Confirmed: ${user.email_confirmed_at ? 'Yes' : 'No'}`);
      console.log('---');
    }

    // Check for specific email
    const targetEmail = 'venkatganeshreddy4212@gmail.com';
    const existingUser = data.users.find(u => u.email === targetEmail);

    if (existingUser) {
      console.log(`\n⚠ Auth user already exists for ${targetEmail}`);
      console.log(`User ID: ${existingUser.id}`);

      // Check if member has this user_id
      const { data: member } = await supabaseAdmin
        .from('members')
        .select('*')
        .eq('email', targetEmail)
        .single();

      if (member) {
        console.log(`Member record found:`);
        console.log(`  Member ID: ${member.id}`);
        console.log(`  User ID: ${member.user_id || 'NULL'}`);
        console.log(`  Status: ${member.status}`);

        if (!member.user_id) {
          console.log(`\n→ Solution: Update member record with user_id: ${existingUser.id}`);
        }
      }
    } else {
      console.log(`\n✓ No auth user exists for ${targetEmail}`);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

checkAuthUsers();
