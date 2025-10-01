import bcrypt from 'bcryptjs';
import pool from '../db/connection.js';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function createAdminUser() {
  try {
    console.log('\n🔐 Create Admin User\n');
    console.log('This script will create an admin user for your system.\n');

    const username = await question('Enter username: ');
    const email = await question('Enter email (optional): ');
    const password = await question('Enter password: ');
    const fullName = await question('Enter full name (optional): ');

    if (!username || !password) {
      console.error('❌ Username and password are required!');
      rl.close();
      process.exit(1);
    }

    // Check if user already exists
    const existing = await pool.query(
      'SELECT id FROM users WHERE username = $1',
      [username]
    );

    if (existing.rows.length > 0) {
      console.error(`❌ User '${username}' already exists!`);
      rl.close();
      process.exit(1);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const id = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await pool.query(
      `INSERT INTO users (id, username, email, password_hash, full_name, role, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, username, email || null, passwordHash, fullName || null, 'admin', true]
    );

    console.log('\n✅ Admin user created successfully!');
    console.log(`\nUsername: ${username}`);
    console.log(`Email: ${email || 'N/A'}`);
    console.log(`Role: admin\n`);

    rl.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    rl.close();
    process.exit(1);
  }
}

createAdminUser();
