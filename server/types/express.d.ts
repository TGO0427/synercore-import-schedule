/**
 * Express type extensions
 * Extends Express Request and Response objects with custom properties
 */

import type { JwtPayload } from './index.js';

declare global {
  namespace Express {
    interface Request {
      /** Unique request ID for tracking */
      id?: string;
      /** Authenticated user information from JWT */
      user?: JwtPayload;
      /** Custom request properties */
      customData?: any;
    }

    interface Response {
      /** Request ID for correlation */
      requestId?: string;
    }
  }
}

export {};
