# CODE_QUALITY.md

## Purpose

This file defines the code-quality standards that every AI coding agent must follow when creating, modifying, reviewing, or refactoring code in this repository.

The goal is to produce production-quality code that is:

* correct
* readable
* maintainable
* predictable
* strongly typed
* modular
* reusable where appropriate
* secure
* testable
* performant
* consistent with the existing project

Code should be written for long-term maintenance, not only to make the current task work.

# 1. General Principle

Prefer clear, simple, correct code over clever code.

Code should be understandable by another developer without requiring unnecessary mental effort.

Do not optimize for:

* fewer lines
* clever syntax
* unnecessary abstraction
* unnecessary design patterns

Optimize for:

* clarity
* correctness
* consistency
* maintainability

# 2. Understand Existing Code First

Before writing new code:

* inspect related files
* understand current architecture
* identify existing patterns
* search for reusable components
* search for reusable utilities
* inspect existing types
* inspect existing validation
* inspect existing data-access patterns

Do not introduce a second implementation of something that already exists.

# 3. Follow Existing Conventions

Follow established project conventions when they are reasonable.

This includes:

* naming
* folder organization
* import style
* component structure
* data fetching
* mutations
* validation
* error handling
* styling
* Supabase usage

Consistency across the project is usually more valuable than personal preference.

# 4. Keep Code Simple

Use the simplest solution that correctly solves the problem.

Avoid unnecessary:

* classes
* factories
* wrappers
* hooks
* providers
* contexts
* services
* generic utilities
* configuration
* abstractions

Do not create architecture for hypothetical future requirements.

# 5. Avoid Over-Abstraction

Do not extract code merely because extraction is possible.

Create an abstraction when it provides a real benefit such as:

* meaningful reuse
* clearer responsibility
* easier testing
* consistent behaviour
* reduced meaningful duplication

A small amount of obvious duplication can sometimes be better than a confusing abstraction.

# 6. Single Responsibility

Files, functions, and components should have clear responsibilities.

Avoid combining unrelated concerns.

For example, one React component should not become responsible for:

* querying the database
* calculating financial values
* validating forms
* checking permissions
* formatting data
* rendering a large UI

Separate responsibilities where doing so improves clarity.

# 7. File Size

Avoid excessively large files.

There is no strict line-count rule.

Split a file when it becomes difficult to:

* understand
* navigate
* test
* maintain

Extract meaningful units rather than splitting files arbitrarily.

# 8. Function Design

Functions should generally perform one primary task.

Good:

```ts
calculateNetSalary()
validateWorkerInput()
getWorkerById()
createWorkplaceAssignment()
formatCurrency()
```

Avoid vague functions such as:

```ts
process()
handleData()
doStuff()
run()
func1()
```

# 9. Function Parameters

Avoid functions with excessive positional parameters.

Bad:

```ts
createWorker(
  name,
  nic,
  phone,
  address,
  rate,
  status,
  workplace,
  note
);
```

Prefer a typed object when several related parameters exist:

```ts
createWorker({
  name,
  nic,
  phone,
  address,
  rate,
  status,
  workplace,
  note,
});
```

# 10. Function Side Effects

Keep side effects deliberate.

A function named:

```ts
calculateSalary()
```

should not unexpectedly:

* update the database
* send notifications
* mutate global state

Names should accurately describe behaviour.

# 11. Pure Functions

Prefer pure functions for:

* calculations
* transformations
* formatting
* validation helpers

where practical.

Pure functions are easier to:

* understand
* test
* reuse
* debug

# 12. Guard Clauses

Prefer guard clauses when they reduce nesting.

Bad:

```ts
if (user) {
  if (user.isActive) {
    if (user.hasPermission) {
      performAction();
    }
  }
}
```

Better:

```ts
if (!user) return;
if (!user.isActive) return;
if (!user.hasPermission) return;

performAction();
```

# 13. Avoid Deep Nesting

Deeply nested code is difficult to understand.

Use:

* guard clauses
* extracted functions
* early returns
* clearer data structures

to reduce unnecessary nesting.

# 14. TypeScript

Use TypeScript properly.

Do not use TypeScript only as JavaScript with type checking disabled.

Avoid:

```ts
any
```

unless genuinely unavoidable.

Prefer:

* inferred types
* explicit types where useful
* interfaces
* type aliases
* literal unions
* discriminated unions
* generics where they provide real value

# 15. Avoid Unsafe Type Escapes

Avoid:

```ts
as any
```

Avoid:

```ts
// @ts-ignore
```

Avoid:

```ts
// @ts-nocheck
```

Avoid unsafe assertions such as:

```ts
value as SomeType
```

unless the value is already known or validated to satisfy that type.

Fix type problems instead of hiding them.

# 16. Unknown Data

Use `unknown` rather than `any` for values whose type is genuinely unknown.

Then narrow or validate the value before use.

# 17. Null and Undefined

Handle nullable values intentionally.

Do not assume database or API values always exist.

Avoid excessive non-null assertions:

```ts
worker!.name
```

unless existence is guaranteed by prior logic.

# 18. Shared Types

Reuse meaningful shared types.

Do not create slightly different versions of the same domain type across many files.

At the same time, do not create one enormous global type file containing every type in the application.

# 19. Database Types

When generated Supabase database types exist, use them appropriately.

Avoid manually duplicating database row types.

Derived UI/domain types may be created when they serve a different purpose.

# 20. Naming

Names must communicate intent.

Good variable names:

```ts
worker
activeWorkers
monthlySalary
totalDeductions
isLoading
hasPermission
```

Bad:

```ts
data1
x
temp
thing
val
arr
obj
```

# 21. Boolean Naming

Boolean variables should usually read naturally as questions.

Prefer:

```ts
isActive
isSubmitting
hasAccess
canEdit
shouldRefresh
```

Avoid:

```ts
activeFlag
check
permissionValue
```

# 22. Event Handler Naming

Use descriptive event handler names.

Examples:

```ts
handleSubmit
handleDeleteWorker
handleWorkplaceChange
handleSearchChange
```

For passed callback props, names such as these are appropriate:

```ts
onSubmit
onDelete
onChange
onSelect
```

# 23. Component Naming

React components must use clear PascalCase names.

Good:

```text
WorkerForm
WorkerTable
PayrollSummary
WorkplaceSelector
DeleteWorkerDialog
```

Avoid generic names such as:

```text
Box
Thing
Component1
DataComponent
```

# 24. Constants

Avoid magic numbers and magic strings.

Bad:

```ts
if (status === 3) {
}
```

Prefer meaningful constants or typed values:

```ts
if (status === PAYROLL_STATUS.APPROVED) {
}
```

# 25. Enums and Literal Unions

Do not automatically use TypeScript enums for every fixed value.

Use the representation that best fits the project.

Literal unions or constant objects are often simpler.

Example:

```ts
type WorkerStatus =
  | "active"
  | "inactive"
  | "resigned"
  | "terminated";
```

# 26. Avoid Duplicate Logic

Search before implementing common functionality.

Avoid multiple implementations of:

* currency formatting
* date formatting
* permission checks
* validation
* Supabase client creation
* calculation logic
* class-name merging
* status formatting

Centralize meaningful repeated logic.

# 27. Do Not Create Premature Utilities

A utility function should exist because it improves the code.

Do not create utility files containing dozens of tiny one-use functions.

# 28. React Components

Keep React components focused.

Separate complex:

* forms
* tables
* dialogs
* filters
* data transformation
* business logic

when appropriate.

Do not create one giant page component for an entire feature.

# 29. Server Components

Prefer Server Components where appropriate in a Next.js App Router project.

Do not convert a component to a Client Component merely because a deeply nested child needs interaction.

Keep the client boundary as small as practical.

# 30. Client Components

Client Components should contain only the browser/interactivity logic they actually need.

Avoid sending unnecessary server data to the client.

# 31. `"use client"`

Do not add `"use client"` automatically.

Before adding it, confirm the component actually requires:

* state
* effects
* event handlers
* browser APIs
* client-only libraries

# 32. React State

Use state only for values that genuinely need to cause rendering changes.

Do not store derived values unnecessarily.

Bad:

```ts
const [firstName, setFirstName] = useState("");
const [lastName, setLastName] = useState("");
const [fullName, setFullName] = useState("");
```

when `fullName` can simply be derived:

```ts
const fullName = `${firstName} ${lastName}`;
```

# 33. Keep State Local

Keep state as close as possible to where it is used.

Do not move state globally without a clear requirement.

# 34. Global State

Do not introduce a global state library unless application complexity genuinely requires it.

Before adding one, consider whether the requirement can be handled using:

* Server Components
* URL state
* local state
* context
* server data

# 35. useEffect

Use `useEffect` for synchronization with external systems.

Do not use it as the default solution for application data flow.

Before using an effect, consider whether the logic belongs in:

* Server Components
* event handlers
* derived state
* initial state
* server data fetching

# 36. Effect Dependencies

Do not intentionally omit dependencies simply to prevent an effect from running.

Fix the underlying logic.

Do not disable exhaustive dependency lint rules casually.

# 37. Memoization

Do not add:

```ts
useMemo()
useCallback()
React.memo()
```

without a real reason.

Memoization increases complexity and should solve an actual problem.

# 38. Data Fetching

Use data-fetching patterns appropriate for the project's Next.js version and architecture.

Prefer server-side fetching when it:

* reduces client JavaScript
* improves security
* simplifies data flow

Avoid unnecessary browser requests.

# 39. Avoid Duplicate Requests

Do not repeatedly request the same data when it can reasonably be reused or fetched once.

# 40. Avoid N+1 Queries

Do not query related database records individually inside large loops when a relational query or batch operation is appropriate.

# 41. Query Only Needed Data

Avoid fetching entire records when only a few fields are required.

Retrieve only what the feature needs.

# 42. Large Datasets

Design list pages to scale.

For potentially large datasets use:

* pagination
* server-side filtering
* search
* sorting

Do not load thousands of rows into the browser without reason.

# 43. Forms

Keep form code structured.

Separate:

* validation
* submission logic
* field rendering
* server mutation

when complexity requires it.

# 44. Form Validation

Important validation should have a reliable source of truth.

Avoid duplicating different validation rules across:

* frontend
* Server Actions
* API handlers

Reuse schemas where appropriate.

# 45. Server Validation

Always validate important user input on trusted server-side code.

Client validation improves UX but cannot be trusted for security or data integrity.

# 46. Error Handling

Never silently ignore errors.

Bad:

```ts
try {
  await saveData();
} catch {}
```

Handle expected errors intentionally.

Unexpected errors should be logged appropriately without exposing sensitive information.

# 47. Error Messages

User-facing error messages should be:

* understandable
* concise
* actionable where possible

Do not expose low-level technical implementation details.

# 48. Async Operations

Handle asynchronous operations clearly.

Avoid confusing nested promise chains when `async/await` is more readable.

# 49. Parallel Operations

Use parallel execution only when operations are independent.

Example:

```ts
const [workers, workplaces] = await Promise.all([
  getWorkers(),
  getWorkplaces(),
]);
```

Do not parallelize operations that depend on each other's results.

# 50. Race Conditions

Consider race conditions for:

* duplicate submissions
* concurrent edits
* financial operations
* inventory-like counters
* status transitions

Do not assume only one user can modify data at a time.

# 51. Loading States

All important async UI actions must have an appropriate loading state.

Prevent repeated submissions while processing.

# 52. Empty States

Data-driven components must handle empty results.

Do not assume arrays always contain data.

# 53. Error States

Pages and components must handle failed data retrieval where appropriate.

Avoid leaving broken or misleading UI after an error.

# 54. Optional Data

Components should handle optional data gracefully.

Do not allow missing secondary information to crash an entire page.

# 55. Styling

Follow the project's established styling system.

If Tailwind CSS is used:

* use Tailwind consistently
* reuse design tokens
* reuse existing component styles
* avoid excessive inline styles
* avoid unnecessary custom CSS

# 56. Class Names

When conditional classes become complex, use the project's existing class-name utility.

Do not manually build unreadable class strings repeatedly.

# 57. Avoid Arbitrary Values

Prefer design-system values and existing Tailwind scales.

Use arbitrary values only when the design genuinely requires them.

# 58. Responsive Code

Do not duplicate entire components solely for mobile and desktop unless the experiences genuinely require different structures.

Prefer responsive styling and shared logic.

If separate presentations are necessary, keep shared business logic outside both.

# 59. Accessibility in Code

Use semantic elements.

Bad:

```tsx
<div onClick={handleSave}>Save</div>
```

Better:

```tsx
<button type="button" onClick={handleSave}>
  Save
</button>
```

# 60. Forms and Labels

Inputs should have correctly associated labels.

Do not rely only on placeholders as field labels.

# 61. Images

Images should use appropriate alt behaviour.

Meaningful images need descriptive alt text.

Decorative images should not create unnecessary screen-reader noise.

# 62. Icons

Icon-only buttons require accessible names.

Example:

```tsx
<Button aria-label="Delete worker">
  <TrashIcon />
</Button>
```

# 63. Focus

Do not remove focus outlines without providing an accessible replacement.

# 64. Imports

Keep imports organized and remove unused imports.

Use existing path aliases when available.

# 65. Circular Dependencies

Avoid architectural patterns that create circular imports.

If circular dependencies appear, reconsider module responsibilities.

# 66. Barrel Files

Do not create excessive barrel exports merely for shorter imports.

Use them when they genuinely improve module boundaries.

Avoid barrel files that create unclear dependency graphs or unnecessary bundle effects.

# 67. Comments

Comments should explain decisions rather than repeat implementation.

Use comments for:

* non-obvious logic
* important constraints
* business rules
* unusual workarounds
* security considerations

# 68. TODO Comments

Avoid vague TODOs.

Bad:

```ts
// TODO fix this
```

Better:

```ts
// TODO: add server-side pagination once the worker list exceeds the current page limit.
```

# 69. Console Statements

Do not leave temporary:

```ts
console.log()
console.debug()
```

in production code.

Use intentional logging only where appropriate.

# 70. Debugging Code

Remove:

* fake data
* temporary values
* hard-coded IDs
* bypasses
* temporary flags
* commented debug blocks

before considering a feature complete.

# 71. Hard-Coded Values

Do not hard-code values that should come from:

* configuration
* database
* environment variables
* authenticated user
* application constants

Hard-coded UI text is acceptable when it is genuinely static content.

# 72. Environment Configuration

Keep environment-specific values outside application logic.

Do not duplicate environment variable access across many unrelated files when a configuration layer is appropriate.

# 73. Secrets

Never hard-code secrets.

Never place secrets inside Client Components.

Never commit credentials.

# 74. Dependency Quality

Prefer:

* maintained packages
* widely used packages
* official packages
* packages compatible with current framework versions

Avoid adding a package for trivial functionality.

# 75. Dependency Duplication

Do not install multiple libraries that solve the same problem without a strong reason.

# 76. Dependency Upgrades

Do not upgrade dependencies during unrelated feature work.

Keep upgrades intentional and separately verifiable.

# 77. Business Logic

Keep important business logic independent from UI where practical.

For example, financial calculations should not exist only inside a React table component.

Prefer:

```text
UI
 ↓
business/domain function
 ↓
result
```

# 78. Financial Calculations

Financial calculations require additional care.

Use:

* predictable types
* centralized rules
* explicit rounding
* appropriate decimal handling
* tests where practical

Do not scatter salary calculations across multiple components.

# 79. Historical Values

When historical values matter, preserve snapshots rather than recalculating historical data from current settings.

# 80. Date Logic

Centralize complicated date logic.

Be careful with:

* time zones
* month boundaries
* midnight
* locale formatting
* database timestamps

Do not manually manipulate date strings when a reliable existing utility is available.

# 81. Currency Formatting

Use a shared formatter.

Avoid code such as:

```ts
"Rs. " + amount
```

throughout many components.

Prefer a centralized function such as:

```ts
formatCurrency(amount)
```

# 82. Data Transformation

Transform database/API data in a predictable location.

Avoid repeatedly reshaping the same data in several UI components.

# 83. API Response Shape

When creating APIs, use consistent response structures.

Avoid returning completely different error formats from similar endpoints.

# 84. Status Handling

Use explicit status values.

Do not rely on unexplained numeric statuses when descriptive typed values can be used.

# 85. Immutability

Avoid mutating state or shared objects unexpectedly.

Prefer creating new values where React or application state expects immutability.

# 86. Error Boundaries

Use Next.js/React error boundaries where they provide meaningful recovery or user feedback.

Do not add them everywhere without reason.

# 87. Loading Boundaries

Use route-level or component-level loading boundaries appropriately.

Do not block the entire application for a small local request.

# 88. Performance

Optimize meaningful bottlenecks.

Do not prematurely optimize simple code.

At the same time, avoid obvious problems such as:

* huge client bundles
* repeated network calls
* excessive re-renders
* loading entire databases
* unnecessary image sizes
* expensive calculations on every render

# 89. Client Bundle Size

Keep unnecessary libraries and server-only logic out of Client Components.

Prefer server-side processing when appropriate.

# 90. Dynamic Imports

Use dynamic imports when they meaningfully reduce initial client load for heavy client-only functionality.

Do not use dynamic imports everywhere.

# 91. Images and Assets

Use appropriately sized and optimized assets.

Do not ship unnecessarily huge images.

Avoid duplicate assets.

# 92. Database Code

Keep database access predictable.

Do not scatter complex queries across unrelated UI components.

Use appropriate server/data-access boundaries.

# 93. Transactions

When multiple related database changes must succeed together, prefer transactional behaviour where supported and appropriate.

# 94. Idempotency

For operations that could accidentally execute multiple times, consider whether they should be idempotent.

This is especially important for:

* payments
* payroll generation
* bulk operations
* external integrations

# 95. Security and Code Quality

Do not sacrifice security for shorter code.

Secure and explicit code is preferable to convenient insecure code.

# 96. Refactoring

Refactoring must have a purpose.

Good reasons include:

* reducing meaningful duplication
* separating responsibilities
* improving testability
* fixing architectural problems
* simplifying overly complex code

Do not refactor merely to change style.

# 97. Refactoring Scope

Keep refactoring focused.

Do not combine a large repository-wide refactor with a small feature unless absolutely necessary.

# 98. Backward Compatibility

When modifying shared APIs, components, utilities, or database structures, consider existing consumers.

Avoid breaking interfaces unnecessarily.

# 99. Tests

Important logic should be structured so it can be tested.

Prioritize testability for:

* financial calculations
* validation
* permissions
* transformations
* date logic
* complex utilities

# 100. Do Not Test Implementation Details

Tests should primarily verify behaviour.

Avoid tightly coupling tests to internal implementation when the behaviour can be tested instead.

# 101. Existing Tests

Do not remove or weaken existing tests simply to make a change pass.

Understand why a test fails.

# 102. Linting

Respect existing lint rules.

Do not disable rules globally to avoid fixing code.

If a rule must be disabled locally, there should be a legitimate reason.

# 103. Formatting

Respect the project's formatter.

Do not manually introduce a conflicting formatting style.

# 104. Build Quality

Production code should not knowingly contain:

* type errors
* unresolved imports
* lint errors caused by new code
* broken routes
* invalid environment references

# 105. Final Self-Review

Before considering code complete, review your changes.

Ask:

* Is this simpler than necessary?
* Is any logic duplicated?
* Are names clear?
* Are types safe?
* Are errors handled?
* Is validation sufficient?
* Is server/client separation correct?
* Did I accidentally expose data?
* Is mobile behaviour considered?
* Is accessibility reasonable?
* Did I modify unrelated code?
* Did I leave debug code?

# 106. Definition of Quality

High-quality code in this project should be:

**Easy to understand**

A developer should quickly understand what the code does.

**Easy to change**

Future changes should not require rewriting unrelated parts.

**Hard to misuse**

Types, validation, and APIs should guide developers toward correct usage.

**Predictable**

Similar features should behave similarly.

**Safe**

Errors should not corrupt data or expose sensitive information.

**Focused**

Each part of the code should have a clear responsibility.

**Consistent**

The project should feel like one codebase rather than several unrelated coding styles.

# Final Principle

Do not write code merely because it works.

Write code that works correctly, is understandable, fits the existing architecture, handles failure safely, and can be maintained by another developer in the future.
