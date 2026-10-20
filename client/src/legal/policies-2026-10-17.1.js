// Versioned document snapshot. Publish a new file/version for substantive changes.
export const termsSections = [
  { id: 'purpose', title: '1. About SafeLink', paragraphs: [
    'SafeLink is a web-based verified community safety reporting and assistance system for Pangasinan, Philippines. It supports incident submission, review, updates and coordination through authorized accounts. Access to this platform does not establish a government partnership or guarantee agency participation.'
  ] },
  { id: 'accounts', title: '2. Eligibility and account responsibilities', paragraphs: [
    'Use SafeLink only when permitted by applicable law. Provide accurate registration details, verify your email and keep your credentials private. Do not share an account, impersonate another person or attempt to access another account or jurisdiction. Sign out on shared devices and use the recovery process if you suspect unauthorized access.',
    'Public registration creates Citizen accounts only. Government personnel accounts are created by an authorized System Administrator. Changing an initial personnel password is optional through Account Settings. Age eligibility and any guardian-authorization procedure require operator and legal review before public deployment.'
  ] },
  { id: 'truthful-reports', title: '3. Truthful and respectful reporting', paragraphs: [
    'Report what you reasonably believe to be true. Distinguish observations from assumptions, describe uncertainty and provide the most accurate location available. Do not submit knowingly false, misleading, fabricated, malicious, discriminatory, threatening or abusive reports. Do not use reports to harass others, publish private information or settle personal disputes. An honest mistake should be clarified through authorized follow-up.'
  ] },
  { id: 'evidence', title: '4. Photos, videos and other people’s privacy', paragraphs: [
    'Only submit evidence relevant to the incident that you may lawfully provide. Do not put yourself or others at risk to collect it. Avoid unnecessary faces, identity documents, private conversations, contact details and sensitive images, especially involving children or vulnerable people. Do not submit unlawful material or evidence you have deceptively altered. Explain relevant context and do not publicly redistribute private report information.'
  ] },
  { id: 'review', title: '5. Review, verification and response', paragraphs: [
    'Submission creates a report for authorized review; it does not establish that an allegation is proven. Personnel may review details, request clarification, route a report or update its status according to their assigned role and jurisdiction. Outcomes depend on the information supplied and the actions of the responsible people and agencies. A status update is not a legal finding or a promise of a particular outcome.'
  ] },
  { id: 'community-map', title: '6. Community maps and public information', paragraphs: [
    'Public maps provide a limited community view, not a complete or real-time account of incidents. The public feed uses generalized locations and selected summaries or aggregates; it excludes reporter identities, contact details, private evidence and exact source coordinates. Sensitive categories and unsuitable reports may be withheld. Public entries may be delayed, corrected or withdrawn. Do not use map markers to identify people, establish fault or determine an emergency route.'
  ] },
  { id: 'misuse', title: '7. Restrictions and misuse', paragraphs: [
    'Authorized account management may restrict or suspend access for misuse, compromised credentials or inappropriate access. Do not bypass access restrictions, interfere with the service or probe accounts without authorization. Specific investigation, notification and appeal procedures must be confirmed by the project operator; these terms do not remove rights available under applicable law.'
  ] },
  { id: 'emergencies', title: '8. Emergencies and service limitations', paragraphs: [
    'SafeLink does not replace official emergency services or emergency dispatch. If there is an immediate threat to life, safety or property, contact the appropriate emergency authority directly. Do not wait for a SafeLink acknowledgment or dashboard update.',
    'Availability, review times and responses depend on connectivity, staffing, report quality and operational circumstances. SafeLink does not guarantee continuous availability, a response time, dispatch, assistance or an agency action. Nothing here excludes a responsibility that applicable law does not allow to be excluded.'
  ] },
  { id: 'changes', title: '9. Changes to these terms', paragraphs: [
    'The current version and last updated date are shown on this page. New Citizen registration records the accepted version and acceptance time. A later material revision should be published as a new version with appropriate notice and, where necessary, renewed acceptance. This implementation does not fabricate acceptance for existing users or require them to accept a new version at login.'
  ] },
  { id: 'contact', title: '10. Questions and verified contact details', paragraphs: [
    'A verified SafeLink operator contact and formal account-review channel have not yet been confirmed for publication. Use only a contact channel independently confirmed by the project operator. Do not send passwords, reset links or sensitive evidence to an unverified address. The operator must supply verified contact and organizational details before public deployment. For emergencies, use official emergency channels rather than a policy inquiry.'
  ] }
];

export const privacySections = [
  { id: 'scope', title: '1. Scope and privacy principles', paragraphs: [
    'This notice describes the current SafeLink implementation. Its privacy approach is informed by transparency, legitimate purpose and proportionality under the Philippine Data Privacy Act of 2012 (Republic Act No. 10173). Publication of this notice is not a certification of legal compliance. The operator must confirm its lawful bases for processing, controller identity and responsibilities before public deployment.'
  ] },
  { id: 'information', title: '2. Information collected', paragraphs: [
    'Citizen registration collects first and last name, optional middle initial, email address, mobile number and residential city or municipality, barangay and required street address within Pangasinan. A landmark may be provided and the municipality determines a ZIP code. The account stores a password hash, account role, status and verification state; new Citizen accounts also record the Terms version accepted, Privacy Policy version acknowledged and server acceptance timestamp.',
    'Reports may contain incident category, description, address, map coordinates, submitted photos or videos, and response or status history. These details can reveal information about reporters, witnesses or other people. Provide only relevant information you may lawfully share.',
    'Authentication and security processing includes verification and recovery records, session tokens, login timestamps and audit events. Audit records identify relevant account actions and outcomes. These are distinct from publicly displayed report information.'
  ] },
  { id: 'purposes', title: '3. Why information is processed', paragraphs: [
    'Information supports account creation and email verification, authentication, password recovery, report review and routing, authorized follow-up, status updates, jurisdiction checks, misuse detection and operational accountability. Limited map information helps users understand community concerns without publishing private reports.',
    'Acknowledging this notice does not authorize unrelated optional processing. Any optional purpose requiring consent must be separately explained and offered with a distinct choice. The operator must document the applicable lawful basis for each purpose, including any handling of sensitive personal information.'
  ] },
  { id: 'access', title: '4. Who can access information', paragraphs: [
    'Citizens access their own account and reports. Authorized Barangay, LGU and Police personnel use role and jurisdiction restrictions for operational access; Police incident access also depends on assignment. System Administrator accounts perform permitted account, oversight and audit functions. The backend verifies the current account and its permissions. These controls limit access; they are not a promise of anonymity to authorized reviewers.',
    'The operator must confirm authorized staff responsibilities, confidentiality procedures and any disclosure to another organization or authority. No government partnership or unrestricted inter-agency sharing is implied by the account roles.'
  ] },
  { id: 'public-maps', title: '5. Public maps and evidence protection', paragraphs: [
    'Public incident feeds omit reporter names, contact details, descriptions, evidence and exact private coordinates. Published views use generalized locations and limited fields or aggregates. Only eligible categories and statuses are considered, and entries can be withheld or withdrawn. Raw evidence is accessed through protected application routes rather than a public evidence listing. Public maps remain incomplete and should not be used to identify individuals.'
  ] },
  { id: 'security', title: '6. Storage and security', paragraphs: [
    'Account and report records use MongoDB. The current implementation hashes passwords with bcrypt, uses JWT authentication, checks roles and jurisdictions, limits failed login attempts and records audit activity. Initial administrator-created personnel passwords are shown once during the protected creation handoff and are not stored in readable form. Browser session storage holds the authenticated session and cached account information until cleared or the session ends.',
    'No system can guarantee absolute security. Deployment-specific HTTPS, encryption at rest, hosting location, backup safeguards, access reviews, vulnerability management and breach-response arrangements require operator verification. This notice does not claim these deployment controls have already been audited.'
  ] },
  { id: 'providers', title: '7. Email, maps and external services', paragraphs: [
    'The application uses configured email delivery for account verification and recovery. Depending on configuration, browsers request map tiles from OpenStreetMap or CARTO and fonts from Google Fonts; those providers receive normal connection information such as IP addresses. Street suggestions use a server request to an Overpass provider scoped to a selected geographic area. Provider availability is not guaranteed.',
    'Provider terms, hosting arrangements, possible transfers and data-processing agreements require deployment review. Do not send private incident content through external links or unverified contacts.'
  ] },
  { id: 'retention', title: '8. Retention and deletion', paragraphs: [
    'A complete retention schedule and automated deletion procedure have not yet been confirmed. Do not assume closing a report or signing out deletes its records or evidence. The operator must document proportionate retention periods, lawful preservation needs and secure disposal for accounts, reports, evidence, audit records and backups. This version does not promise a fixed deletion date or automatic account erasure.'
  ] },
  { id: 'rights', title: '9. Privacy rights and requests', paragraphs: [
    'Subject to applicable conditions and exceptions, you may have rights to be informed, access and correct your data, object to processing, request erasure or blocking, obtain data portability, seek damages and complain to the National Privacy Commission. Rights are not all absolute; lawful investigations or preservation duties may affect a request.',
    'Prepare a description of your request, the relevant account or report reference and a safe reply channel. Submit it only through a contact independently verified with the project operator. Identity checks should request only what is necessary. Do not include your password, reset token or unnecessary identity documents. A verified request channel, responsible officer and handling procedure remain pending operator review; no self-service privacy-request or deletion portal is represented as available.'
  ] },
  { id: 'updates-contact', title: '10. Updates and operator contact', paragraphs: [
    'Check the displayed version and last updated date for changes. New Citizen registration records acknowledgment of this version together with Terms acceptance. Existing users are not assigned a historical acknowledgment. Material changes require appropriate notice and any additional choice required by law.',
    'The data controller’s legal identity, verified SafeLink privacy contact, responsible officer and organizational responsibilities are not confirmed for publication. These details, retention rules, lawful bases, minors’ safeguards and provider arrangements must be finalized by the operator and qualified privacy or legal reviewers before public deployment.'
  ] }
];
