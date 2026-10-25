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

  /*
    SR-1. Between district and city, and optional — see ADDRESS_DESIGN.md.
    Empty for every state except Haryana today, which is the same correct
    degradation district and city have had since 2.47.
  */
  tehsil: 'tehsil',
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

    🔴 `application-status` RETURNS ALL TEN AS OF PHASE 6A, and this note used
    to say six.

    5B shipped it returning the six reachable statuses, with the reason written
    here: seven to ten were the offer chain, seeded so their ids could never
    move and refused outright by the transition map, and a filter offering one
    of them could only ever return an empty list — indistinguishable from a
    broken screen.

    ⚠️ 6A made all four reachable (t_app_offers, and the map's 5→7→8→10 chain),
    and flipped their IsReachable flag in the same change. The master's
    whitelist branch reads that flag, so the endpoint started returning ten the
    day offers shipped — and this comment kept promising six for two phases.
    Found in 6C-2 while wiring the search screen's filters.

    🔴 The lesson is the one G26 and G30 both record: a statement about shipped
    behaviour is a thing that rots. The flag is the source of truth; this is
    prose about it, so it has to be re-read whenever the flag moves.

    ⚠️ The names it returns are the SCHOOL's. A teacher is shown
    TeacherFacingName — "Not selected", not "Rejected" — and every teacher-side
    row already carries its own, so no teacher screen reads this key.
  */
  employmentType: 'employment-type',
  jobStatus: 'job-status',
  applicationStatus: 'application-status',

  /*
    Phase 6A, 6B and 6C — offers, invitations and notifications (all jp_app).

    🔴 Each is in the API's master whitelist in the same commit as its table
    (2.68, and the APPLICATION_STATUS lesson: that one shipped in 5A and was not
    served until 5B, where the only symptom was a hardcoded filter nobody could
    see was hardcoded). These three are the client half of the same rule.

    ⚠️ `invite-status` returns the SCHOOL's names. The teacher's own wording —
    "You passed on this" rather than "Ignored" — travels on each of their rows
    from USP_GetMyInvites, so no teacher screen reads this key either.

    ⚠️ `notification-type` deliberately returns only id, code, name and order.
    Who else receives a kind of event, and whether it also leaves by email, are
    facts about the product that a client has no use for and no business
    reading (015).
  */
  offerStatus: 'offer-status',
  inviteStatus: 'invite-status',
  notificationType: 'notification-type',

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
