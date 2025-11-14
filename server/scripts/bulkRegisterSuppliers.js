// Bulk register all suppliers with auto-generated credentials
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import pool from '../db/connection.js';

// Load environment variables
dotenv.config();

// Generate a secure random password
function generatePassword(length = 16) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return password;
}

// Generate email from supplier name
function generateEmail(supplierName, supplierId) {
  const sanitized = supplierName
    .toLowerCase()
    .replace(/\s+/g, '.')
    .replace(/[^a-z0-9.]/g, '');
  return `admin@${sanitized}.supplier`;
}

async function bulkRegisterSuppliers() {
  try {
    console.log('🔄 Starting bulk supplier registration...\n');

    // Get all suppliers
    const suppliersResult = await pool.query(
      'SELECT id, name FROM suppliers ORDER BY id'
    );

    if (suppliersResult.rows.length === 0) {
      console.log('❌ No suppliers found in database');
      process.exit(1);
    }

    const suppliers = suppliersResult.rows;
    const credentials = [];
    let successCount = 0;
    let skipCount = 0;

    console.log(`Found ${suppliers.length} suppliers. Registering...\n`);

    // Register each supplier
    for (const supplier of suppliers) {
      try {
        // Check if already registered
        const existingCheck = await pool.query(
          'SELECT id FROM supplier_accounts WHERE supplier_id = $1',
          [supplier.id]
        );

        if (existingCheck.rows.length > 0) {
          console.log(`⏭️  SKIP: ${supplier.name} (${supplier.id}) - Already registered`);
          skipCount++;
          credentials.push({
            supplier: supplier.name,
            supplierId: supplier.id,
            status: 'SKIPPED',
            reason: 'Already has account'
          });
          continue;
        }

        // Generate credentials
        const email = generateEmail(supplier.name, supplier.id);
        const password = generatePassword();
        const passwordHash = await bcrypt.hash(password, 10);

        // Register account
        await pool.query(
          `INSERT INTO supplier_accounts (supplier_id, email, password_hash, is_verified, is_active)
           VALUES ($1, $2, $3, true, true)`,
          [supplier.id, email, passwordHash]
        );

        console.log(`✅ REGISTERED: ${supplier.name} (${supplier.id})`);
        successCount++;

        credentials.push({
          supplier: supplier.name,
          supplierId: supplier.id,
          email: email,
          password: password,
          status: 'SUCCESS'
        });
      } catch (error) {
        if (error.code === '23505') {
          console.log(`⏭️  SKIP: ${supplier.name} - Email already exists`);
          skipCount++;
        } else {
          console.error(`❌ ERROR: ${supplier.name} -`, error.message);
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 REGISTRATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Successfully registered: ${successCount}`);
    console.log(`⏭️  Skipped: ${skipCount}`);
    console.log(`📦 Total suppliers: ${suppliers.length}\n`);

    // Display credentials
    console.log('🔐 SUPPLIER CREDENTIALS');
    console.log('='.repeat(60));
    console.log('Save these credentials securely!\n');

    credentials.forEach((cred, index) => {
      if (cred.status === 'SUCCESS') {
        console.log(`${index + 1}. ${cred.supplier}`);
        console.log(`   Supplier ID: ${cred.supplierId}`);
        console.log(`   Email: ${cred.email}`);
        console.log(`   Password: ${cred.password}`);
        console.log(`   Status: ✅ ${cred.status}\n`);
      }
    });

    console.log('='.repeat(60));
    console.log('✨ Bulk registration complete!\n');
    console.log('Next steps:');
    console.log('1. Share these credentials with each supplier');
    console.log('2. Suppliers can now login at: /supplier');
    console.log('3. They can view their shipments and upload documents\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

// Run if executed directly
bulkRegisterSuppliers();
