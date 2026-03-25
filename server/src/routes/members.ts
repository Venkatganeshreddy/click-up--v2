import { Router } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase.js';
import { Resend } from 'resend';
import crypto from 'crypto';

const router = Router();

// Owner email constant
const OWNER_EMAIL = 'yedam.venkatganesh@nxtwave.co.in';

// Setup Owner account (one-time use)
router.post('/setup-owner', async (req, res) => {
  try {
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if owner already exists in auth
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const ownerExists = existingUsers?.users?.find(u => u.email === OWNER_EMAIL);

    if (ownerExists) {
      // Update password for existing owner
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        ownerExists.id,
        { password }
      );

      if (updateError) {
        return res.status(400).json({ error: updateError.message });
      }

      // Update or create member record
      const { data: existingMember } = await supabaseAdmin
        .from('members')
        .select('id')
        .eq('email', OWNER_EMAIL)
        .single();

      if (existingMember) {
        await supabaseAdmin
          .from('members')
          .update({ current_password: password })
          .eq('email', OWNER_EMAIL);
      } else {
        await supabaseAdmin
          .from('members')
          .insert({
            email: OWNER_EMAIL,
            name: 'Owner',
            role: 'admin',
            status: 'active',
            user_id: ownerExists.id,
            joined_at: new Date().toISOString(),
            default_password: password,
            current_password: password
          });
      }

      return res.json({ message: 'Owner password updated successfully' });
    }

    // Create new owner account
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: OWNER_EMAIL,
      password,
      email_confirm: true,
      user_metadata: { name: 'Owner', role: 'owner' }
    });

    if (authError) {
      return res.status(400).json({ error: authError.message });
    }

    // Create member record
    await supabaseAdmin
      .from('members')
      .insert({
        email: OWNER_EMAIL,
        name: 'Owner',
        role: 'admin',
        status: 'active',
        user_id: authUser.user.id,
        joined_at: new Date().toISOString(),
        default_password: password,
        current_password: password
      });

    res.json({ message: 'Owner account created successfully' });
  } catch (error) {
    console.error('Setup owner error:', error);
    res.status(500).json({ error: 'Failed to setup owner account' });
  }
});

// Initialize Resend (only needs API key)
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Validation schemas
const createMemberSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(6),
  role: z.enum(['member', 'limited_member', 'guest', 'admin']),
  guest_permission: z.enum(['full_edit', 'edit', 'view_only']).optional(),
  workspace_id: z.string().optional(),
  space_id: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
});

// Generate random password if not provided
const generatePassword = () => crypto.randomBytes(8).toString('hex');

// Email HTML template for new member credentials
const getCredentialsEmailHtml = (name: string, email: string, password: string, role: string, loginUrl: string) => `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #7c3aed, #6366f1); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
    .credentials { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .credential-item { margin: 10px 0; }
    .credential-label { color: #6b7280; font-size: 12px; text-transform: uppercase; }
    .credential-value { color: #111; font-size: 16px; font-weight: bold; font-family: monospace; background: #f3f4f6; padding: 8px 12px; border-radius: 4px; margin-top: 4px; }
    .button { display: inline-block; background: #7c3aed; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
    .role-badge { display: inline-block; background: #e0e7ff; color: #4f46e5; padding: 4px 12px; border-radius: 20px; font-size: 14px; }
    .warning { background: #fef3c7; border: 1px solid #f59e0b; color: #92400e; padding: 12px; border-radius: 8px; margin-top: 20px; font-size: 14px; }
    .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">Welcome to the Team!</h1>
    </div>
    <div class="content">
      <p>Hi ${name},</p>
      <p>You've been added to the workspace as a <span class="role-badge">${role.replace('_', ' ')}</span>.</p>

      <div class="credentials">
        <h3 style="margin-top: 0;">Your Login Credentials</h3>
        <div class="credential-item">
          <div class="credential-label">Email</div>
          <div class="credential-value">${email}</div>
        </div>
        <div class="credential-item">
          <div class="credential-label">Password</div>
          <div class="credential-value">${password}</div>
        </div>
      </div>

      <div style="text-align: center;">
        <a href="${loginUrl}" class="button">Login Now</a>
      </div>

      <div class="warning">
        <strong>Important:</strong> Please change your password after your first login for security.
      </div>
    </div>
    <div class="footer">
      <p>Sent from ClickUp Clone - Task Management App</p>
    </div>
  </div>
</body>
</html>
`;

// Fix owner email (temporary utility route)
router.post('/fix-owner-email', async (_req, res) => {
  try {
    // Revert back to correct email
    const { data, error } = await supabaseAdmin
      .from('members')
      .update({ email: 'yedam.venkatganesh@nxtwave.co.in' })
      .eq('email', 'yedam.venkatganesh@nxtwave.co.com')
      .select()
      .single();

    if (error) throw error;
    res.json({ message: 'Owner email reverted', member: data });
  } catch (error) {
    console.error('Fix owner email error:', error);
    res.status(500).json({ error: 'Failed to update owner email' });
  }
});

// Get all members
router.get('/', async (_req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('members')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error('Get members error:', error);
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

// Get member by ID
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('members')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: 'Member not found' });
    }
    res.json(data);
  } catch (error) {
    console.error('Get member error:', error);
    res.status(500).json({ error: 'Failed to fetch member' });
  }
});

// Get current member by user_id
router.get('/me/:userId', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('members')
      .select('*')
      .eq('user_id', req.params.userId)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Member not found' });
    }
    res.json(data);
  } catch (error) {
    console.error('Get current member error:', error);
    res.status(500).json({ error: 'Failed to fetch member' });
  }
});

// Create member with credentials - Only Owner/Admin can create members
router.post('/create', async (req, res) => {
  try {
    // Get the requesting user from authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Authorization required' });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !requestingUser) {
      return res.status(401).json({ error: 'Invalid session' });
    }

    // Check if requesting user is Owner or Admin
    const isOwner = requestingUser.email === OWNER_EMAIL;

    if (!isOwner) {
      const { data: requestingMember } = await supabaseAdmin
        .from('members')
        .select('role')
        .eq('user_id', requestingUser.id)
        .single();

      if (requestingMember?.role !== 'admin') {
        return res.status(403).json({ error: 'Only Owner or Admin can create members' });
      }
    }

    const { email, name, password, role, guest_permission, workspace_id, space_id } = createMemberSchema.parse(req.body);
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

    // Check if member already exists
    const { data: existingMember } = await supabaseAdmin
      .from('members')
      .select('id')
      .eq('email', email)
      .single();

    if (existingMember) {
      return res.status(400).json({ error: 'A member with this email already exists' });
    }

    // Create member record first without auth user
    // Auth user will be created automatically on first login
    console.log(`Creating member for email: ${email}`);
    console.log('Auth user will be created on first login');

    // Create member record in database (user_id will be set on first login)
    const { data: member, error: memberError} = await supabaseAdmin
      .from('members')
      .insert({
        email,
        name,
        role,
        guest_permission: role === 'guest' ? (guest_permission || 'view_only') : null,
        status: 'pending', // Will be set to 'active' on first login
        workspace_id,
        space_id,
        user_id: null, // Will be set on first login
        joined_at: new Date().toISOString(),
        default_password: password,
        current_password: password,
        password_changed: false
      })
      .select()
      .single();

    if (memberError) {
      console.error('Member creation error:', memberError);
      throw memberError;
    }

    console.log('Member created successfully:', member.id);

    // Send email with credentials
    const loginUrl = `${clientUrl}/login`;

    if (resend) {
      try {
        await resend.emails.send({
          from: 'ClickUp Clone <onboarding@resend.dev>',
          to: email,
          subject: 'Welcome! Your login credentials',
          html: getCredentialsEmailHtml(name, email, password, role, loginUrl)
        });
        console.log(`Credentials email sent to ${email}`);
      } catch (emailError) {
        console.error('Email sending failed:', emailError);
        // Don't fail the request if email fails
      }
    } else {
      console.log(`[SIMULATED EMAIL] Credentials sent to ${email}`);
      console.log(`[SIMULATED EMAIL] Password: ${password}`);
      console.log(`[SIMULATED EMAIL] Login URL: ${loginUrl}`);
    }

    res.json({
      message: 'Member created successfully',
      member: {
        ...member,
        // Don't return password in response
      }
    });
  } catch (error) {
    console.error('Create member error:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid request data', details: error.errors });
    } else {
      res.status(500).json({ error: 'Failed to create member' });
    }
  }
});

// Member login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    // Trim whitespace from email
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();

    console.log(`Login attempt for: ${trimmedEmail}`);

    // First, check if member exists in database
    const { data: member, error: memberError } = await supabaseAdmin
      .from('members')
      .select('*')
      .eq('email', trimmedEmail)
      .single();

    if (memberError || !member) {
      console.log('❌ Member not found:', trimmedEmail);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    console.log('✓ Member found:', member.email, 'Role:', member.role);

    // If member doesn't have user_id, try custom auth with stored password
    if (!member.user_id) {
      console.log(`Member ${trimmedEmail} has no auth user - using custom authentication`);
      console.log('Debug - Stored password:', member.current_password ? `[${member.current_password.length} chars]` : 'NULL');
      console.log('Debug - Input password:', trimmedPassword ? `[${trimmedPassword.length} chars]` : 'NULL');

      // Check if password is stored
      if (!member.current_password) {
        console.log('❌ No password stored for member');
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      // Verify password matches stored password
      if (member.current_password !== trimmedPassword) {
        console.log('❌ Password mismatch - login denied');
        console.log('Expected:', member.current_password);
        console.log('Received:', trimmedPassword);
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      console.log('✓ Password verified successfully');

      // Try to create auth user now
      console.log(`Attempting to create auth user for ${trimmedEmail}...`);
      const { data: authUser, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
        email: trimmedEmail,
        password: trimmedPassword,
        email_confirm: true,
        user_metadata: { name: member.name, role: member.role }
      });

      if (createAuthError) {
        console.error(`Failed to create auth user: ${createAuthError.message}`);

        // Set member status to active while logged in
        await supabaseAdmin
          .from('members')
          .update({ status: 'active' })
          .eq('id', member.id);
        member.status = 'active';
        console.log(`✓ Member status set to active (logged in)`);

        // Continue without auth user - return member data directly
        return res.json({
          message: 'Login successful (custom auth)',
          user: {
            id: member.id,
            email: member.email,
            user_metadata: { name: member.name, role: member.role }
          },
          session: null,
          member,
          customAuth: true
        });
      }

      // Update member with new user_id and set status to active (logged in)
      const { error: updateError } = await supabaseAdmin
        .from('members')
        .update({
          user_id: authUser.user.id,
          status: 'active'
        })
        .eq('id', member.id);

      if (updateError) {
        console.error(`Failed to update member with user_id:`, updateError);
      } else {
        console.log(`✓ Auth user created and linked to member`);
        member.user_id = authUser.user.id;
        member.status = 'active';
        console.log(`✓ Member status set to active (logged in)`);
      }

      // Sign in with the newly created user
      const { data: authData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
        email: trimmedEmail,
        password: trimmedPassword
      });

      if (signInError) {
        console.error(`Failed to sign in after creating user:`, signInError);
        return res.json({
          message: 'Login successful (custom auth)',
          user: authUser.user,
          session: null,
          member,
          customAuth: true
        });
      }

      return res.json({
        message: 'Login successful',
        user: authData.user,
        session: authData.session,
        member
      });
    }

    // Member has user_id - use normal Supabase auth
    console.log(`Member has user_id - using Supabase auth for ${trimmedEmail}`);
    const { data: authData, error: authError } = await supabaseAdmin.auth.signInWithPassword({
      email: trimmedEmail,
      password: trimmedPassword
    });

    if (authError) {
      console.log('❌ Supabase auth failed:', authError.message);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Set member status to active (currently logged in)
    await supabaseAdmin
      .from('members')
      .update({ status: 'active' })
      .eq('id', member.id);
    member.status = 'active';
    console.log(`✓ Member ${trimmedEmail} status set to active (logged in)`);

    res.json({
      message: 'Login successful',
      user: authData.user,
      session: authData.session,
      member
    });
  } catch (error) {
    console.error('Login error:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid request data' });
    } else {
      res.status(500).json({ error: 'Login failed' });
    }
  }
});

// Member logout
router.post('/logout', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }

    // Set member status to offline (logged out but has logged in before)
    const { error } = await supabaseAdmin
      .from('members')
      .update({ status: 'offline' })
      .eq('email', email);

    if (error) {
      console.error('Logout error:', error);
      return res.status(500).json({ error: 'Failed to update status' });
    }

    console.log(`✓ Member ${email} status set to offline (logged out)`);

    res.json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Change password
router.post('/change-password', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Authorization required' });
    }

    const token = authHeader.replace('Bearer ', '');

    // Verify current session
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid session' });
    }

    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    // Update password in Supabase Auth
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      { password: newPassword }
    );

    if (updateError) {
      return res.status(400).json({ error: updateError.message || 'Failed to change password' });
    }

    // Update password in members table for admin reference
    await supabaseAdmin
      .from('members')
      .update({
        current_password: newPassword,
        password_changed: true,
        password_changed_at: new Date().toISOString()
      })
      .eq('user_id', user.id);

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Update member (role, etc.) - Only Owner/Admin can update roles
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Get the requesting user from authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Authorization required' });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !requestingUser) {
      return res.status(401).json({ error: 'Invalid session' });
    }

    // Check if requesting user is Owner or Admin
    const isOwner = requestingUser.email === OWNER_EMAIL;

    if (!isOwner) {
      // Check if user is admin
      const { data: requestingMember } = await supabaseAdmin
        .from('members')
        .select('role')
        .eq('user_id', requestingUser.id)
        .single();

      const isAdmin = requestingMember?.role === 'admin';

      if (!isAdmin) {
        return res.status(403).json({ error: 'Only Owner or Admin can update member roles' });
      }
    }

    // Don't allow updating sensitive fields
    delete updates.user_id;
    delete updates.email;
    delete updates.default_password;
    delete updates.current_password;

    if (updates.role === 'guest' && !updates.guest_permission) {
      updates.guest_permission = 'view_only';
    }
    if (updates.role && updates.role !== 'guest') {
      updates.guest_permission = null;
    }
    if (updates.guest_permission && !['full_edit', 'edit', 'view_only'].includes(updates.guest_permission)) {
      return res.status(400).json({ error: 'Invalid guest permission level' });
    }

    const { data, error } = await supabaseAdmin
      .from('members')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // If role is updated, also update user metadata
    if (updates.role && data.user_id) {
      await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
        user_metadata: { role: updates.role }
      });
    }

    res.json(data);
  } catch (error) {
    console.error('Update member error:', error);
    res.status(500).json({ error: 'Failed to update member' });
  }
});

// Remove member - Only Owner/Admin can remove members
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Get the requesting user from authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Authorization required' });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !requestingUser) {
      return res.status(401).json({ error: 'Invalid session' });
    }

    // Check if requesting user is Owner or Admin
    const isOwner = requestingUser.email === OWNER_EMAIL;

    if (!isOwner) {
      const { data: requestingMember } = await supabaseAdmin
        .from('members')
        .select('role')
        .eq('user_id', requestingUser.id)
        .single();

      if (requestingMember?.role !== 'admin') {
        return res.status(403).json({ error: 'Only Owner or Admin can remove members' });
      }
    }

    // Get member to find user_id
    const { data: member } = await supabaseAdmin
      .from('members')
      .select('user_id')
      .eq('id', id)
      .single();

    // Delete from members table
    const { error } = await supabaseAdmin
      .from('members')
      .delete()
      .eq('id', id);

    if (error) throw error;

    // Also delete auth user if exists
    if (member?.user_id) {
      await supabaseAdmin.auth.admin.deleteUser(member.user_id);
    }

    res.json({ message: 'Member removed successfully' });
  } catch (error) {
    console.error('Delete member error:', error);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

// Reset password (admin resets member password)
router.post('/:id/reset-password', async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Get member
    const { data: member, error: findError } = await supabaseAdmin
      .from('members')
      .select('*')
      .eq('id', id)
      .single();

    if (findError || !member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    if (!member.user_id) {
      return res.status(400).json({ error: 'Member has no user account' });
    }

    // Update password in Supabase Auth
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      member.user_id,
      { password: newPassword }
    );

    if (updateError) {
      return res.status(400).json({ error: updateError.message || 'Failed to reset password' });
    }

    // Update password in members table for admin reference
    await supabaseAdmin
      .from('members')
      .update({
        current_password: newPassword,
        password_changed: false, // Reset since admin changed it
        password_changed_at: new Date().toISOString()
      })
      .eq('id', id);

    // Send email with new password
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const loginUrl = `${clientUrl}/login`;

    if (resend) {
      try {
        await resend.emails.send({
          from: 'ClickUp Clone <onboarding@resend.dev>',
          to: member.email,
          subject: 'Your password has been reset',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2>Password Reset</h2>
              <p>Hi ${member.name},</p>
              <p>Your password has been reset by an administrator.</p>
              <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0;"><strong>New Password:</strong> <code>${newPassword}</code></p>
              </div>
              <p><a href="${loginUrl}" style="display: inline-block; background: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Login Now</a></p>
              <p style="color: #666; font-size: 14px;">Please change your password after logging in.</p>
            </div>
          `
        });
      } catch (emailError) {
        console.error('Email sending failed:', emailError);
      }
    } else {
      console.log(`[SIMULATED EMAIL] Password reset for ${member.email}`);
      console.log(`[SIMULATED EMAIL] New Password: ${newPassword}`);
    }

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

export default router;
