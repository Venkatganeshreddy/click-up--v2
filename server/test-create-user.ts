import 'dotenv/config';
import { supabaseAdmin } from './src/lib/supabase.js';

async function testCreateUser() {
  const email = 'venkatganeshreddy4212@gmail.com';
  const password = '8scQ29LBVK';
  const name = 'Test User';
  const role = 'member';

  console.log('Attempting to create auth user...');
  console.log(`Email: ${email}`);
  console.log(`Password: ${password}\n`);

  try {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role }
    });

    if (error) {
      console.error('Error creating user:');
      console.error('  Message:', error.message);
      console.error('  Name:', error.name);
      console.error('  Status:', error.status);
      console.error('  Code:', (error as any).code);
      console.error('  Full error:', JSON.stringify(error, null, 2));
      return;
    }

    console.log('✓ User created successfully!');
    console.log('User ID:', data.user.id);
  } catch (err) {
    console.error('Caught exception:', err);
  }
}

testCreateUser();
