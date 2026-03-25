import 'dotenv/config';
import { supabaseAdmin } from './src/lib/supabase.js';

async function createMissingAuthUsers() {
  try {
    console.log('Fetching members without auth users...');

    // Get all members without user_id
    const { data: members, error } = await supabaseAdmin
      .from('members')
      .select('*')
      .is('user_id', null);

    if (error) {
      console.error('Error fetching members:', error);
      return;
    }

    if (!members || members.length === 0) {
      console.log('No members without auth users found.');
      return;
    }

    console.log(`Found ${members.length} members without auth users.`);

    for (const member of members) {
      console.log(`\nProcessing member: ${member.email}`);

      // Check if password exists
      if (!member.current_password) {
        console.log(`  ⚠ Skipping ${member.email} - no password stored`);
        continue;
      }

      try {
        // Create Supabase Auth user
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: member.email,
          password: member.current_password,
          email_confirm: true,
          user_metadata: { name: member.name, role: member.role }
        });

        if (authError) {
          console.error(`  ✗ Failed to create auth user for ${member.email}:`, authError.message);
          continue;
        }

        console.log(`  ✓ Created auth user: ${authUser.user.id}`);

        // Update member with user_id
        const { error: updateError } = await supabaseAdmin
          .from('members')
          .update({ user_id: authUser.user.id })
          .eq('id', member.id);

        if (updateError) {
          console.error(`  ✗ Failed to update member ${member.email}:`, updateError.message);
          // Clean up the auth user we just created
          await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
          continue;
        }

        console.log(`  ✓ Updated member with user_id`);
      } catch (err) {
        console.error(`  ✗ Error processing ${member.email}:`, err);
      }
    }

    console.log('\n✓ Migration complete!');
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

createMissingAuthUsers();
