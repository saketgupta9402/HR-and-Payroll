# Component Catalogue
## High-Density UI Design System

### Design Tokens

#### Spacing Scale
- `2px` - Minimal spacing (between icons)
- `4px` - Tight spacing (within components)
- `8px` - Default gutter (base unit)
- `12px` - Moderate spacing (between sections)
- `16px` - Comfortable spacing (card padding)

#### Type Scale
- `text-xs`: 14px (labels, captions)
- `text-sm`: 16px (body text, default)
- `text-base`: 18px (emphasized text)
- `text-lg`: 22px (section headers)
- `text-xl`: 28px (page titles)

#### Font Weights
- `400` - Regular (body text)
- `600` - Semibold (labels, emphasis)
- `700` - Bold (headers)

#### Colors
- Base: Neutral 50-900 palette
- Accent: Primary brand color + muted variant
- Surface: Background, card backgrounds
- Border: Subtle borders (1px, neutral-200)
- Status: Success (green-600), Warning (yellow-600), Error (red-600)

#### Elevation
- Level 0: No shadow (default surface)
- Level 1: `shadow-sm` (subtle elevation - cards)
- Level 2: `shadow` (moderate elevation - modals)
- Hover: Raise 2-4px + increase shadow

#### Transitions
- Duration: 150-220ms
- Easing: `ease-in-out`
- Properties: transform, box-shadow, opacity, color

---

## Components

### 1. App Shell

**Purpose**: Main application container with header, sidebar, and content area.

**Anatomy**:
- **Header**: Compact (48px height), left logo, center title (optional), right utilities
- **Sidebar**: Collapsible (240px expanded, 64px collapsed), icons + labels
- **Content**: Flexible width, fills remaining space, compact padding (8-12px)

**Responsive**:
- Desktop (≥1200px): Sidebar visible, header full width
- Tablet (768-1199px): Sidebar collapsible, header adaptive
- Mobile (≤767px): Sidebar drawer, header compact

**Classes**:
```css
.app-shell { @apply flex min-h-screen }
.app-header { @apply h-12 border-b bg-background/95 backdrop-blur }
.app-sidebar { @apply w-16 lg:w-60 transition-all duration-200 }
.app-content { @apply flex-1 p-2 lg:p-3 bg-muted/30 }
```

---

### 2. Cards

**Purpose**: Container for grouped content with optional header and actions.

**Anatomy**:
- **Container**: Rounded corners (8px), border, subtle shadow
- **Header**: Compact padding (12px), title + optional menu button
- **Content**: Tight padding (12-16px), flexible content area
- **Footer**: Compact padding (12px), action buttons

**Elevation Levels**:
- Default: `shadow-sm` (Level 1)
- Hover: `shadow-md` + `-translate-y-0.5` (raise 2px)
- Active: `shadow` (Level 2)

**Responsive**:
- Dense on mobile (padding: 8px)
- Standard on desktop (padding: 12px)

**Classes**:
```css
.card { @apply rounded-lg border bg-card shadow-sm transition-all duration-150 }
.card:hover { @apply shadow-md -translate-y-0.5 }
.card-header { @apply px-3 py-2 flex items-center justify-between border-b }
.card-content { @apply px-3 py-2.5 }
.card-footer { @apply px-3 py-2 border-t flex items-center gap-2 }
```

---

### 3. Tables

**Purpose**: Display tabular data with sortable headers and row actions.

**Anatomy**:
- **Container**: Border, rounded corners (8px), overflow scroll
- **Header**: Dense (40px height), sticky, sortable indicators
- **Row**: Compact (36px height), hover state, clickable
- **Cell**: Tight padding (8px horizontal, 10px vertical)
- **Action Column**: Fixed right, 56px width, icon buttons

**Responsive**:
- Desktop: All columns visible
- Tablet: Hide less important columns
- Mobile: Stack layout or horizontal scroll

**Classes**:
```css
.table { @apply w-full border rounded-lg overflow-hidden }
.table-header { @apply bg-muted/50 border-b sticky top-0 }
.table-row { @apply h-9 border-b hover:bg-muted/50 transition-colors cursor-pointer }
.table-cell { @apply px-2 py-2.5 text-sm align-middle }
.table-action-cell { @apply w-14 px-1 text-right }
```

---

### 4. Forms

**Purpose**: Input fields with labels and inline validation.

**Anatomy**:
- **Container**: Compact spacing (8px between fields)
- **Label**: Small (14px), above input, semibold
- **Input**: Compact (36px height), border, focus ring
- **Helper Text**: Small (12px), below input
- **Error**: Red text, inline below field

**Responsive**:
- Stack on mobile (full width)
- Side-by-side on desktop (when appropriate)

**Classes**:
```css
.form-group { @apply space-y-1 mb-3 }
.form-label { @apply text-xs font-semibold text-foreground }
.form-input { @apply h-9 px-3 text-sm border rounded-md focus:ring-2 focus:ring-ring/30 }
.form-error { @apply text-xs text-destructive mt-0.5 }
.form-helper { @apply text-xs text-muted-foreground mt-0.5 }
```

---

### 5. Modals & Drawers

**Purpose**: Overlay dialogs for focused interactions.

**Anatomy**:
- **Backdrop**: Dark overlay (backdrop-blur)
- **Container**: Centered, max-width (640px), max-height (80vh)
- **Header**: Compact (48px), title + close button
- **Content**: Scrollable, compact padding (16px)
- **Footer**: Compact (48px), action buttons right-aligned

**Responsive**:
- Desktop: Centered modal
- Mobile: Full-screen or bottom drawer

**Classes**:
```css
.modal-backdrop { @apply fixed inset-0 bg-background/80 backdrop-blur-sm z-50 }
.modal-container { @apply fixed inset-4 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 max-w-2xl w-full max-h-[80vh] bg-card rounded-lg border shadow-lg flex flex-col }
.modal-header { @apply h-12 px-4 border-b flex items-center justify-between }
.modal-content { @apply flex-1 overflow-y-auto px-4 py-3 }
.modal-footer { @apply h-12 px-4 border-t flex items-center justify-end gap-2 }
```

---

### 6. Notifications (Toasts)

**Purpose**: Ephemeral status messages.

**Anatomy**:
- **Container**: Fixed bottom-right, stacked
- **Item**: Compact (48px), border, shadow, icon + message
- **Auto-dismiss**: 3-5 seconds
- **Types**: Success (green), Error (red), Warning (yellow), Info (blue)

**Classes**:
```css
.toast-container { @apply fixed bottom-4 right-4 z-50 flex flex-col gap-2 }
.toast-item { @apply h-12 px-4 rounded-lg border bg-card shadow-md flex items-center gap-2 min-w-[320px] max-w-md }
```

---

### 7. Buttons

**Purpose**: Interactive elements for actions.

**Sizes**:
- **sm**: `h-8 px-3 text-xs` (icon buttons, inline actions)
- **default**: `h-9 px-4 text-sm` (primary actions)
- **lg**: `h-10 px-5 text-base` (emphasis)

**Variants**:
- **default**: Primary action, solid background
- **outline**: Secondary action, border only
- **ghost**: Tertiary action, transparent
- **destructive**: Delete/danger action, red

**Hover**: `translate-y-[-1px] shadow-md`
**Focus**: `ring-2 ring-ring/30`

---

### 8. Sidebar Navigation

**Purpose**: Primary navigation with collapsible state.

**Anatomy**:
- **Expanded**: 240px width, icon + label
- **Collapsed**: 64px width, icon only
- **Item**: Compact (36px height), hover highlight
- **Active**: Background accent, bold text
- **Badge**: Small circle, right-aligned

**Classes**:
```css
.sidebar { @apply w-16 lg:w-60 transition-all duration-200 border-r bg-sidebar }
.sidebar-item { @apply h-9 px-2 lg:px-3 flex items-center gap-2 lg:gap-3 rounded-md hover:bg-sidebar-accent transition-colors }
.sidebar-item-active { @apply bg-sidebar-accent text-sidebar-accent-foreground font-semibold }
.sidebar-icon { @apply h-4 w-4 flex-shrink-0 }
.sidebar-label { @apply text-sm flex-1 hidden lg:block }
```

---

### 9. Timesheet / List View

**Purpose**: Display time entries with compact row layout.

**Anatomy**:
- **Row**: Dense (40px), date + hours + actions
- **Inline Actions**: Icon buttons on right
- **Sparkline**: Mini chart for trends (optional)
- **Status Badge**: Small, color-coded

**Classes**:
```css
.timesheet-row { @apply h-10 px-3 flex items-center gap-3 border-b hover:bg-muted/50 }
.timesheet-date { @apply w-24 text-sm font-medium }
.timesheet-hours { @apply flex-1 text-sm }
.timesheet-actions { @apply w-12 flex items-center gap-1 justify-end }
```

---

## Implementation Notes

### Preserve IDs & Classes
- All existing IDs must remain unchanged
- CSS class names used by JavaScript must be preserved
- Add new utility classes alongside existing ones

### Responsive Breakpoints
- Mobile: `max-width: 767px`
- Tablet: `768px - 1199px`
- Desktop: `min-width: 1200px`

### Accessibility
- All interactive elements must have focus states
- Keyboard navigation must work
- ARIA attributes preserved or improved
- Color contrast: WCAG AA minimum

### Performance
- Use Tailwind utility classes (no custom CSS where possible)
- Keep bundle size minimal
- Avoid heavy animations
- Optimize for 60fps interactions

