/**
 * User repository
 * Handles all user-related database operations
 */

import type { User, UserRole } from '../../types/index.js';
import BaseRepository from './BaseRepository.js';
import { queryOne, queryAll } from '../connection.js';

/**
 * User filter options
 */
export interface UserFilter {
  role?: UserRole;
  supplier_id?: string;
}

/**
 * User repository class
 */
export class UserRepository extends BaseRepository<User> {
  protected tableName = 'users';
  protected columns = [
    'id',
    'username',
    'email',
    'password_hash',
    'full_name',
    'role',
    'supplier_id',
    'created_at',
    'updated_at',
    'last_login'
  ];

  /**
   * Find user by username
   */
  async findByUsername(username: string): Promise<User | null> {
    const sql = `
      SELECT ${this.columns.join(', ')}
      FROM ${this.tableName}
      WHERE username = $1
    `;

    return queryOne<User>(sql, [username]);
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    const sql = `
      SELECT ${this.columns.join(', ')}
      FROM ${this.tableName}
      WHERE email = $1
    `;

    return queryOne<User>(sql, [email]);
  }

  /**
   * Find users by role
   */
  async findByRole(role: UserRole): Promise<User[]> {
    const sql = `
      SELECT ${this.columns.join(', ')}
      FROM ${this.tableName}
      WHERE role = $1
      ORDER BY created_at DESC
    `;

    return queryAll<User>(sql, [role]);
  }

  /**
   * Find supplier users by supplier ID
   */
  async findBySupplier(supplierId: string): Promise<User[]> {
    const sql = `
      SELECT ${this.columns.join(', ')}
      FROM ${this.tableName}
      WHERE supplier_id = $1 AND role = 'supplier'
      ORDER BY created_at DESC
    `;

    return queryAll<User>(sql, [supplierId]);
  }

  /**
   * Check if username exists
   */
  async usernameExists(username: string): Promise<boolean> {
    return this.exists({ username });
  }

  /**
   * Check if email exists
   */
  async emailExists(email: string): Promise<boolean> {
    return this.exists({ email });
  }

  /**
   * Update password hash
   */
  async updatePassword(id: string, passwordHash: string): Promise<User> {
    const sql = `
      UPDATE ${this.tableName}
      SET password_hash = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING ${this.columns.join(', ')}
    `;

    const result = await queryOne<User>(sql, [passwordHash, id]);

    if (!result) {
      throw new Error('User not found');
    }

    return result;
  }

  /**
   * Update last login timestamp
   */
  async updateLastLogin(id: string): Promise<User> {
    const sql = `
      UPDATE ${this.tableName}
      SET last_login = NOW()
      WHERE id = $1
      RETURNING ${this.columns.join(', ')}
    `;

    const result = await queryOne<User>(sql, [id]);

    if (!result) {
      throw new Error('User not found');
    }

    return result;
  }

  /**
   * Update user role
   */
  async updateRole(id: string, role: UserRole): Promise<User> {
    const sql = `
      UPDATE ${this.tableName}
      SET role = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING ${this.columns.join(', ')}
    `;

    const result = await queryOne<User>(sql, [role, id]);

    if (!result) {
      throw new Error('User not found');
    }

    return result;
  }

  /**
   * Get admin count
   */
  async getAdminCount(): Promise<number> {
    return this.count({ role: 'admin' });
  }

  /**
   * Get user statistics
   */
  async getStatistics() {
    const sql = `
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN role = 'admin' THEN 1 END) as admins,
        COUNT(CASE WHEN role = 'user' THEN 1 END) as regular_users,
        COUNT(CASE WHEN role = 'supplier' THEN 1 END) as suppliers,
        COUNT(CASE WHEN last_login IS NOT NULL THEN 1 END) as active
      FROM ${this.tableName}
    `;

    const result = await queryOne<{
      total: string;
      admins: string;
      regular_users: string;
      suppliers: string;
      active: string;
    }>(sql);

    return {
      total: parseInt(result?.total || '0', 10),
      admins: parseInt(result?.admins || '0', 10),
      regularUsers: parseInt(result?.regular_users || '0', 10),
      suppliers: parseInt(result?.suppliers || '0', 10),
      active: parseInt(result?.active || '0', 10)
    };
  }

  /**
   * Search users
   */
  async search(query: string): Promise<User[]> {
    const searchTerm = `%${query}%`;
    const sql = `
      SELECT ${this.columns.join(', ')}
      FROM ${this.tableName}
      WHERE username ILIKE $1
        OR email ILIKE $1
        OR full_name ILIKE $1
      ORDER BY created_at DESC
      LIMIT 50
    `;

    return queryAll<User>(sql, [searchTerm]);
  }

  /**
   * Get all users sorted by username
   */
  async findAllSorted(): Promise<User[]> {
    const sql = `
      SELECT ${this.columns.join(', ')}
      FROM ${this.tableName}
      ORDER BY username ASC
    `;

    return queryAll<User>(sql);
  }
}

export default new UserRepository();
