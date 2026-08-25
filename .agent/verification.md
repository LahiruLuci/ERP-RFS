# VERIFICATIONS.md

## Purpose

This file defines the verification standards that every AI coding agent must follow before declaring any task complete.

The goal is to ensure that changes are not only written, but also reviewed, validated, tested where possible, and checked for regressions.

The agent must never assume that code is correct simply because it looks correct.

# 1. Core Verification Principle

Every meaningful change must be verified.

Verification should match the risk of the task.

Higher-risk changes require deeper verification.

Examples of high-risk areas:

* authentication
* authorization
* payroll
* financial calculations
* database schema
* database writes
* RLS policies
* role management
* destructive actions
* file uploads
* historical data
* shared components
* shared utilities

# 2. Never Claim Unverified Results

Do not say:

* "everything works"
* "fully tested"
* "build passes"
* "there are no errors"
* "the issue is fixed"

unless appropriate verification was actually performed.

Use accurate language.

If only static review was possible, say so.

# 3. Verify the User Request First

Before technical verification, confirm that the implementation actually matches the requested behaviour.

Check:

* what the user asked for
* what was changed
* what must remain unchanged
* whether the final behaviour matches the request

Do not consider a task complete simply because code was added.

# 4. Review Changed Files

Before running tools, manually review all changed files.

Check for:

* syntax problems
* incorrect imports
* missing imports
* naming mistakes
* duplicated logic
* invalid assumptions
* unused variables
* unused functions
* incomplete code
* debug code
* broken comments
* accidental changes

# 5. Review the Diff

When possible, inspect the final diff.

The diff should be focused.

Check for:

* unrelated file changes
* accidental deletions
* unnecessary formatting changes
* renamed code unrelated to the task
* removed functionality
* duplicated implementation
* exposed secrets

# 6. TypeScript Verification

If the project uses TypeScript, verify that changes do not introduce type errors.

Fix:

* invalid types
* unsafe assumptions
* broken imports
* incorrect props
* invalid function signatures

Do not hide type errors using:

```ts
any
```

or:

```ts
// @ts-ignore
```

unless there is a justified reason.

# 7. Lint Verification

Run the project's configured lint command when available.

Check `package.json` first.

Typical example:

```bash
npm run lint
```

Do not assume the lint script name.

Do not disable legitimate lint rules simply to make verification pass.

# 8. Build Verification

Run a production build when practical.

Typical example:

```bash
npm run build
```

A development server working does not guarantee a production build will succeed.

Fix errors introduced by the change.

# 9. Test Verification

If the project contains tests, run the relevant tests.

Do not introduce a new testing framework unless needed.

Prefer existing:

* unit tests
* integration tests
* end-to-end tests

Run the smallest relevant set first, then broader tests when appropriate.

# 10. Existing Test Failures

If existing tests fail for reasons unrelated to the task:

* identify them
* distinguish them from new failures
* do not hide them
* do not falsely claim full test success

Do not remove or weaken tests simply because they fail.

# 11. Runtime Verification

When the environment allows, verify the changed feature at runtime.

Check:

* page loads
* component renders
* action works
* data updates correctly
* errors are handled
* navigation remains correct

Do not rely only on compilation.

# 12. UI Verification

For UI changes, verify at least:

* normal state
* loading state
* empty state
* error state
* long-content state
* disabled state
* permission-restricted state where relevant

# 13. Responsive Verification

For responsive changes, check behaviour around:

```text
320px
375px
390px
430px
768px
1024px
1280px
1440px+
```

At minimum verify:

* no page-level horizontal overflow
* buttons remain accessible
* forms remain readable
* tables remain usable
* dialogs fit
* dropdowns stay on-screen
* navigation works
* text does not overlap

# 14. Mobile Verification

Check:

* touch targets
* stacked layouts
* mobile navigation
* primary action visibility
* form usability
* table behaviour
* modal behaviour
* long text
* keyboard-friendly inputs

# 15. Tablet Verification

Check:

* grid transitions
* sidebar behaviour
* form columns
* table width
* content spacing
* dialogs and sheets

# 16. Desktop Verification

Check:

* layout balance
* max-width behaviour
* table usability
* navigation
* primary action placement
* excessive whitespace

# 17. Accessibility Verification

For UI changes, check:

* semantic HTML
* labels
* keyboard access
* visible focus
* button semantics
* link semantics
* icon-only accessible names
* image alt behaviour
* color-independent status communication

Do not introduce accessibility regressions.

# 18. Form Verification

For forms, verify:

* empty submission
* required fields
* invalid values
* valid submission
* loading state
* duplicate submission prevention
* server failure
* success state
* error messages
* reset behaviour where relevant

# 19. Validation Verification

Confirm that important validation exists on the server.

Do not rely only on client validation.

Check:

* numeric ranges
* required values
* IDs
* dates
* enum/status values
* relational constraints
* business-critical rules

# 20. Authentication Verification

When authentication changes, verify:

* unauthenticated user
* authenticated user
* protected route behaviour
* redirect behaviour
* login flow
* logout flow
* expired session behaviour where relevant

# 21. Authorization Verification

When permissions change, check:

* allowed user
* unauthorized user
* no session
* different roles

Do not test only the most privileged role.

# 22. RLS Verification

When Supabase RLS changes, verify conceptually or practically:

* allowed select
* denied select
* allowed insert
* denied insert
* allowed update
* denied update
* allowed delete
* denied delete

where applicable.

Do not use a service-role client to conclude that RLS is working correctly.

# 23. Database Read Verification

For database queries, verify:

* expected record
* no record
* multiple records
* filtered results
* sorting
* pagination
* permission failure

# 24. Database Write Verification

For create/update operations, verify:

* valid write
* invalid input
* missing relation
* duplicate data
* unauthorized write
* database failure

# 25. Database Schema Verification

For schema changes, verify:

* migration syntax
* existing data compatibility
* foreign keys
* unique constraints
* defaults
* nullability
* indexes
* RLS
* application queries using the schema

# 26. Migration Verification

When using migrations:

* verify migration order
* verify forward migration
* consider rollback strategy
* ensure migration is reproducible
* avoid undocumented manual-only changes

# 27. Financial Verification

Financial logic requires additional verification.

Check:

* positive values
* zero values
* large values
* deduction totals
* rounding
* missing rates
* duplicate items
* approved historical records

Never verify only one happy-path example.

# 28. Calculation Verification

For important calculations, test representative examples.

For example:

```text
gross salary
- advance
- meals
- uniform
- other deductions
= net salary
```

Check:

* normal case
* zero deductions
* multiple deductions
* deduction greater than earnings
* missing required inputs

# 29. Historical Data Verification

When changing logic that affects historical records, confirm that existing finalized data remains unchanged unless explicitly intended.

# 30. Destructive Action Verification

For delete, deactivate, archive, reverse, or reset operations verify:

* correct record is targeted
* authorization is enforced
* confirmation exists where appropriate
* historical records are preserved where required
* accidental repeated execution is prevented

# 31. File Upload Verification

For upload features, check:

* supported file type
* unsupported type
* valid file size
* oversized file
* upload failure
* storage permission
* generated path
* private/public access behaviour

# 32. Search Verification

For search features verify:

* exact match
* partial match
* no results
* special characters
* cleared search
* mobile usability
* request volume if server-backed

# 33. Filter Verification

Check:

* single filter
* multiple filters
* filter reset
* empty result
* URL state if used
* mobile filter panel behaviour

# 34. Pagination Verification

Verify:

* first page
* middle page
* last page
* no data
* page size
* filter + pagination interaction
* search + pagination interaction

# 35. Sorting Verification

Check:

* ascending
* descending
* null values
* numeric data
* dates
* text values

# 36. Shared Component Verification

When modifying a shared component, inspect all major usages.

Check whether the change affects:

* other pages
* other forms
* other dialogs
* existing variants
* mobile behaviour

# 37. Shared Utility Verification

When changing a shared utility, verify all major call sites.

Examples:

* date formatter
* currency formatter
* permission helper
* Supabase client helper
* validation schema

# 38. API Verification

For APIs or Route Handlers, check:

* valid request
* invalid request
* unauthorized request
* forbidden request
* missing resource
* server failure
* correct status code
* safe response body

# 39. Server Action Verification

For Server Actions, check:

* authenticated user
* unauthorized user
* invalid input
* valid input
* duplicate submission
* database failure
* predictable return value

# 40. Error Handling Verification

Trigger or reason through expected failure cases.

Make sure the UI does not:

* crash
* hang
* show raw stack traces
* expose sensitive database messages

# 41. Loading Verification

Check that loading feedback appears when appropriate.

Confirm that users cannot accidentally perform duplicate sensitive actions while loading.

# 42. Empty State Verification

Check screens when no data exists.

Make sure users understand:

* what is missing
* whether this is expected
* what they can do next

# 43. Long Content Verification

Test with realistic long values such as:

* long names
* long workplace names
* long notes
* long email addresses
* large salary values

Make sure layouts remain stable.

# 44. Localization-Sensitive Verification

If the UI may display multiple languages, verify:

* text wrapping
* font compatibility
* layout expansion
* number formatting
* date formatting

Do not assume English text length.

# 45. Time and Date Verification

For date/time features, consider:

* local timezone
* database timezone
* midnight boundaries
* month boundaries
* daylight-saving behaviour if relevant
* invalid date input

# 46. Cache Verification

When changing cached data, check:

* fresh data
* stale data
* revalidation
* user-specific data
* role-specific data

Do not accidentally cache private data publicly.

# 47. Performance Verification

Check for obvious regressions.

Look for:

* duplicate requests
* N+1 queries
* huge client bundles
* unnecessary client components
* large list rendering
* unnecessary re-renders
* oversized images

# 48. Dependency Verification

If a new dependency is added:

* confirm it is installed
* confirm compatible version
* confirm import path
* confirm build works
* confirm package is actually needed

Do not leave unused dependencies.

# 49. Environment Variable Verification

When adding environment variables:

* verify correct names
* verify server/client scope
* do not expose private values
* document required variables where appropriate

# 50. Security Verification

For security-sensitive work, check:

* authentication
* authorization
* validation
* least privilege
* RLS
* secret handling
* client/server separation
* safe error messages
* auditability

# 51. Secret Exposure Review

Search mentally or practically for accidental exposure through:

* Client Components
* logs
* errors
* hard-coded strings
* public environment variables
* browser storage

# 52. Console Verification

Remove temporary:

```ts
console.log()
console.debug()
```

unless intentionally required.

Do not leave noisy debug logging.

# 53. Temporary Code Verification

Remove:

* fake data
* hard-coded IDs
* bypass flags
* temporary credentials
* commented experiments
* test-only values

# 54. Import Verification

Confirm all imports:

* resolve correctly
* use correct aliases
* are actually used
* do not cross server/client boundaries incorrectly

# 55. Dead Code Verification

Remove newly created dead code.

Do not leave unused helpers, types, components, or imports.

# 56. Naming Verification

Review names for clarity.

Avoid vague names such as:

```text
data
temp
item2
value
thing
```

when better domain names are available.

# 57. Final Diff Quality

The final diff should be:

* focused
* understandable
* minimal
* free of unrelated changes

If the diff is unexpectedly large, investigate why.

# 58. Regression Review

Before completion, ask:

* What existing behaviour could this change break?
* Did I check those paths?
* Did I modify shared code?
* Did I change data contracts?
* Did I change route behaviour?

# 59. Definition of Done

A task is complete only when:

* requested behaviour is implemented
* code is reviewed
* relevant verification is performed
* errors introduced by the change are fixed
* responsive behaviour is considered
* security is considered
* no debug code remains
* unrelated behaviour is preserved

# 60. Final Report

When reporting completion, mention only what is true.

Include when relevant:

* what changed
* what was verified
* what could not be verified
* any existing unrelated issue

Keep the report concise and accurate.

# Final Principle

Do not stop at:

> The code has been written.

Stop only when you can reasonably say:

> The requested change has been implemented carefully, reviewed, and verified to the extent supported by the available environment.
