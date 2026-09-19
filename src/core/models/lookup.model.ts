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

  /*
    jobs and applications.

    🔴 `employment-type` and `job-status` live in jp_app, not jp_mdm — the
    tables that point at them carry physical foreign keys and a physical FK may
    not cross a database. That is invisible from here on purpose: the URL, the
    response shape and the hour of caching are identical, and a component
    asking for a dropdown has no business knowing which database answered.
    See PROJECT_MEMORY G26 / decision 2.68.

    🔴 `application-status` IS served as of Phase 5B, and it returns the SIX
    REACHABLE statuses only. The master holds ten; seven to ten are the offer
    chain, seeded so their ids never move and refused by the transition map
    until Phase 6. A filter offering one of them could only ever return an
    empty list, which is indistinguishable from a broken screen.

    ⚠️ The names it returns are the SCHOOL's. A teacher is shown
    TeacherFacingName — "Not selected", not "Rejected" — and every teacher-side
    row already carries its own, so no teacher screen reads this key.
  */
  employmentType: 'employment-type',
  jobStatus: 'job-status',
  applicationStatus: 'application-status',

  /*
    The entitlement ledger's own vocabulary (jp_app). Reference data — the
    NAMES of entry kinds and pockets — for a ledger screen to render with.

    🔴 NOT gating data. Feature modes and plan quotas (`m_mdm_features`,
    `m_mdm_plan_features`) are read uncached through the entitlement endpoints
    and must NEVER come through MasterService, which caches for an hour. A kill
    switch with an hour of lag is not a kill switch (MONETIZATION_DESIGN).
  */
  ledgerEntryType: 'ledger-entry-type',
  ledgerSource: 'ledger-source',
  refEntityType: 'ref-entity-type',

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
