# SECURITY_DATABASE.md

## Purpose

This file defines the security, authentication, authorization, Supabase, database, storage, and data-protection standards that every AI coding agent must follow when working in this repository.

Security must never be treated as an optional feature.

The application may contain sensitive business, employee, payroll, authentication, and operational data.

The agent must protect:

* user accounts
* employee information
* payroll information
* financial records
* workplace information
* uploaded documents
* authentication sessions
* API keys
* environment variables
* database integrity
* historical records

The agent must prefer secure defaults and least-privilege access.

# 1. Core Security Principles

Always follow these principles:

1. Never trust client input.
2. Never expose server secrets.
3. Authentication is not authorization.
4. Enforce permissions on trusted layers.
5. Use least privilege.
6. Validate all important inputs.
7. Protect sensitive historical data.
8. Avoid destructive operations.
9. Keep an audit-friendly design.
10. Fail securely.

# 2. Never Weaken Security to Fix a Bug

Do not solve access problems by:

* disabling Row Level Security
* exposing service-role keys
* removing authorization checks
* removing validation
* making private storage public
* granting unrestricted database permissions
* moving server secrets to client code

Fix the actual permission or configuration problem.

# 3. Authentication

Authentication answers:

> Who is the user?

Sensitive pages and operations must verify authentication.

Do not trust:

* client state
* local storage
* manually supplied user IDs
* hidden form fields

as proof of identity.

# 4. Authorization

Authorization answers:

> What is this authenticated user allowed to do?

Do not assume that every authenticated user has permission to:

* create records
* edit records
* delete records
* approve payroll
* change roles
* access reports
* view sensitive worker information

Authorization must be enforced on the server and/or database.

# 5. Frontend Permissions Are Not Security

It is acceptable to hide or disable UI actions for users without permission.

However:

```text
hidden button ≠ secure operation
```

A user may still manually call a Server Action, API route, or database endpoint.

Always enforce permissions on a trusted layer.

# 6. Roles and Permissions

Use explicit roles or permissions.

Examples may include:

* owner
* admin
* accounts
* supervisor
* worker

Do not scatter raw role strings throughout the codebase.

Prefer centralized permission logic where practical.

# 7. Least Privilege

Give each user only the access they actually require.

Examples:

A supervisor may need:

* view workers at assigned sites
* update attendance

but may not need:

* change payroll
* manage users
* access all financial reports

Do not grant broad access for convenience.

# 8. Supabase Row Level Security

Use Row Level Security for exposed application tables.

RLS policies should reflect actual application permissions.

Do not create policies such as:

```sql
using (true)
```

for sensitive tables unless the table is intentionally public.

Do not disable RLS simply because a query fails.

# 9. RLS Policy Design

Policies should be:

* explicit
* understandable
* minimal
* role-aware where necessary

Consider separate policies for:

* select
* insert
* update
* delete

Do not assume one broad policy is suitable for every operation.

# 10. Service Role Key

The Supabase service-role key is highly privileged.

It must never be exposed to:

* Client Components
* browser JavaScript
* public environment variables
* client bundles
* local storage

Use it only in trusted server-side code when absolutely necessary.

# 11. Environment Variables

Server-only secrets must remain private.

Never expose private values using:

```text
NEXT_PUBLIC_
```

unless they are genuinely safe for browser use.

Do not commit:

* `.env.local`
* database passwords
* API secrets
* service-role keys
* private tokens

# 12. Public Supabase Keys

Only browser-safe Supabase project credentials should be exposed to the frontend.

Do not confuse browser-safe project credentials with privileged keys.

# 13. Supabase Clients

Use clear, centralized Supabase clients.

Typically maintain separate helpers for:

* server-side usage
* browser usage

Do not initialize Supabase clients differently across random files.

# 14. Next.js Server Code

Sensitive operations should run in trusted server-side code.

Examples:

* role changes
* payroll approval
* sensitive reporting
* privileged database operations
* protected document access

Do not place privileged logic in Client Components.

# 15. Server Actions

Every sensitive Server Action must:

1. validate input
2. verify authentication
3. verify authorization
4. handle errors safely
5. return predictable output

Never trust values simply because they came from your own frontend.

# 16. Route Handlers

Protected Route Handlers must:

* authenticate users
* authorize actions
* validate input
* return appropriate status codes
* avoid leaking internal errors

Never expose internal database details to the client.

# 17. User Input

Treat all user-supplied values as untrusted.

This includes:

* forms
* search parameters
* route parameters
* query strings
* JSON payloads
* uploaded files
* cookies
* headers

Validate before using important data.

# 18. Server-Side Validation

Important data must be validated on the server.

Client-side validation is not sufficient.

Validate:

* required fields
* IDs
* dates
* numbers
* currency values
* enum/status values
* relationships
* permissions
* ownership

# 19. SQL Injection

Avoid unsafe dynamically generated SQL.

Use:

* Supabase query APIs
* parameterized SQL
* trusted RPC functions

Do not concatenate user input into SQL strings.

# 20. Database Schema Changes

Before modifying the database:

1. inspect existing schema
2. inspect relationships
3. inspect dependent application code
4. consider existing production data
5. consider constraints
6. consider indexes
7. consider RLS
8. consider migrations
9. consider rollback

Do not make destructive changes casually.

# 21. Migrations

Prefer reproducible migrations for schema changes.

Avoid relying indefinitely on manual dashboard changes that are not recorded in the repository.

Database structure should be reproducible across environments.

# 22. Destructive Schema Operations

Operations such as:

* dropping tables
* dropping columns
* changing column types
* renaming columns
* removing constraints

must be treated as high risk.

Consider:

* data migration
* backward compatibility
* application downtime
* existing queries

before proceeding.

# 23. Foreign Keys

Use foreign keys where relationships are meaningful.

Do not rely only on frontend logic to keep relational data valid.

# 24. Unique Constraints

When business rules require uniqueness, enforce it at the database level where appropriate.

Examples may include:

* employee number
* unique username
* unique external identifier

Frontend duplicate checking is not sufficient.

# 25. Database Constraints

Use database constraints for important integrity rules.

Examples:

* `NOT NULL`
* foreign keys
* check constraints
* unique constraints

Do not rely entirely on application code for critical data integrity.

# 26. Money Types

Do not store important currency values using floating-point database types.

Prefer PostgreSQL:

```text
numeric
decimal
```

where appropriate.

# 27. Financial Calculations

Financial values require predictable calculations.

Do not use careless floating-point operations in application code.

Use consistent rounding rules.

# 28. Historical Financial Data

Do not dynamically rewrite historical financial results based on current values.

Once a payroll period is finalized, preserve the values used at that time.

# 29. Approved Records

Approved or finalized financial records should not be silently editable.

Use an explicit correction or adjustment workflow if modification is required.

# 30. Soft Deletion

Prefer soft deletion or status-based deactivation for important records.

Examples:

```text
active
inactive
archived
resigned
terminated
```

Avoid permanent deletion when history matters.

# 31. Audit Trail

Important actions should be auditable where practical.

Examples:

* payroll approval
* payroll reopening
* rate changes
* deduction changes
* role changes
* worker transfers
* sensitive record deletion

Audit records may include:

* actor
* action
* record type
* record ID
* previous value
* new value
* timestamp

# 32. Created and Updated Metadata

Important records should usually have metadata such as:

```text
created_at
updated_at
created_by
updated_by
```

where useful.

# 33. Do Not Trust Client-Supplied Ownership

Do not allow users to submit:

```text
created_by
user_id
owner_id
role
```

and blindly trust those values.

Derive identity-sensitive fields from the authenticated server session where appropriate.

# 34. Database Queries

Retrieve only necessary data.

Avoid:

```sql
SELECT *
```

when only a small subset is required.

This improves:

* security
* performance
* clarity

# 35. Sensitive Columns

Do not fetch sensitive columns if the UI does not require them.

Examples may include:

* private notes
* internal IDs
* personal documents
* audit metadata

# 36. Pagination

Use pagination or scalable retrieval for large tables.

Do not fetch entire large datasets unnecessarily.

# 37. N+1 Queries

Avoid repeated database queries inside loops when a join, batch query, or RPC is more appropriate.

# 38. Transactions

Use atomic operations for multi-step changes that must remain consistent.

Examples:

* payroll finalization
* balance adjustment
* multi-record updates

Do not leave partial financial state if one step fails.

# 39. Race Conditions

Consider concurrent users.

Do not assume only one person is editing data.

Protect sensitive state transitions where necessary.

# 40. Status Transitions

Critical statuses should have valid transition rules.

Example:

```text
draft → review → approved → paid
```

Do not allow arbitrary status jumps if they can create invalid business state.

# 41. Idempotency

Operations that may be retried should avoid duplicate results where practical.

Important examples:

* payroll generation
* financial adjustments
* bulk operations
* external integration callbacks

# 42. File Upload Security

When accepting uploads:

* validate file size
* validate file type
* sanitize filenames
* generate unique storage paths
* prevent collisions
* reject unsupported files

Do not trust file extensions alone.

# 43. Storage Buckets

Choose public or private buckets deliberately.

Employee documents and sensitive files should generally not be public.

# 44. Private File Access

For private files, use controlled access mechanisms such as:

* authenticated access
* signed URLs
* server-mediated access

Do not permanently expose private files with public URLs.

# 45. Signed URLs

Signed URLs should have reasonable expiration times.

Do not generate extremely long-lived signed URLs for sensitive documents without reason.

# 46. File Names

Do not rely only on original uploaded filenames.

Generate unique internal paths.

Original names may still be stored as metadata.

# 47. Personal Data

Only collect and expose personal information necessary for the system.

Avoid unnecessarily displaying sensitive information in list views.

# 48. Data Minimization

Do not send all worker details to every page.

Provide only the fields required for that view.

# 49. Search Results

Search results should avoid unnecessarily exposing sensitive data.

Show the minimum information required to identify the correct record.

# 50. Logs

Logs must never contain:

* passwords
* private tokens
* service keys
* database passwords
* sensitive cookies

Avoid logging full personal or payroll records unnecessarily.

# 51. Client-Side Logging

Do not log sensitive business information to the browser console.

# 52. Error Logging

Server logs may contain useful diagnostic context, but should avoid secrets and unnecessary sensitive data.

# 53. Error Responses

User-facing errors should be safe.

Bad:

```text
PostgreSQL foreign key violation on private schema...
```

Better:

```text
Unable to complete this action. Please review the information and try again.
```

# 54. Authentication Errors

Do not reveal unnecessary account information.

Avoid error behaviour that could unnecessarily expose whether a specific user exists.

# 55. Session Handling

Use the established Supabase/Next.js session architecture.

Do not invent custom session storage without a strong reason.

# 56. Cookie Security

When manually working with authentication cookies, preserve secure settings appropriate to the framework and environment.

Do not weaken cookie protections unnecessarily.

# 57. CSRF and Request Security

Use framework-supported secure mutation patterns.

Be careful with externally callable endpoints.

Validate origin/context when the architecture requires it.

# 58. Open Redirects

Do not redirect users to arbitrary unvalidated URLs supplied by query parameters.

Validate redirect destinations.

# 59. URL Parameters

Treat route and query parameters as untrusted.

Validate identifiers before database usage.

# 60. Access by ID

Do not assume knowing a record ID means the user may access that record.

Authorization must still be checked.

# 61. UUIDs Are Not Authorization

Using UUIDs does not replace access control.

A difficult-to-guess ID is not a security boundary.

# 62. Role Changes

Changing user roles is highly sensitive.

Only appropriately authorized users should be able to change roles.

Role changes should be auditable where practical.

# 63. Admin Operations

Do not expose privileged admin operations through normal client-side database calls without strict RLS and authorization.

# 64. Bulk Operations

Bulk updates or deletes require additional protection.

Consider:

* confirmation
* authorization
* transaction safety
* audit logging
* partial failure handling

# 65. Dangerous Actions

Sensitive actions should be clearly identified.

Examples:

* delete user
* deactivate worker
* approve payroll
* reopen payroll
* change role
* delete financial record

Use clear confirmation and server-side authorization.

# 66. Backups

Production data is business-critical.

Database design should consider backup and recovery.

Do not assume accidental deletion can always be reversed manually.

# 67. Data Recovery

Prefer designs that allow recovery from mistakes.

Historical records should not be destroyed without reason.

# 68. Test Data

Do not mix development/test records into production intentionally.

Keep environments logically separated.

# 69. Seed Data

Seed scripts should be:

* repeatable
* safe
* clearly development-oriented

Do not embed real credentials or private data.

# 70. Production vs Development

Do not weaken production security simply because development is easier with broader permissions.

Use environment-aware configuration where necessary.

# 71. Privileged Server Utilities

If privileged database helpers are necessary, keep them clearly separated and server-only.

Their names should indicate elevated privilege.

# 72. Do Not Import Server Secrets into Client Trees

Be careful with shared modules.

A module containing server-only secrets must never become reachable from a Client Component import tree.

# 73. Server-Only Modules

Use server-only boundaries where supported and appropriate for modules containing privileged logic.

# 74. API Rate Limiting

For abuse-sensitive or publicly accessible endpoints, consider rate limiting where appropriate.

Examples:

* login-related endpoints
* public forms
* file uploads
* expensive search endpoints

# 75. Resource Abuse

Protect expensive operations from uncontrolled repeated execution.

# 76. Search Security

Avoid unsafe search query construction.

Limit result sizes.

Do not return more information than required.

# 77. Export Security

Reports and exported files may contain sensitive information.

Authorization must be checked before generating or downloading them.

# 78. CSV/Spreadsheet Exports

Be aware that exported user-controlled text can create spreadsheet formula injection risks.

Sanitize dangerous values where necessary.

# 79. Cache Security

Be careful caching user-specific or sensitive data.

Do not accidentally share private data between users through inappropriate caching.

# 80. Next.js Caching

Understand whether data is:

* public
* user-specific
* role-specific
* frequently changing

before applying caching.

Do not cache sensitive user-specific content as if it were public data.

# 81. Revalidation

Ensure cache revalidation does not accidentally expose stale or unauthorized information.

# 82. Public Pages

Only expose truly public information on unauthenticated routes.

# 83. Internal IDs

Avoid unnecessarily exposing internal implementation identifiers when a safer public identifier is appropriate.

This does not replace authorization.

# 84. Personally Identifiable Information

Treat items such as these carefully:

* NIC numbers
* phone numbers
* addresses
* bank details
* ETF/EPF information
* identity documents

Display only where required.

# 85. Sensitive UI

Consider masking sensitive values where full visibility is unnecessary.

# 86. Browser Storage

Do not store highly sensitive information in:

* localStorage
* sessionStorage

unless there is a strong justified reason.

Never store privileged secrets there.

# 87. Financial Records

Financial records should favor:

* immutable snapshots
* corrections
* adjustment records
* audit history

over silent destructive edits.

# 88. Payroll Recalculation

Do not automatically recalculate previously approved payroll because:

* rates changed
* worker information changed
* workplace information changed

Historical records must remain stable.

# 89. Referential Integrity

Do not delete records that are still referenced by important historical records unless the data model explicitly supports it safely.

# 90. Date and Time Security

Use server-controlled timestamps for sensitive operations when possible.

Do not blindly trust client-supplied timestamps for audit events.

# 91. Audit Timestamps

Audit timestamps should come from trusted server/database time where practical.

# 92. Authorization Helper Functions

Centralize repeated permission checks when practical.

Avoid slightly different authorization logic across multiple endpoints.

# 93. RLS Testing

When adding or changing RLS, consider:

* authenticated owner/admin
* authenticated restricted role
* unauthenticated user
* users accessing someone else's data

Do not test only one privileged account.

# 94. RLS and Service Role Testing

Be aware that service-role queries bypass RLS.

Do not use service-role tests to conclude that normal user access is correctly configured.

# 95. Security Through Obscurity

Do not rely on:

* hidden routes
* obscure URLs
* UUIDs
* disabled buttons

as security measures.

# 96. Validate State Before Mutation

Before sensitive updates, verify the current record state.

Example:

A payroll record may need to be in `review` before moving to `approved`.

# 97. Prevent Unauthorized Field Updates

Do not blindly update an entire object received from the client.

Whitelist allowed fields.

Bad:

```ts
await updateWorker(formData);
```

if `formData` can contain privileged fields.

Prefer explicitly selecting mutable fields.

# 98. Mass Assignment

Protect against mass-assignment-style vulnerabilities.

Do not let users modify protected columns merely by adding them to a request payload.

# 99. Protected Fields

Examples of protected fields may include:

* role
* created_by
* approved_by
* owner_id
* system status
* audit metadata

These should be controlled by trusted code.

# 100. Database Functions

When using PostgreSQL functions/RPC:

* validate parameters
* use appropriate execution security
* avoid excessive privileges
* review whether `security definer` is necessary

Use elevated database functions carefully.

# 101. Search Path Safety

For privileged PostgreSQL functions, define safe schema/search-path behaviour where applicable.

# 102. Third-Party APIs

Do not expose third-party secrets to client code.

Call privileged external APIs from trusted server-side code.

# 103. Webhooks

Webhook endpoints should verify authenticity using the provider's supported verification mechanism.

Do not trust incoming webhook JSON solely because it reached the endpoint.

# 104. External Data

Treat data received from third-party systems as untrusted.

Validate it before storing or using it.

# 105. Security Review Before Completion

For every security-sensitive change, verify:

* authentication is correct
* authorization is correct
* server-side validation exists
* RLS remains enabled
* policies are least privilege
* secrets remain private
* sensitive errors are not exposed
* no privileged fields are client-controlled
* database integrity is protected
* historical data remains safe

# Final Principle

Security and data integrity take priority over convenience.

Never make an insecure implementation simply because it is faster or easier.

A correct implementation must protect users, business data, financial records, credentials, and historical information at every layer.
