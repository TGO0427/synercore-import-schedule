import { Router, Request, Response } from 'express';
import { AuditRepository } from '../db/repositories/AuditRepository.ts';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const { entityType, action, userId, startDate, endDate, limit, offset } = req.query;
    const result = await AuditRepository.getAuditLog({
      entityType: entityType as string,
      action: action as string,
      userId: userId as string,
      startDate: startDate as string,
      endDate: endDate as string,
      limit: limit ? parseInt(limit as string, 10) : 50,
      offset: offset ? parseInt(offset as string, 10) : 0,
    });
    res.json(result);
  } catch (error) {
    console.error('Error fetching audit log:', error);
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});

export default router;
