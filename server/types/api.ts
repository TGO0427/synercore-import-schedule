/**
 * API-specific type definitions
 * Types for request/response handling, validation, and API contracts
 */

import type { Request, Response, NextFunction } from 'express';
import type { JwtPayload } from './index.js';

/**
 * Route handler types
 */
export type AsyncRouteHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void>;

export type SyncRouteHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => void;

export type RouteHandler = AsyncRouteHandler | SyncRouteHandler;

/**
 * Middleware types
 */
export type Middleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => void | Promise<void>;

export type ErrorMiddleware = (
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction
) => void;

/**
 * Request parameter types
 */
export interface RequestParams {
  [key: string]: string;
}

/**
 * Query parameters
 */
export interface QueryParams {
  page?: string | number;
  limit?: string | number;
  sort?: string;
  search?: string;
  [key: string]: any;
}

/**
 * Request body validation schema
 */
export interface ValidationSchema {
  [key: string]: {
    required?: boolean;
    type?: string;
    min?: number;
    max?: number;
    pattern?: RegExp;
    custom?: (value: any) => boolean;
  };
}

/**
 * Validation error
 */
export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

/**
 * Standard paginated request
 */
export interface PaginatedRequest extends Request {
  query: QueryParams & {
    page?: string | number;
    limit?: string | number;
  };
}

/**
 * Authenticated request with user
 */
export interface TypedAuthenticatedRequest<T = any> extends Request {
  user?: JwtPayload;
  body: T;
}

/**
 * Request with parameters
 */
export interface ParamRequest<T extends RequestParams = any> extends Request {
  params: T;
}

/**
 * Request with typed body
 */
export interface BodyRequest<T = any> extends Request {
  body: T;
}

/**
 * List endpoint response
 */
export interface ListResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

/**
 * Create endpoint response
 */
export interface CreateResponse<T> {
  data: T;
  message?: string;
}

/**
 * Update endpoint response
 */
export interface UpdateResponse<T> {
  data: T;
  message?: string;
}

/**
 * Delete endpoint response
 */
export interface DeleteResponse {
  message: string;
  id?: string;
}

/**
 * File upload response
 */
export interface FileUploadResponse {
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
}

/**
 * Webhook payload
 */
export interface WebhookPayload {
  event: string;
  timestamp: string;
  data: any;
}

/**
 * Rate limit info
 */
export interface RateLimitInfo {
  limit: number;
  current: number;
  remaining: number;
  resetTime: number;
}
