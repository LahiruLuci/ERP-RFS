# UI_RESPONSIVE.md

## Purpose

This file defines the UI, UX, responsive-design, accessibility, and interaction standards that every AI coding agent must follow when creating or modifying interfaces in this repository.

The application must remain simple, professional, fast, consistent, and easy to use across all supported devices.

The UI must not be designed only for desktop and adapted later.

Responsiveness, usability, and accessibility must be considered during implementation.

# 1. Core UI Principles

Every screen should prioritize:

1. Clarity
2. Simplicity
3. Consistency
4. Accessibility
5. Responsive behaviour
6. Fast interaction
7. Clear feedback
8. Minimal cognitive load

The interface should feel obvious to use without requiring explanation.

# 2. Design for Real Users

Assume some users may not be highly technical.

Avoid:

* unnecessary complexity
* technical terminology
* clutter
* too many actions at once
* hidden essential controls
* overly dense layouts
* confusing navigation

Prefer:

* clear labels
* obvious primary actions
* helpful feedback
* predictable layouts
* consistent interaction patterns

# 3. Responsive Design Is Mandatory

Every UI feature must work properly on:

* small mobile phones
* standard mobile phones
* large mobile phones
* tablets
* small laptops
* desktop monitors
* large desktop monitors

Do not consider responsiveness optional.

# 4. Minimum Screen Widths to Consider

At minimum, consider behaviour around:

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

Exact breakpoints should follow the project's existing responsive system where possible.

# 5. Mobile-First Thinking

When creating new layouts, consider small-screen behaviour first.

Do not create a complex desktop layout and then simply shrink it.

Think about:

* what is most important
* what can stack
* what can collapse
* what can move into an overflow menu
* what can become a mobile card
* what must always remain visible

# 6. No Accidental Horizontal Scrolling

Avoid page-level horizontal overflow.

Common causes include:

* fixed-width elements
* large tables
* wide forms
* long text
* oversized buttons
* modals
* code blocks
* large badges
* dropdowns

Controlled horizontal scrolling may be used inside a dedicated component, such as a table container, when necessary.

# 7. Layout Containers

Use sensible maximum widths.

Do not stretch content unnecessarily across very wide monitors.

Use different content widths depending on context.

Examples:

* forms can use a narrower content area
* dashboards can use wider layouts
* data tables can use the available page width
* long text should not span excessive line lengths

# 8. Spacing

Use consistent spacing.

Avoid:

* cramped controls
* random gaps
* inconsistent card padding
* excessive empty space

Follow the project's spacing system.

# 9. Grid Layouts

Use responsive grids.

Typical patterns may include:

```text
Mobile: 1 column
Tablet: 2 columns
Desktop: 2–4 columns
```

Choose the number of columns based on content, not only screen width.

# 10. Form Layouts

Mobile forms should usually be one column.

Tablet and desktop forms may use multiple columns where it improves usability.

Example:

```text
Desktop:
Name            NIC
Phone           ETF Number

Mobile:
Name
NIC
Phone
ETF Number
```

Do not force small fields into dense layouts on mobile.

# 11. Form Field Width

Inputs should have enough width to comfortably show common values.

Do not use very narrow fields simply to fit more fields in one row.

# 12. Input Labels

Every form control should have a visible, understandable label.

Do not rely only on placeholders.

Placeholders may provide examples, not replace labels.

# 13. Required Fields

Required fields should be clearly indicated.

Do not rely on users discovering validation errors after submission to understand which fields are required.

# 14. Helper Text

Use helper text only when it provides useful clarification.

Avoid excessive explanation below every field.

# 15. Validation Messages

Validation messages should:

* appear near the related field
* be understandable
* explain how to fix the issue when possible
* not use technical language

Avoid raw validation-library output when it is not user-friendly.

# 16. Mobile Keyboards

Use appropriate input types where useful.

Examples:

```html
type="email"
type="tel"
type="number"
```

Choose input modes carefully for mobile usability.

# 17. Number Inputs

For financial or quantity inputs:

* accept appropriate values
* prevent clearly invalid input
* show units/currency when helpful
* avoid confusing spinner controls when they harm usability

Do not assume browser number-input behaviour is ideal for every financial field.

# 18. Date Inputs

Use date controls that remain usable on mobile.

Be careful with:

* time zones
* date formatting
* browser differences
* invalid ranges

Do not make users manually type complex date formats if a better control is available.

# 19. Buttons

Use clear button hierarchy.

Primary buttons should represent the main action.

Examples:

```text
Save
Add Worker
Create
Approve
Calculate Payroll
```

Secondary buttons may represent:

```text
Cancel
Export
Back
View History
```

Danger actions should visually communicate risk.

# 20. Avoid Too Many Buttons

Do not display many equally important buttons together.

Prioritize actions.

Move less-used actions into:

* overflow menus
* dropdown menus
* secondary sections

where appropriate.

# 21. Mobile Buttons

On small screens:

* allow buttons to stack
* use full-width primary buttons when appropriate
* keep important actions easy to reach
* avoid tiny action icons

Do not hide essential actions just to save space.

# 22. Touch Targets

Interactive elements should be easy to tap.

Avoid tiny:

* icons
* checkboxes
* pagination controls
* dropdown triggers
* action menus
* links

Spacing between nearby controls should reduce accidental taps.

# 23. Icon-Only Buttons

Icon-only buttons must have:

* a clear purpose
* accessible labels
* adequate touch size
* tooltip where helpful

Do not rely on unclear icons without explanation.

# 24. Navigation

Navigation should be simple and predictable.

Users should understand:

* where they are
* where they can go
* how to return

Avoid deeply nested navigation unless necessary.

# 25. Desktop Navigation

Desktop navigation may use a sidebar.

Sidebar items should:

* use clear labels
* group related pages
* show active state
* avoid excessive item count

# 26. Mobile Navigation

On mobile:

* collapse the desktop sidebar
* use a drawer/sheet/menu
* keep the page title clear
* preserve essential actions

The mobile navigation should not permanently consume large screen space.

# 27. Breadcrumbs

Use breadcrumbs when navigation depth makes them useful.

Do not add breadcrumbs to very simple top-level screens unnecessarily.

# 28. Page Headers

Page headers should generally contain:

* clear page title
* short supporting description if useful
* primary action
* optional secondary actions

Do not overcrowd headers.

# 29. Tables

Tables should remain usable with real-world data.

Desktop tables should support appropriate:

* sorting
* filtering
* pagination
* search
* status indicators
* actions

Do not display excessive columns without clear value.

# 30. Responsive Tables

Do not squeeze a large desktop table into a mobile screen.

Use the best solution for the content.

Possible strategies:

1. Hide lower-priority columns.
2. Convert rows to cards.
3. Use expandable rows.
4. Use a separate detail view.
5. Use controlled horizontal scrolling.
6. Move row actions into an overflow menu.

# 31. Mobile Table Priority

On mobile, preserve the most important information first.

Example:

```text
Worker Name
Employee ID
Status
Main Value
Primary Action
```

Secondary details can appear after expansion.

# 32. Table Actions

Avoid showing many icon buttons in every row.

Prefer a compact action menu when several row actions exist.

# 33. Large Data Tables

Do not render huge datasets at once.

Use pagination or another scalable approach.

UI responsiveness also depends on data volume.

# 34. Search

Search should be easy to find on pages with large datasets.

Search inputs should work well on mobile.

Use clear placeholders.

Example:

```text
Search by name, employee ID, NIC or ETF number...
```

# 35. Debounced Search

For server-backed search, debounce input where appropriate to prevent excessive requests.

Do not introduce noticeable lag unnecessarily.

# 36. Search Empty State

Clearly communicate when no matching results exist.

Do not show an unexplained empty table.

# 37. Filters

Desktop filters may appear inline.

On smaller screens, many filters should move into:

* a drawer
* sheet
* collapsible panel

Avoid filling the mobile screen with filter controls.

# 38. Active Filters

Users should be able to understand when filters are active.

Show active filter state where useful.

# 39. Cards

Use cards to group related information.

Do not put every small element inside its own card.

Cards should have clear purpose and hierarchy.

# 40. Dashboard Cards

Dashboard cards should show useful operational information.

Avoid decorative cards that do not help users make decisions.

# 41. Dashboard Density

Do not fill dashboards with unnecessary charts.

Prioritize:

* key numbers
* status
* exceptions
* actions
* trends that matter

# 42. Charts

Use charts only when they improve understanding.

Do not use charts purely for decoration.

Charts must:

* have readable labels
* remain usable on smaller screens
* not depend only on color
* provide meaningful context

# 43. Status Indicators

Use consistent status badges.

Examples:

```text
Active
Inactive
Pending
Approved
Rejected
Paid
Warning
```

Do not rely only on color.

Include text and/or icons.

# 44. Color Usage

Use color intentionally.

Do not use excessive colors.

Reserve strong colors for:

* status
* warnings
* errors
* primary actions

Follow the project's established palette.

# 45. Contrast

Text and interactive controls must maintain good contrast.

Do not use low-contrast text simply for visual subtlety.

# 46. Typography

Maintain a clear hierarchy.

Typical levels:

```text
Page title
Section heading
Card heading
Body text
Secondary text
Helper text
```

Avoid too many font sizes.

# 47. Font Size

Important information should remain comfortably readable.

Do not reduce font sizes drastically to fix layout problems.

# 48. Long Text

Design for realistic long content.

Examples:

* long employee names
* long client names
* long workplace names
* long notes
* email addresses
* large currency values

Use appropriate:

* wrapping
* truncation
* tooltip
* expandable text

depending on context.

# 49. Text Truncation

Do not truncate important information without giving users a way to access the full value when necessary.

# 50. Modals

Use modals for focused tasks.

Good modal use:

* confirmation
* short forms
* quick edits
* small detail views

Avoid putting very complex multi-section forms inside small dialogs.

# 51. Modal Responsiveness

Dialogs must:

* fit small screens
* have scrollable content when necessary
* keep action buttons reachable
* avoid horizontal overflow

# 52. Large Forms

For substantial forms, prefer:

* dedicated pages
* full-height sheets
* appropriate drawers

instead of oversized modals.

# 53. Drawers and Sheets

Use drawers/sheets for contextual tasks where they improve flow.

Ensure the width remains usable across screen sizes.

# 54. Confirmation Dialogs

Important destructive or irreversible actions should require confirmation.

The message should explain consequences.

Avoid vague confirmation text.

# 55. Loading States

Every meaningful async interaction should provide feedback.

Use the smallest appropriate loading scope.

Examples:

* button spinner for form submission
* table skeleton for data loading
* section skeleton for partial content

# 56. Avoid Excessive Full-Screen Loading

Do not block the whole application for a small local operation.

# 57. Skeletons

Use skeletons when they help preserve layout and perceived performance.

Skeletons should roughly represent the final content structure.

# 58. Empty States

Empty states should explain:

* what is missing
* whether that is normal
* what action the user can take next

Example:

```text
No workers found.

Add your first worker to get started.
```

# 59. Error States

Errors should be understandable.

Provide:

* concise explanation
* retry action where appropriate
* safe fallback UI

Do not leave broken components visible.

# 60. Success Feedback

Important actions should provide confirmation.

Examples:

```text
Worker saved successfully.
Payroll approved.
Changes updated.
```

Avoid success notifications for every tiny interaction.

# 61. Toast Usage

Use toasts for temporary feedback.

Do not rely on toasts for information users must refer to later.

# 62. Inline Feedback

Use inline feedback when the user needs the message near the related form or component.

# 63. Disabled States

Disabled controls should:

* look disabled
* remain understandable
* not appear broken

If the reason is not obvious, provide explanation where useful.

# 64. Destructive Actions

Dangerous actions should have consistent visual treatment.

Do not use the same styling as primary positive actions.

# 65. Accessibility

Accessibility must be considered during implementation, not afterward.

Use semantic HTML first.

# 66. Semantic Elements

Use correct elements such as:

```html
button
a
label
form
nav
main
header
section
table
```

Do not create custom behaviour with generic `<div>` elements when semantic alternatives exist.

# 67. Keyboard Accessibility

All interactive functionality should be usable with a keyboard.

Avoid interaction patterns that depend exclusively on:

* mouse hover
* touch gestures
* pointer position

# 68. Focus States

Interactive controls must have visible focus states.

Do not remove outlines without an accessible replacement.

# 69. Focus Management

Dialogs, drawers, and dynamic interfaces should manage focus appropriately.

When a modal closes, focus should generally return to a logical trigger element.

# 70. Form Accessibility

Form controls should have:

* associated labels
* clear validation state
* understandable errors
* accessible descriptions where needed

# 71. ARIA

Use ARIA only when necessary.

Prefer semantic HTML over adding unnecessary ARIA attributes.

# 72. Images

Meaningful images should have descriptive alt text.

Decorative images should use appropriate empty alt behaviour.

# 73. Icons

Icons that communicate essential meaning should not rely only on visual appearance.

Provide accessible names where needed.

# 74. Color Independence

Do not communicate information only through color.

Example:

Do not show:

```text
Green = Approved
Red = Rejected
```

without also showing the text status.

# 75. Responsive Accessibility

Do not accidentally hide important accessible content at certain breakpoints.

Hidden elements should not remain unintentionally keyboard-focusable.

# 76. Dropdown Menus

Dropdowns should:

* fit inside the viewport
* remain keyboard accessible
* not open off-screen
* clearly identify selected values

# 77. Select Controls

For long option lists, consider searchable selectors.

Avoid extremely long basic dropdowns when users need to find items quickly.

# 78. Mobile Dropdowns

Ensure dropdowns and popovers do not overflow small screens.

# 79. Popovers

Popovers should be used for concise contextual information.

Do not hide essential functionality only inside hover-dependent popovers.

# 80. Tooltips

Tooltips are useful for:

* icon explanations
* short clarifications

Do not use tooltips as a replacement for clear labels.

# 81. Hover States

Hover states may improve desktop UX, but essential information must remain available on touch devices.

# 82. Sticky UI

Use sticky:

* headers
* action bars
* table headers

only when they improve usability.

Do not allow sticky elements to cover important content.

# 83. Mobile Sticky Actions

For long mobile forms, a sticky primary action can be useful.

Ensure it does not hide fields or content.

# 84. Safe Viewport Height

Be careful with fixed `100vh` layouts on mobile browsers.

Use modern viewport units or flexible layouts where appropriate.

# 85. Scroll Behaviour

Avoid nested scrolling regions unless necessary.

Users should generally have one clear primary scroll area.

# 86. Page Height

Do not force full-screen heights when content naturally needs to grow.

# 87. Fixed Widths

Avoid hard-coded large pixel widths unless the content genuinely requires them.

Prefer responsive width constraints.

# 88. Fixed Heights

Avoid fixed heights for text-heavy components.

Allow content to grow naturally.

# 89. Responsive Images

Images should scale correctly with their containers.

Avoid distortion.

Preserve aspect ratio.

# 90. Next.js Image

Use Next.js image optimization where it makes sense.

Provide appropriate dimensions or sizing behaviour to reduce layout shift.

# 91. Layout Shift

Avoid interfaces that jump significantly while loading.

Reserve space for:

* images
* asynchronous content
* loaders

where practical.

# 92. Performance and UI

UI design should consider performance.

Avoid rendering unnecessarily large DOM trees or complex client-side widgets.

# 93. Animation

Use animations sparingly.

Animations should improve understanding, not slow users down.

# 94. Motion Duration

Keep common UI transitions short and responsive.

Avoid long dramatic transitions in operational business interfaces.

# 95. Reduced Motion

Respect reduced-motion preferences where animations are significant.

# 96. Avoid Animation for Essential Feedback

Do not require users to notice an animation to understand whether an action succeeded.

# 97. Tables vs Cards

Choose based on task.

Tables are better when users need to compare many rows.

Cards are better when:

* mobile space is limited
* each item has varied content
* comparison across columns is less important

# 98. Mobile Detail Views

Instead of showing every field in a mobile list, show a summary and allow users to open details.

# 99. Page Actions

Primary page actions should remain predictable.

Typical placement:

* top-right on desktop
* prominent full-width or compact sticky action on mobile where appropriate

# 100. Action Consistency

The same action should not appear in wildly different places across similar pages.

# 101. Content Hierarchy

Place the most important information first.

Do not force users to scan low-value metadata before key content.

# 102. Progressive Disclosure

Show simple information first.

Reveal advanced options only when needed.

This reduces clutter.

# 103. Advanced Forms

For complex forms, group fields into logical sections.

Examples:

```text
Personal Information
Employment Information
Payment Information
Notes
```

Avoid one extremely long unstructured form.

# 104. Step-Based Flows

Use multi-step workflows only when they genuinely simplify complex tasks.

Do not break a simple form into unnecessary steps.

# 105. Form Persistence

For very long forms, consider whether users could lose significant work.

If autosave or draft behaviour is used, make it clear.

# 106. Autosave

Do not silently autosave sensitive changes without clear UI feedback.

For financial or permission changes, explicit save/approval is often safer.

# 107. Unsaved Changes

For substantial forms, consider warning users before leaving with unsaved changes when appropriate.

# 108. Responsive Filter Bars

Filter bars should wrap or collapse cleanly.

Do not create one long horizontal row that breaks on smaller widths.

# 109. Pagination

Pagination controls should:

* be easy to understand
* work on mobile
* avoid tiny click targets
* show current state clearly

# 110. Large Numbers

Format large numeric values consistently.

Do not display unreadable raw numbers when separators improve readability.

# 111. Currency Display

Use the project's shared currency formatter.

Keep currency layout consistent across:

* tables
* cards
* forms
* reports

# 112. Date Display

Use consistent date formats across the application.

Do not use several different formats without reason.

# 113. Status Formatting

Status labels should use consistent text and style throughout the application.

# 114. Search and Filter Persistence

Where useful, keep search/filter state in the URL so:

* refresh preserves state
* back navigation behaves predictably
* links can be shared

Do not do this for every trivial local interaction.

# 115. Back Navigation

Avoid flows where users lose context after viewing details.

Preserve list/search state where practical.

# 116. Responsive QA

Before completing any UI feature, review at minimum:

```text
320px
375px
390px
768px
1024px
1280px+
```

# 117. Mobile QA Checklist

Check:

* navigation works
* primary actions are visible
* forms fit
* labels fit
* dialogs fit
* tables are usable
* dropdowns stay on-screen
* no page-level horizontal scrolling
* text does not overlap
* touch targets are usable

# 118. Tablet QA Checklist

Check:

* layouts are not awkwardly stretched
* grids transition appropriately
* sidebars/navigation behave correctly
* forms use available space intelligently

# 119. Desktop QA Checklist

Check:

* content does not become excessively wide
* spacing remains balanced
* tables use width effectively
* primary actions are easy to locate

# 120. Large-Screen QA

On wide monitors:

* use max-width where appropriate
* avoid extremely long lines
* avoid cards becoming excessively stretched
* maintain meaningful grouping

# 121. Content Overflow QA

Test mentally or practically with:

* long names
* long notes
* no data
* very large salary values
* large record counts
* validation errors

# 122. Interaction QA

Check:

* hover
* focus
* active
* disabled
* loading
* selected
* error

states where applicable.

# 123. Do Not Solve Responsive Problems With Hacks

Do not solve responsiveness by:

* hiding essential features
* shrinking text excessively
* setting arbitrary widths
* adding page-wide horizontal scrolling
* duplicating whole pages for each device
* removing labels

# 124. Avoid Unnecessary Device-Specific Code

Prefer responsive CSS and shared components.

Use JavaScript screen-width detection only when actual behavioural differences require it.

# 125. Do Not Depend on Exact Device Sizes

Design fluid layouts.

Do not optimize only for a single phone model or desktop resolution.

# 126. Consistency

Similar pages should use similar:

* page headers
* filters
* buttons
* table styles
* forms
* empty states
* action menus

Users should learn patterns once and reuse that knowledge.

# 127. Professional Appearance

The UI should feel clean and modern.

Avoid:

* excessive shadows
* excessive gradients
* too many colors
* decorative animation
* inconsistent spacing
* overly rounded everything
* visual noise

Professional business software should prioritize clarity.

# 128. Final UI Review

Before declaring UI work complete, ask:

* Is the page easy to understand immediately?
* Is the main action obvious?
* Does it work on mobile?
* Does it work on tablet?
* Does it work on desktop?
* Is any content overflowing?
* Are important controls accessible?
* Are errors understandable?
* Are loading states present?
* Is the layout visually consistent?
* Is there unnecessary clutter?

# Final Principle

Do not create a UI that only looks good in one screenshot.

Create interfaces that remain usable, responsive, accessible, consistent, and understandable during real daily business use across different devices and data conditions.
