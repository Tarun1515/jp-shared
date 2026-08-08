/**
 * The response envelope every backend endpoint returns.
 * Mirrors JP.Core.Common.Response<T> exactly — keep the two in step.
 */
export interface ApiResponse<T> {
  /** 1 = success, 0 = failure. */
  status: number;

  /**
   * Machine-readable outcome code, e.g. 'ACCOUNT_PENDING'.
   * Branch on this — never on `message`, which is display text and will change.
   */
  code: string | null;

  /** Human-readable text, safe to show the user. */
  message: string;

  data: T | null;

  /** Total rows before paging. Meaningful on list endpoints only. */
  totalRecords: number;

  /** Field-level validation errors, keyed by property name. */
  errors: Record<string, string[]> | null;
}

/** One page of results. Mirrors JP.Domain.Common.PagedResult<T>. */
export interface PagedResult<T> {
  items: T[];
  totalRecords: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
}

/** Base query string for any list endpoint. Mirrors JP.Domain.Common.PagedRequest. */
export interface PagedRequest {
  pageNumber?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortDirection?: 'ASC' | 'DESC';
}

export const RESPONSE_STATUS = {
  failure: 0,
  success: 1,
} as const;
