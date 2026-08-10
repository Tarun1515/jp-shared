/**
 * One row of a master table, shaped for a dropdown.
 * Mirrors JP.Domain.Common.LookupDto.
 */
export interface Lookup {
  id: number;
  code: string;
  name: string;
  displayOrder: number;

  /** Parent key for dependent dropdowns — state within country, and so on. */
  parentId: number | null;
}

/**
 * Master keys accepted by GET /api/masters/{masterKey}.
 *
 * The server holds the authoritative whitelist; this mirrors it so a typo in a
 * component is a compile error rather than a 404 at runtime.
 *
 * No dropdown in this application is hardcoded — every one resolves through
 * here.
 */
export const MASTER_KEYS = {
  // geography
  country: 'country',
  state: 'state',
  district: 'district',
  city: 'city',

  // education
  board: 'board',
  schoolType: 'school-type',
  qualification: 'qualification',
  subject: 'subject',
  designation: 'designation',
  classLevel: 'class-level',
  stream: 'stream',

  // profile
  gender: 'gender',
  skill: 'skill',
  language: 'language',
  facility: 'facility',
  experienceRange: 'experience-range',

  // jobs and applications
  employmentType: 'employment-type',
  jobStatus: 'job-status',
  applicationStatus: 'application-status',

  // moderation
  reportReason: 'report-reason',
  reportStatus: 'report-status',

  // approval engine — used by the admin verification screens
  requestType: 'request-type',
  approvalStatus: 'approval-status',
  actionType: 'action-type',
  documentType: 'document-type',

  /** ⚠️ Scoped by request type. Pass the request type id as the parent. */
  rejectionReason: 'rejection-reason',

  // payments
  paymentMode: 'payment-mode',
  paymentStatus: 'payment-status',
} as const;

export type MasterKey = (typeof MASTER_KEYS)[keyof typeof MASTER_KEYS];
