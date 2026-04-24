import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import db from '../db/connection.ts';
import { validateId } from '../middleware/validation.js';
import { requireAdmin } from '../middleware/auth.ts';
import { AuditRepository } from '../db/repositories/AuditRepository.ts';

const router = Router();

interface CustomerRow {
  id: string;
  name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  country: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface Customer {
  id: string;
  name: string;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  country: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

function dbRowToCustomer(row: CustomerRow | null | undefined): Customer | null {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    contactPerson: row.contact_person,
    email: row.email,
    phone: row.phone,
    address: row.address,
    country: row.country,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const COLUMNS = 'id, name, contact_person, email, phone, address, country, notes, created_at, updated_at';

const handleValidation = (req: Request, res: Response): boolean => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map((err: any) => ({
        field: err.param || err.path,
        message: err.msg,
        value: err.value,
      })),
    });
    return false;
  }
  return true;
};

const customerValidators = [
  body('name').trim().notEmpty().withMessage('Customer name is required'),
  body('email').optional({ nullable: true }).isEmail().withMessage('Invalid email format'),
  body('phone').optional({ nullable: true }).trim(),
  body('country').optional({ nullable: true }).trim(),
  body('notes').optional({ nullable: true }).trim(),
];

// GET /api/customers
router.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await db.query(`SELECT ${COLUMNS} FROM customers ORDER BY name`);
    res.json(result.rows.map((row: CustomerRow) => dbRowToCustomer(row)));
  } catch (error) {
    console.error('Error reading customers:', error);
    res.status(500).json({ error: 'Failed to read customers' });
  }
});

// GET /api/customers/:id
router.get('/:id', validateId, async (req: Request, res: Response) => {
  try {
    const result = await db.query(`SELECT ${COLUMNS} FROM customers WHERE id = $1`, [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    res.json(dbRowToCustomer(result.rows[0] as CustomerRow));
  } catch (error) {
    console.error('Error reading customer:', error);
    res.status(500).json({ error: 'Failed to read customer' });
  }
});

// POST /api/customers
router.post('/', requireAdmin, ...customerValidators, async (req: Request, res: Response) => {
  try {
    if (!handleValidation(req, res)) return;

    const id: string = req.body.id || Date.now().toString();

    const insertResult = await db.query(
      `INSERT INTO customers (id, name, contact_person, email, phone, address, country, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (name) DO NOTHING
       RETURNING ${COLUMNS}`,
      [
        id,
        req.body.name,
        req.body.contactPerson || null,
        req.body.email || null,
        req.body.phone || null,
        req.body.address || null,
        req.body.country || null,
        req.body.notes || null,
      ]
    );

    const result = insertResult.rows.length > 0
      ? insertResult
      : await db.query(`SELECT ${COLUMNS} FROM customers WHERE name = $1`, [req.body.name]);
    const customer = dbRowToCustomer(result.rows[0] as CustomerRow);

    const user = (req as any).user;
    if (user) {
      AuditRepository.logAudit(
        user.id,
        user.username || user.email,
        'create',
        'customer',
        id,
        req.body.name,
        { name: req.body.name, email: req.body.email, country: req.body.country }
      );
    }

    res.status(201).json(customer);
  } catch (error) {
    console.error('Error creating customer:', error);
    res.status(500).json({ error: 'Failed to create customer' });
  }
});

// PUT /api/customers/:id
router.put('/:id', requireAdmin, ...customerValidators.map(v => v.optional()), async (req: Request, res: Response) => {
  try {
    if (!handleValidation(req, res)) return;

    await db.query(
      `UPDATE customers SET
        name = COALESCE($1, name),
        contact_person = COALESCE($2, contact_person),
        email = COALESCE($3, email),
        phone = COALESCE($4, phone),
        address = COALESCE($5, address),
        country = COALESCE($6, country),
        notes = COALESCE($7, notes),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $8`,
      [
        req.body.name,
        req.body.contactPerson,
        req.body.email,
        req.body.phone,
        req.body.address,
        req.body.country,
        req.body.notes,
        req.params.id,
      ]
    );

    const result = await db.query(`SELECT ${COLUMNS} FROM customers WHERE id = $1`, [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    const customer = dbRowToCustomer(result.rows[0] as CustomerRow);

    const user = (req as any).user;
    if (user && customer) {
      AuditRepository.logAudit(
        user.id,
        user.username || user.email,
        'update',
        'customer',
        req.params.id,
        customer.name || req.params.id,
        req.body
      );
    }

    res.json(customer);
  } catch (error) {
    console.error('Error updating customer:', error);
    res.status(500).json({ error: 'Failed to update customer' });
  }
});

// DELETE /api/customers/:id
router.delete('/:id', requireAdmin, validateId, async (req: Request, res: Response) => {
  try {
    const result = await db.query('DELETE FROM customers WHERE id = $1 RETURNING id, name', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const user = (req as any).user;
    if (user) {
      AuditRepository.logAudit(
        user.id,
        user.username || user.email,
        'delete',
        'customer',
        req.params.id,
        result.rows[0].name || req.params.id,
        null
      );
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting customer:', error);
    res.status(500).json({ error: 'Failed to delete customer' });
  }
});

export default router;
