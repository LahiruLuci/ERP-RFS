# WORKFLOW.md

## Purpose

This file defines the workflow an AI coding agent must follow when working on this repository.

The goal is to prevent rushed changes, unnecessary rewrites, regressions, incomplete implementations, and poor architectural decisions.

For every meaningful development task, follow this workflow:

**Understand → Inspect → Analyze → Plan → Implement → Review → Verify → Report**

# 1. Understand the Request

Before touching the code, understand exactly what the user is asking for.

Identify:

* what needs to be created, changed, fixed, or removed
* expected behaviour
* affected feature or page
* what must remain unchanged
* whether the task affects UI, backend, database, authentication, or multiple layers
* whether the task contains explicit constraints

Do not begin implementation while the task is still misunderstood.

# 2. Determine the Scope

Define the smallest reasonable scope required to complete the task correctly.

Identify:

* files likely to be affected
* components likely to be affected
* database involvement
* authentication/authorization involvement
* shared utilities involved
* possible dependencies

Do not expand the task unnecessarily.

# 3. Inspect the Existing Project

Before editing, inspect the relevant code.

Review applicable:

* pages
* layouts
* components
* hooks
* utilities
* types
* validation schemas
* Server Actions
* Route Handlers
* database queries
* Supabase clients
* authentication logic
* authorization logic
* configuration
* styles
* package dependencies

Never assume how something works without inspecting it first.

# 4. Inspect Project Configuration

When relevant, inspect:

* `package.json`
* `tsconfig.json`
* Next.js configuration
* Tailwind configuration
* ESLint configuration
* environment variable usage
* Supabase configuration
* middleware/proxy configuration
* project scripts

Use the installed versions and actual configuration as the source of truth.

# 5. Search Before Creating

Before creating a new implementation, search the repository for existing functionality that can be reused.

Look for existing:

* components
* UI primitives
* forms
* dialogs
* tables
* utilities
* hooks
* types
* validation schemas
* Supabase helpers
* formatting functions
* permission helpers
* loading states
* error states
* empty states

Do not create duplicate implementations unnecessarily.

# 6. Understand Existing Patterns

Identify how the project currently handles similar features.

Examples:

* data fetching
* mutations
* Server Components
* Client Components
* Server Actions
* forms
* validation
* authentication
* authorization
* error handling
* notifications
* responsive layouts

Follow existing good patterns.

Do not introduce a competing architectural pattern without a strong reason.

# 7. Check Dependencies

Before importing or installing a package:

1. Check `package.json`.
2. Confirm whether the package already exists.
3. Check whether the existing stack already provides the functionality.
4. Determine whether another installed package already solves the problem.
5. Only add a dependency when it provides meaningful value.

Never assume a dependency is installed.

# 8. Identify Risks

Before implementation, consider possible risks.

Examples:

* breaking existing behaviour
* changing historical data
* exposing sensitive data
* weakening authorization
* creating database inconsistencies
* breaking mobile layouts
* introducing duplicate records
* creating race conditions
* causing performance problems
* changing shared components that affect multiple pages

Higher-risk changes require more careful inspection and verification.

# 9. Plan the Implementation

Before editing, establish a simple implementation plan.

Determine:

* what must change
* what can be reused
* whether new files are necessary
* whether existing files should be modified
* how data flows through the feature
* where validation belongs
* where business logic belongs
* how errors will be handled
* how loading states will work
* how mobile behaviour will work
* how the implementation will be verified

Prefer the smallest clean solution.

# 10. Avoid Unnecessary Rewrites

Do not rewrite working code merely because another implementation looks cleaner.

Refactor only when:

* required for the requested feature
* existing code prevents a correct implementation
* duplication creates a real problem
* existing architecture creates significant maintainability issues

Keep unrelated refactoring separate from feature work whenever possible.

# 11. Implement Incrementally

Make changes in logical steps.

For example:

1. types
2. validation
3. data/server logic
4. UI
5. error/loading states
6. responsive behaviour
7. verification

Do not make a large number of unrelated changes simultaneously.

# 12. Keep Responsibilities Separated

Place logic in the appropriate layer.

Do not put everything inside a page or component.

Generally:

**UI components**

* display information
* handle user interaction

**Validation**

* validates incoming data

**Server logic**

* performs trusted operations

**Database layer**

* reads and writes data

**Utilities**

* provide reusable transformations and formatting

**Business/domain logic**

* performs important calculations and rules

Keep these responsibilities reasonably separated.

# 13. Server vs Client Decision

Before making a component a Client Component, determine whether client-side behaviour is actually necessary.

Prefer Server Components when possible.

Use Client Components for genuine interactive/browser requirements.

Do not move large amounts of server-compatible logic into the browser unnecessarily.

# 14. Implement Validation

For user input:

* validate required fields
* validate formats
* validate ranges
* validate relationships where necessary
* provide clear error messages

Important operations must be validated on trusted server-side code.

Do not trust client validation alone.

# 15. Implement Authorization

For protected operations:

1. verify authentication
2. determine the user's permissions
3. enforce authorization on the server/database
4. optionally reflect permissions in the UI

Never rely solely on hiding buttons.

# 16. Handle Errors

Consider expected failure scenarios during implementation.

Examples:

* database failure
* network failure
* invalid data
* duplicate data
* missing records
* unauthorized user
* storage failure
* unexpected server error

Handle failures deliberately.

Never silently swallow errors.

# 17. Handle Loading States

Every asynchronous user action should provide suitable feedback.

Examples:

* saving
* deleting
* searching
* uploading
* calculating
* submitting

Prevent users from accidentally triggering the same important operation multiple times.

# 18. Handle Empty States

Data-driven screens must handle situations where no data exists.

Examples:

* no workers
* no search results
* no records
* no history
* no assigned items

Provide useful information rather than displaying an unexplained blank area.

# 19. Consider Responsive Behaviour During Implementation

Do not finish desktop UI first and postpone mobile support.

While implementing, continuously consider:

* mobile
* tablet
* laptop
* desktop

Check:

* forms
* tables
* navigation
* dialogs
* cards
* buttons
* filters
* long text
* action menus

Responsive design is part of the feature implementation.

# 20. Consider Accessibility During Implementation

Do not leave accessibility until the end.

Use correct semantic elements from the beginning.

Consider:

* keyboard navigation
* focus
* labels
* accessible names
* form errors
* button semantics
* links
* dialog behaviour
* status communication

# 21. Be Careful With Shared Code

Before modifying shared:

* components
* layouts
* hooks
* utilities
* styles
* types

search for all major usages.

A small change to shared code may affect many pages.

Do not modify shared behaviour without considering those effects.

# 22. Be Careful With Database Changes

Before changing the database:

1. inspect the existing schema
2. inspect relationships
3. identify application code using the affected fields
4. consider existing records
5. consider constraints
6. consider indexes
7. consider RLS
8. consider migration safety

Avoid destructive changes whenever possible.

# 23. Do Not Hide Problems

Do not solve problems by hiding them.

Examples of bad approaches:

* disabling TypeScript checks
* disabling ESLint rules without reason
* adding `@ts-ignore`
* using `any` everywhere
* disabling RLS
* removing validation
* swallowing exceptions
* forcing page reloads to hide state problems
* adding arbitrary delays
* removing failing tests

Fix root causes whenever reasonably possible.

# 24. Debug Systematically

When fixing a bug:

1. understand the reported behaviour
2. locate the relevant code
3. trace the data/control flow
4. identify the root cause
5. implement the smallest correct fix
6. check related scenarios
7. verify no regression was introduced

Do not randomly change code until the symptom disappears.

# 25. Avoid Workarounds Without Understanding

Do not introduce hacks simply to make something appear to work.

Examples:

* arbitrary `setTimeout`
* unnecessary page reload
* hard-coded IDs
* duplicated data
* forced type casting
* disabling security
* excessive retries

If a workaround is genuinely necessary, document why.

# 26. Review Changes Before Running Verification

After implementation, inspect the changed files yourself.

Check for:

* syntax errors
* incorrect imports
* naming mistakes
* duplicate logic
* unnecessary complexity
* missing validation
* missing authorization
* missing error handling
* missing loading states
* responsive issues
* accessibility issues
* debug code
* unintended changes

# 27. Check the Diff

When possible, review the final code diff.

Look for:

* unrelated modifications
* accidental deletions
* formatting changes unrelated to the task
* duplicated code
* forgotten temporary changes
* exposed secrets

The final diff should be focused.

# 28. Run Relevant Verification

When tooling is available, run appropriate project checks.

Examples:

```bash
npm run lint
npm run build
```

Run existing tests when applicable.

Use the actual scripts defined in `package.json`.

Do not invent commands without checking the project.

# 29. Fix Errors Introduced by the Change

Do not knowingly leave:

* TypeScript errors
* lint errors
* build errors
* broken imports
* runtime errors

introduced by your implementation.

Fix them before considering the task complete.

# 30. Distinguish Existing Problems

If verification reveals a pre-existing unrelated problem:

* identify it
* do not falsely attribute it to the current change
* do not unnecessarily rewrite unrelated code to fix it
* clearly mention it if it prevents complete verification

Never claim verification passed when it did not.

# 31. Clean Up Temporary Code

Before completion remove:

* temporary `console.log`
* `console.debug`
* hard-coded test values
* fake IDs
* fake credentials
* temporary comments
* unused imports
* unused variables
* abandoned implementations
* debugging UI

# 32. Final Functional Review

Before declaring completion, confirm that the requested behaviour actually exists.

Do not consider a task complete merely because code was written.

Check the full flow:

**User Action → Validation → Application Logic → Database/Server → Response → UI Feedback**

# 33. Final UI Review

For UI changes, consider:

* normal state
* loading state
* error state
* empty state
* long-content state
* mobile state
* tablet state
* desktop state
* disabled state
* permission-restricted state where applicable

# 34. Final Security Review

For sensitive changes verify:

* authentication is enforced
* authorization is enforced
* user input is validated
* secrets remain server-side
* sensitive errors are not exposed
* database permissions remain appropriate
* destructive actions are protected

# 35. Final Responsive Review

At minimum consider:

* 320px
* 375px
* 390px
* 768px
* 1024px
* 1280px+

Check for:

* page overflow
* inaccessible actions
* broken grids
* unreadable tables
* overflowing dialogs
* clipped text
* unusable forms

# 36. Do Not Claim Unverified Results

Never say:

* "everything works"
* "fully tested"
* "build passes"
* "there are no errors"

unless the appropriate verification was actually performed.

Use accurate language.

# 37. Report Completion Clearly

After completing a task, provide a concise summary.

Include when relevant:

* what was changed
* important implementation decisions
* verification performed
* any remaining limitation or issue

Do not overwhelm the user with unnecessary implementation details.

# 38. Stop When the Task Is Complete

Do not continue modifying the project simply because other improvements are possible.

Once the requested task is correctly implemented, verified, and cleaned up, stop.

Future improvements should remain separate tasks.

# Standard Workflow Summary

For every meaningful task, follow:

```text
1. Understand
        ↓
2. Define Scope
        ↓
3. Inspect Existing Code
        ↓
4. Search Existing Patterns
        ↓
5. Check Dependencies
        ↓
6. Identify Risks
        ↓
7. Plan
        ↓
8. Implement Incrementally
        ↓
9. Handle Validation / Errors / Loading
        ↓
10. Check Responsive + Accessibility
        ↓
11. Review Own Changes
        ↓
12. Review Diff
        ↓
13. Run Verification
        ↓
14. Fix Problems
        ↓
15. Clean Up
        ↓
16. Final Review
        ↓
17. Report Completion
```

# Final Principle

Never optimize for writing code as quickly as possible.

Optimize for delivering the **smallest, safest, cleanest, verified solution** that correctly satisfies the user's request without damaging existing functionality.
