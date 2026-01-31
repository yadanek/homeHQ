# UI Architecture for HomeHQ

## 1. UI Structure Overview

HomeHQ follows a **Single-Page Command Center** architecture with persistent navigation and dynamic content loading. The interface prioritizes **zero-friction logistics automation** through real-time AI suggestions and optimistic UI updates.

### Core Architectural Principles

1. **Mobile-First Responsiveness**: Bottom navigation on mobile (≤767px), top navigation bar on desktop (≥1024px)
2. **Optimistic UI**: Immediate visual feedback using React 19's `useOptimistic` hook for task completion and suggestion acceptance
3. **Binary Visibility Model**: Clear visual distinction between Private (lock icon, outline style) and Shared (solid background) content
4. **Real-Time AI Integration**: Space-triggered debounced analysis of event titles via POST /events/analyze
5. **Zero-Trust Security**: Row Level Security (RLS) enforced at database level, reflected in UI access controls
6. **Component Library**: shadcn/ui components for consistent, accessible UI patterns
7. **Responsive Design**: Tailwind CSS utility variants (sm:, md:, lg:, xl:) for breakpoint-specific styling

### Layout Breakpoints

- **Mobile**: ≤767px - Bottom navigation, full-screen views, no sidebars
- **Tablet**: 768px - 1023px - Top navigation, collapsible task sidebar
- **Desktop**: ≥1024px - Top navigation bar, calendar with task sidebar on right

### State Management Strategy

- **Authentication State**: Supabase Auth session (JWT tokens)
- **Data Fetching**: React Server Components where applicable, SWR/React Query for client-side
- **Mutations**: React 19 Actions with optimistic updates
- **Local UI State**: React useState for modals, filters, form inputs
- **Sync Conflicts**: Last-write-wins with Toast notifications

---

## 2. View List

### 2.1. Landing Page (Unauthenticated)

**Path**: `/`

**Main Purpose**: Welcome visitors, communicate value proposition, convert to sign-ups

**Key Information**:
- Product tagline: "Your Family's Command Center"
- Core value proposition: "Reduce mental load with automatic task suggestions"
- Feature highlights: AI-powered logistics, shared calendar, task automation
- Social proof placeholders (post-MVP)

**Key Components**:
- Hero section with CTA buttons (Sign Up / Log In)
- Feature showcase cards (3-column on desktop, stacked on mobile)
- Footer with links (Privacy Policy, Terms of Service)

**UX Considerations**:
- Clear primary CTA above the fold
- Avoid overwhelming users with features (focus on core benefit)
- Fast page load (minimal JS, optimized images)

**Accessibility**:
- Semantic HTML5 structure
- ARIA landmarks for navigation
- Sufficient color contrast (WCAG AA minimum)
- Focus indicators for keyboard navigation

**Security**:
- No sensitive data exposed
- Rate limiting on form submissions (handled by Supabase)

---

### 2.2. Register View

**Path**: `/auth/register`

**Main Purpose**: Create new user account

**Key Information**:
- Form fields: Email, Password, Display Name
- Password requirements (min 8 characters, shown dynamically)
- Link to Login view for existing users
- Error messages (email already exists, password too weak)

**Key Components**:
- Registration form with validation
- Password strength indicator
- Submit button with loading state
- OAuth providers (future enhancement)

**UX Considerations**:
- Inline validation on blur
- Clear error messages next to fields
- Auto-focus on email field
- Disable submit until form is valid

**Accessibility**:
- Labels associated with inputs (for attribute)
- ARIA live region for error announcements
- Visible focus states
- Error messages with role="alert"

**Security**:
- Client-side validation (UX) + server-side validation (security)
- Password field type="password"
- No password hints or storage
- CSRF protection via Supabase

**API Integration**:
- POST /auth/register
- On success: Store session and redirect to onboarding

---

### 2.3. Login View

**Path**: `/auth/login`

**Main Purpose**: Authenticate existing users

**Key Information**:
- Form fields: Email, Password
- "Forgot Password?" link (post-MVP)
- Link to Register view
- Error messages (invalid credentials, account locked)

**Key Components**:
- Login form
- Submit button with loading state
- "Remember me" checkbox (optional)
- Link to password reset flow

**UX Considerations**:
- Auto-focus on email field
- Show/hide password toggle
- Clear generic error for failed login (don't reveal if email exists)
- Redirect to intended destination after login

**Accessibility**:
- Same standards as Register View
- Screen reader announces login success

**Security**:
- Rate limiting prevents brute force attacks
- Generic error messages prevent user enumeration
- Session token stored in httpOnly cookie

**API Integration**:
- POST /auth/login
- On success: Fetch user profile (GET /profiles/me) and redirect to dashboard

---

### 2.4. Create Family View

**Path**: `/onboarding/create-family`

**Main Purpose**: Create new family hub (user becomes admin)

**Key Information**:
- Form field: Family Name (e.g., "Smith Family")
- Explanation: "You'll be the admin and can invite family members"
- Preview of admin capabilities (generate codes, manage settings)
- Skip option (logout and join existing family instead)

**Key Components**:
- Single-field form with clear label
- Explanation card with admin role benefits
- Submit button: "Create Family"
- Alternative action: "Join an Existing Family"

**UX Considerations**:
- Pre-fill with "[Display Name]'s Family" as placeholder
- Validate name is not empty after trim
- Loading state during family creation
- Success animation before redirect

**Accessibility**:
- H1 heading: "Create Your Family Hub"
- Descriptive helper text below input
- Focus on input on mount

**Security**:
- User must be authenticated (check session)
- Cannot create multiple families (409 Conflict handled gracefully)
- Family name sanitized on backend

**API Integration**:
- POST /families with { name, display_name }
- On success: JWT metadata updated with family_id, redirect to dashboard

---

### 2.5. Join Family View

**Path**: `/onboarding/join-family`

**Main Purpose**: Redeem invitation code to join existing family

**Key Information**:
- Form field: Invitation Code (8-character alphanumeric)
- Instructions: "Ask your family admin for the code"
- Error messages (invalid code, expired, already used)
- Alternative action: "Create Your Own Family"

**Key Components**:
- Invitation code input (auto-uppercase, 8-char limit)
- Submit button: "Join Family"
- Link to Create Family view
- Visual feedback for code validation

**UX Considerations**:
- Auto-format code to uppercase
- Validate length client-side (8 characters)
- Clear error messages for different failure modes
- Loading state during redemption

**Accessibility**:
- Label: "Enter Invitation Code"
- Error messages with role="alert"
- Success announcement for screen readers

**Security**:
- Rate limiting on redemption endpoint (5 requests/hour per IP)
- Server validates code hasn't expired or been used
- User cannot join multiple families

**API Integration**:
- POST /invitations/redeem with { code, display_name }
- On success: JWT updated, redirect to dashboard with welcome toast

---

### 2.6. Main Dashboard - Calendar View with Daily Tasks Sidebar

**Path**: `/dashboard` (default, user lands here after login)

**Main Purpose**: Display family events on calendar grid with daily task sidebar on the right

**Layout Structure**:
- **Desktop (≥1024px)**: Calendar occupies main area (left/center), daily tasks sidebar on right (320px width)
- **Tablet (768px-1023px)**: Calendar full width, collapsible tasks sidebar (slides from right)
- **Mobile (≤767px)**: Calendar full screen, tasks accessible via bottom navigation (separate view)

**Key Information**:
- Calendar grid (monthly view on desktop, weekly view on mobile)
- Events with visibility indicators (lock icon for private)
- Tasks with due_date rendered as calendar items
- Daily tasks sidebar showing tasks for selected date (default: today)
- Current date highlighted
- Event count badges on dates

**Key Components**:

**Calendar Area** (Main):
- Top bar with navigation (shadcn/ui Navigation Menu): Calendar / Tasks / Family / Profile
- Calendar controls (month/year navigation, filter toggle)
- Calendar grid (Schedule-X integration)
- Event items (inline on calendar)
- Task items (inline on calendar, distinct styling)
- Filter toggle buttons (Everything / My / Family)
- Add Event button (desktop) / FAB (mobile)
- Empty state (Quick Start Cards if no events)

**Daily Tasks Sidebar** (Right, desktop only):
- Header bar: "Tasks for [Selected Date]" (default: "Today") with '+' icon button (top-right corner)
- Task list filtered by selected date
- Each task item with checkbox, title, assignee
- '+' button opens Task Creation Modal with due_date pre-filled to selected date
- Shows completed tasks (grayed out)
- Empty state: "No tasks for this day"

**UX Considerations**:
- Default view: Everything (show all accessible events)
- Click on calendar date: Updates task sidebar to show tasks for that date
- Click event: Opens Event Edit Modal
- Click task (in sidebar): Opens Task Edit Modal
- Sidebar collapsible on tablet (hamburger icon)
- Smooth transitions between month/day views
- Maximum space for calendar (no left sidebar)

**Responsive Behavior**:
- **Desktop**: Calendar + task sidebar visible simultaneously
- **Tablet**: Calendar full width, task sidebar collapses to drawer (opened by icon)
- **Mobile**: Calendar and tasks are separate views via bottom navigation

**Accessibility**:
- Calendar table with proper ARIA grid role
- Keyboard navigation (arrow keys, Enter to select)
- Screen reader announces date changes
- High contrast for event items
- Focus trap in modals

**Security**:
- RLS filters events automatically:
  - Shared events: visible to all family members
  - Private events: visible only to creator
- No client-side filtering needed for security

**API Integration**:
- GET /events?start_date={firstDayOfMonth}&end_date={lastDayOfMonth}
- GET /tasks?due_after={firstDayOfMonth}&due_before={lastDayOfMonth}
- Combine and render on calendar grid
- Real-time updates via polling (1-minute interval) or WebSocket (post-MVP)

**Empty State**:
- Quick Start Cards with example events:
  - "Try typing: Dentist appointment on Friday"
  - "Try typing: Emma's birthday party"
  - "Try typing: Weekend trip to the mountains"
- Each card has "Try it" button that opens Event Creation Modal with pre-filled title

---

### 2.7. All Tasks View

**Path**: `/dashboard/tasks` (accessible via top navigation or bottom nav on mobile)

**Main Purpose**: Display all tasks (with and without due dates) in unified feed, not filtered by date

**Usage Context**:
- **Desktop**: Full-screen view when user clicks "Tasks" in top navigation (replaces calendar + sidebar)
- **Mobile**: Full-screen view when user taps "Tasks" in bottom navigation

**Key Information**:
- Complete task list (all tasks: manual + AI-generated)
- Task metadata: Title, due date, assignee, completion status, source event
- Filter controls: Completed/Pending, Private/Shared, Assigned to Me/All
- Sort controls: Due Date (asc/desc), Created Date (desc)
- Completed tasks (grayed out, strikethrough, visible)

**Key Components**:
- Page header: "All Tasks"
- Filter bar (shadcn/ui Tabs or Toggle Group)
- Task list (scrollable, grouped)
- Task item component (Task Item 5.2):
  - Checkbox (completion toggle)
  - Title
  - Due date badge
  - Assignee avatar/name
  - Visibility indicator (lock icon if private)
  - Source event link (if from suggestion)
  - Edit/Delete actions (on hover or long-press)
- Add Task button (floating on desktop, FAB on mobile)
- Empty state (Quick Start Cards if no tasks)

**UX Considerations**:
- Default sort: Due date ascending (soonest first)
- Completed tasks remain visible (not auto-hidden)
- Optimistic UI: Checkbox immediately updates on click
- Group by: Today, This Week, Later, No Due Date
- Distinct from Daily Tasks Sidebar (which shows only tasks for selected date)

**Accessibility**:
- List semantic markup (ul/li)
- Checkboxes with labels
- Keyboard shortcuts (Space to toggle completion)
- Screen reader announces task completion

**Security**:
- RLS filters tasks automatically
- Private tasks only visible to creator
- Shared tasks visible to all family members

**API Integration**:
- GET /tasks with query params for filters and sort
- PATCH /tasks/:taskId { is_completed: true } on checkbox toggle
- DELETE /tasks/:taskId for archive action
- Pagination (limit: 100, load more on scroll)

**Empty State**:
- Quick Start Cards:
  - "Tasks appear here automatically when you create events"
  - "Or add a manual task" (button)
- Visual: Illustration of calendar → task flow

---

### 2.8. Event Creation Modal

**Path**: `/dashboard?modal=create-event` (modal overlay, not separate route)

**Main Purpose**: Create new event, receive real-time AI suggestions, and bulk-create tasks

**Key Information**:
- Form fields:
  - Title (with real-time AI analysis)
  - Description (optional)
  - Start Date & Time
  - End Date & Time
  - Visibility toggle (Private / Shared)
  - Participants (multi-select, only for Shared events)
- AI Suggestions panel (below title field, appears dynamically)
- Bulk task creation via accept_suggestions array

**Key Components**:
- Modal overlay with close button (shadcn/ui Dialog)
- Form inputs with validation
- AI Suggestions list:
  - Each suggestion: Checkbox, icon, title, due date hint
  - Checkbox allows multi-selection
  - Suggestions remain visible (don't disappear when checked)
- Participants multi-select (disabled if Private, shadcn/ui Multi-Select)
- Submit button: "Create Event" or "Create Event & Tasks" (dynamic label based on selections)
- Cancel button

**UX Considerations**:
- Auto-focus on title field
- Debounced AI analysis (triggers on space character, 500ms debounce)
- Suggestions appear with slide-down animation
- Checkbox selection: User can select multiple suggestions
- Submit button label changes:
  - No suggestions checked: "Create Event"
  - 1 suggestion checked: "Create Event & 1 Task"
  - 2+ suggestions checked: "Create Event & X Tasks"
- Visibility toggle disables participants when Private selected
- Real-time validation (e.g., end time must be after start time)
- Keyboard shortcuts: Cmd+Enter to submit

**Bulk Task Creation Flow**:
1. User types event title → AI suggestions appear
2. User checks desired suggestions (e.g., ✓ "Prepare medical documents")
3. User fills event details (date, time, participants)
4. User clicks "Create Event & 1 Task"
5. System:
   - Collects checked suggestion_ids into array: ["health"]
   - Sends POST /events with accept_suggestions: ["health"]
   - Backend creates event + tasks atomically
   - Returns: { event, suggestions, created_tasks }
6. UI updates optimistically:
   - Event appears on calendar
   - Tasks appear in sidebar and All Tasks view
   - Toast: "Event and task created"

**Accessibility**:
- Modal traps focus (shadcn/ui Dialog handles this)
- Escape key closes modal
- ARIA role="dialog"
- Focus returns to trigger button on close
- Suggestions announced via ARIA live region
- Checkboxes with labels for screen readers

**Security**:
- Participants validated on backend (must be in same family)
- Private events cannot have participants (enforced on backend)

**API Integration**:
- POST /events/analyze (on title change, debounced)
  - Request: { title, start_time, participant_ids }
  - Response: { suggestions: [{ suggestion_id, title, due_date, description }] }
- POST /events (on form submit with checked suggestions)
  - Request: { title, description, start_time, end_time, is_private, participant_ids, accept_suggestions: ["health", "birthday"] }
  - Response: { event, suggestions, created_tasks: [...] }
  - Backend creates event + all accepted tasks in single transaction
- Optimistic UI: Immediately add event and tasks to views, sync with server response

**Error Handling**:
- Inline validation errors below fields
- Toast notification for server errors
- If task creation fails, entire transaction rolls back (no event created)
- Retry mechanism for network failures

**shadcn/ui Components Used**:
- Dialog (modal)
- Input (text fields)
- Checkbox (suggestions)
- Switch (visibility toggle)
- Button
- Calendar & TimePicker (date/time selection)

---

### 2.9. Event Edit Modal

**Path**: `/dashboard?modal=edit-event&id={eventId}`

**Main Purpose**: Update existing event or delete it

**Key Information**:
- Pre-filled form (same fields as Event Creation)
- Delete button (requires confirmation)
- Last updated timestamp
- Created by user name (read-only)

**Key Components**:
- Same form structure as Event Creation Modal
- No AI suggestions (only on creation)
- Delete button (bottom-left, destructive styling)
- Save button: "Update Event"
- Cancel button

**UX Considerations**:
- Load event data on modal open (loading spinner if slow)
- Highlight changed fields (visual indicator)
- Confirmation dialog for delete action
- Optimistic UI on save

**Accessibility**:
- Same standards as Event Creation Modal
- Delete confirmation dialog is modal-within-modal (focus trap)

**Security**:
- Only event creator can edit (403 error handled gracefully)
- RLS enforces authorization at API level

**API Integration**:
- GET /events/:eventId (on modal open)
- PATCH /events/:eventId (on save)
- DELETE /events/:eventId (on delete confirmation)

---

### 2.10. Task Creation Modal

**Path**: `/dashboard?modal=create-task`

**Main Purpose**: Create manual task (not linked to event)

**Key Information**:
- Form fields:
  - Title
  - Description (optional)
  - Due Date & Time (optional)
  - Assign to (dropdown of family members)
  - Visibility toggle (Private / Shared)

**Key Components**:
- Modal overlay
- Form inputs with validation
- Assignee dropdown (default: current user)
- Submit button: "Create Task"
- Cancel button

**UX Considerations**:
- Auto-focus on title field
- Due date optional (tasks without dates go to "No Due Date" section in Task Feed)
- Default assignee: current user
- Visibility default: Shared

**Accessibility**:
- Standard modal accessibility
- Dropdown keyboard navigable

**Security**:
- Assignee must be in same family (validated on backend)

**API Integration**:
- POST /tasks
  - Request: { title, due_date, assigned_to, is_private }
  - Response: Task object
- Optimistic UI: Immediately add to task feed

---

### 2.11. Task Edit Modal

**Path**: `/dashboard?modal=edit-task&id={taskId}`

**Main Purpose**: Update task, mark complete, or delete

**Key Information**:
- Pre-filled form (same fields as Task Creation)
- Completion checkbox (prominent at top)
- Delete button
- Source event link (if created from suggestion)

**Key Components**:
- Completion toggle (large checkbox with label)
- Form inputs (same as Task Creation)
- Link to source event (if applicable)
- Delete button
- Save button: "Update Task"
- Cancel button

**UX Considerations**:
- Completion checkbox at top (primary action)
- If completed, show completed_by name and timestamp
- Form fields disabled if task is completed (must uncomplete to edit)
- Confirmation dialog for delete

**Accessibility**:
- Standard modal accessibility
- Screen reader announces completion status change

**Security**:
- Creator and assignee can edit (RLS policy)
- Only creator can delete

**API Integration**:
- GET /tasks/:taskId (on modal open)
- PATCH /tasks/:taskId (on save or completion toggle)
- DELETE /tasks/:taskId (on delete confirmation)

---

### 2.12. Family Hub View

**Path**: `/family`

**Main Purpose**: Manage family settings, members, and invitations (admin features)

**Key Information**:
- Family name (editable by admin)
- Member list with roles (Admin/Member)
- Invitation management (admin only):
  - Active invitation codes
  - Generate new code button
  - Code expiration dates

**Key Components**:
- Family header card:
  - Family name with inline edit (admin only)
  - Created date
- Members section:
  - List of members with avatars (initials), names, roles
  - Remove member button (admin only, future enhancement)
- Invitations section (admin only):
  - "Generate Invitation Code" button
  - Active codes table: Code, Created by, Expires at, Copy button
  - Filter toggle: Show expired/used codes

**UX Considerations**:
- Admin-only features hidden for members (not just disabled)
- Copy-to-clipboard button for invitation codes with toast confirmation
- Inline edit for family name (double-click or edit icon)
- Expiration countdown for codes expiring soon

**Accessibility**:
- Table semantic markup for invitations
- Button labels clearly indicate admin actions
- Screen reader announces clipboard copy success

**Security**:
- Admin checks enforced at API level (403 for non-admins)
- Member cannot see or create invitation codes

**API Integration**:
- GET /families/me (family details and members)
- PATCH /families/me { name } (update family name, admin only)
- POST /families/me/invitations { days_valid } (generate code, admin only)
- GET /families/me/invitations (list codes, admin only)

---

### 2.13. Profile Settings View

**Path**: `/profile`

**Main Purpose**: Update user's own profile and account settings

**Key Information**:
- Display name (editable)
- Email (read-only, show "managed by authentication")
- Role in family (read-only)
- Account created date
- Logout button
- Delete account option (post-MVP)

**Key Components**:
- Profile form:
  - Display name input
  - Email display (read-only)
  - Role badge
- Save button
- Logout button (destructive styling, secondary)
- Danger zone (future): Delete account

**UX Considerations**:
- Inline validation for display name
- Confirmation before logout (optional)
- Unsaved changes warning if navigating away

**Accessibility**:
- Form with proper labels
- Logout button with confirmation dialog

**Security**:
- User can only edit own profile (RLS enforced)
- Email changes require re-authentication (post-MVP)

**API Integration**:
- GET /profiles/me (on page load)
- PATCH /profiles/me { display_name } (on save)
- POST /auth/logout (on logout button)

---

### 2.14. Empty States (Embedded)

**Purpose**: Guide users through first use, demonstrate AI capabilities

**Calendar Empty State**:
- Displayed when: No events in current month view
- Content:
  - Heading: "Your calendar is empty"
  - Subheading: "Create your first event and see how HomeHQ suggests tasks automatically"
  - Quick Start Cards (3 examples):
    - Card 1: "Dentist appointment next Friday" → "Try it" button
    - Card 2: "Emma's birthday party" → "Try it" button
    - Card 3: "Weekend trip to mountains" → "Try it" button
- Each "Try it" button opens Event Creation Modal with pre-filled title and demo date

**Task Feed Empty State**:
- Displayed when: No tasks exist
- Content:
  - Heading: "No tasks yet"
  - Subheading: "Tasks appear automatically when you create events, or you can add them manually"
  - Primary CTA: "Add Your First Task" button
  - Secondary CTA: "Create an Event" (navigates to calendar)

**UX Considerations**:
- Empty states are educational, not punishing
- Quick Start Cards demonstrate core value proposition (AI suggestions)
- "Try it" buttons provide guided experience

**Accessibility**:
- Proper heading hierarchy
- Buttons with clear labels

---

## 3. User Journey Map

### 3.1. Primary Use Case: Parent Creates Event and Accepts AI Suggestion

**Goal**: Reduce mental load by automatically suggesting preparation tasks for family events

**Journey Steps**:

1. **Entry Point**: User logs in and lands on Main Dashboard (Calendar View)
   - View: Calendar View (2.6)
   - State: Authenticated, family assigned

2. **Trigger**: User notices upcoming dentist appointment needs to be added
   - Action: Clicks "Add Event" button (desktop) or FAB "+" (mobile)

3. **Event Creation Initiated**: Event Creation Modal opens
   - View: Event Creation Modal (2.8)
   - State: Modal overlay visible, title field focused

4. **Real-Time AI Analysis**: User starts typing title
   - User types: "Dentist ap"
   - User types space after "Dentist"
   - System: Debounced POST /events/analyze triggers (500ms after space)
   - User continues: "Dentist appointment"

5. **AI Suggestion Appears**: Suggestion box slides in below title field
   - Display: "🏥 Detected: Health appointment"
   - Suggestion with checkbox: "Prepare medical documents (1 day before)"
   - Checkbox: Unchecked by default

6. **User Reviews and Selects Suggestion**: User reads suggestion
   - Action: Clicks checkbox next to suggestion
   - Visual: Checkbox becomes checked, suggestion background highlights
   - Submit button updates: "Create Event" → "Create Event & 1 Task"

7. **Multiple Suggestions Flow** (if applicable):
   - User can check multiple suggestions
   - Example: Birthday event might have "Buy gift" + "Send invitations"
   - Submit button: "Create Event & 2 Tasks"
   - All checked suggestion_ids collected: ["health"] or ["birthday_gift", "birthday_invitation"]

8. **Complete Event Details**: User fills remaining event fields
   - Start Date: Selects next Friday
   - Time: 10:00 AM - 11:00 AM
   - Visibility: Shared (toggle)
   - Participants: Selects kids (checkboxes)

9. **Submit Event**: User clicks "Create Event & 1 Task" button
   - System: Optimistic UI immediately:
     - Closes modal
     - Adds event to calendar (placeholder)
     - Adds task(s) to task sidebar and All Tasks view (placeholders)
   - API Call (single request, bulk creation):
     - POST /events with body:
       ```json
       {
         "title": "Dentist appointment",
         "start_time": "2026-01-15T10:00:00Z",
         "end_time": "2026-01-15T11:00:00Z",
         "is_private": false,
         "participant_ids": ["uuid1", "uuid2"],
         "accept_suggestions": ["health"]
       }
       ```
     - Backend creates event + tasks atomically in single transaction
   - Server Response: 
     ```json
     {
       "event": { ... },
       "suggestions": [ ... ],
       "created_tasks": [
         {
           "id": "task_uuid",
           "title": "Prepare medical documents",
           "due_date": "2026-01-14T10:00:00Z",
           "created_from_suggestion": true,
           "suggestion_id": "health"
         }
       ]
     }
     ```
   - System: Updates optimistic placeholders with server IDs

10. **Confirmation & View Update**: Success state
    - Toast notification: "Event and task created" (3 second auto-dismiss)
    - Calendar View: Event visible on next Friday's date
    - Task Sidebar: Task visible for day before appointment (if that date selected)
    - All Tasks View: Task visible in "This Week" section

11. **Follow-Up Action**: Day before appointment
    - User opens app (lands on calendar view)
    - Daily Tasks Sidebar shows: "Prepare medical documents" (due today, in sidebar for today's date)
    - User clicks checkbox to mark complete
    - System: Optimistic UI (strikethrough, grayed out)
    - API: PATCH /tasks/:taskId { is_completed: true }
    - Toast: "Task completed"
    - Task remains visible but grayed out

**Success Criteria**:
- Time from opening modal to event created: < 30 seconds
- AI suggestion appeared within 1 second of typing keyword
- Zero confusion about Private vs Shared (visual indicators clear)
- Task visible in both calendar and task feed

---

### 3.2. Secondary Use Case: New User Onboarding (Create Family)

**Goal**: Get user from registration to first event in < 3 minutes

**Journey Steps**:

1. **Landing Page** → User clicks "Sign Up"
   - View: Landing Page (2.1)

2. **Registration** → User enters email, password, display name
   - View: Register View (2.2)
   - Action: Submit form
   - API: POST /auth/register

3. **Onboarding Choice** → System detects user has no family
   - System: Redirects to Create Family View (2.4)
   - Alternative: Link to Join Family View (2.5)

4. **Family Creation** → User enters family name
   - View: Create Family View (2.4)
   - Default: "[Display Name]'s Family"
   - Action: Submit form
   - API: POST /families { name, display_name }

5. **First-Time Dashboard** → User lands on empty calendar
   - View: Calendar View (2.6) with Empty State
   - Display: Quick Start Cards with example events

6. **Guided First Event** → User clicks "Try it" on example card
   - System: Opens Event Creation Modal with pre-filled title
   - Example: "Dentist appointment next Friday"
   - System: AI suggestion immediately visible (since title contains keyword)

7. **Complete Guided Flow** → User clicks [Add] on suggestion and submits
   - Result: First event and task created
   - Achievement unlocked animation (optional)

8. **Invitation Prompt** → Toast with next step
   - Message: "Great! Now invite your family to share the load"
   - CTA: "Generate Invitation Code"
   - Action: Navigates to Family Hub View (2.12)

**Success Criteria**:
- Total time from sign-up to first event: < 3 minutes
- User understands AI value proposition before leaving onboarding

---

### 3.3. Secondary Use Case: Daily Task Management

**Goal**: Check off completed tasks, maintain visibility of family progress

**Journey Steps**:

1. **Morning Routine** → User opens app, navigates to Task Feed
   - View: Task Feed View (2.7)
   - Display: Tasks grouped by: Today (3 tasks), This Week (5 tasks), Later (2 tasks)

2. **Review Today's Tasks** → User scans "Today" section
   - Task 1: "Prepare medical documents" (created from AI)
   - Task 2: "Buy groceries" (manual task)
   - Task 3: "Call babysitter" (created from AI, assigned to partner)

3. **Complete Task** → User completed grocery shopping
   - Action: Clicks checkbox on "Buy groceries"
   - System: Optimistic UI (immediate strikethrough, grayed out)
   - API: PATCH /tasks/:taskId { is_completed: true }
   - Server: Sets completed_at and completed_by
   - Toast: "Task completed"

4. **View Partner's Progress** → User sees Task 3 completed
   - Visual: Task 3 now has strikethrough and shows "Completed by [Partner Name]"
   - Insight: Partner already handled babysitter call

5. **Add Spontaneous Task** → User remembers another task
   - Action: Clicks "Add Task" button
   - View: Task Creation Modal (2.10)
   - User enters: "Pick up dry cleaning"
   - Due date: Today
   - Assign to: Self
   - Submit: Task appears in "Today" section

**Success Criteria**:
- Task completion feedback is instant (< 100ms perceived)
- User can see family members' completed tasks (shared visibility)
- Manual task creation is friction-free (< 10 seconds)

---

### 3.4. Admin Use Case: Invite Family Member

**Goal**: Admin generates invitation code and shares with new family member

**Journey Steps**:

1. **Navigate to Family Hub** → Admin clicks Family Hub in sidebar/bottom nav
   - View: Family Hub View (2.12)
   - Display: Family name, member list, invitations section

2. **Generate Code** → Admin clicks "Generate Invitation Code"
   - Action: Click button
   - API: POST /families/me/invitations { days_valid: 7 }
   - Response: { code: "ABC12XYZ", expires_at: "..." }
   - Display: Code appears in invitations table

3. **Copy Code** → Admin clicks copy button next to code
   - System: Copies "ABC12XYZ" to clipboard
   - Toast: "Invitation code copied"

4. **Share Code** → Admin shares via text/email (outside app)
   - Context: Admin messages partner: "Join HomeHQ with code: ABC12XYZ"

5. **New Member Journey** → New user receives code
   - New user: Registers account (View 2.2)
   - System: Detects no family, redirects to Join Family View (2.5)
   - New user: Enters code "ABC12XYZ" and display name
   - API: POST /invitations/redeem { code, display_name }
   - Success: User joined, JWT updated with family_id

6. **Admin Sees New Member** → Admin refreshes Family Hub
   - Display: Member list now shows new member with "Member" role
   - Invitation table: Code marked as "Used by [New Member Name]"

**Success Criteria**:
- Code generation is instant (< 500ms)
- Copy-to-clipboard works on all devices
- New member joins seamlessly (single code entry)

---

## 4. Layout and Navigation Structure

### 4.1. Desktop Layout (≥1024px)

**Structure**: Top Navigation Bar + Main Content Area + Task Sidebar (on calendar view)

```
┌──────────────────────────────────────────────────────────────┐
│  Top Navigation Bar                                          │
│  [Logo] Calendar | Tasks | Family | Profile    [User Menu]  │
├──────────────────────────────────────────────┬───────────────┤
│                                              │               │
│  Main Content Area                           │  Task Sidebar │
│  (Calendar Grid or All Tasks View)           │  (320px)      │
│                                              │               │
│  Maximum space for content                   │  Daily tasks  │
│                                              │  for selected │
│                                              │  date         │
│                                              │               │
└──────────────────────────────────────────────┴───────────────┘
```

**Top Navigation Bar**:
- Height: 64px
- Left: Logo/Brand (click → /dashboard)
- Center: Navigation Menu (shadcn/ui Navigation Menu component)
  - Calendar
  - Tasks
  - Family
  - Profile
- Right: User avatar + dropdown menu (logout, settings)

**Navigation Items**:
1. **Calendar** (default active after login)
   - Route: /dashboard
   - Shows: Calendar grid + task sidebar
2. **Tasks**
   - Route: /dashboard/tasks
   - Shows: All Tasks View (full width, no sidebar)
3. **Family**
   - Route: /family
   - Shows: Family Hub View (full width)
4. **Profile**
   - Route: /profile
   - Shows: Profile Settings (full width)

**Main Content Area**:
- Full width when viewing Tasks/Family/Profile
- Left-aligned with task sidebar (320px right) when viewing Calendar

**Task Sidebar** (Calendar view only):
- Width: 320px (fixed)
- Position: Right side
- Sticky: Scrolls independently from calendar
- Shows: Tasks for selected date (default: today)
- Collapsible: User can hide/show via toggle button

**Active State**: Underline, bold text, accent color

**Hover State**: Light background, smooth transition

---

### 4.2. Tablet Layout (768px - 1023px)

**Structure**: Top Navigation Bar + Main Content Area + Collapsible Task Drawer

**Top Navigation Bar**: Same as desktop (may show abbreviated labels)

**Task Sidebar Behavior** (Calendar view):
- Default: Hidden (collapsed)
- Toggle: Hamburger icon in calendar header opens task drawer from right
- Drawer slides over content (overlay)
- Backdrop dims main content
- Click outside or X button closes drawer

**Main Content**: Full width when sidebar collapsed

---

### 4.3. Mobile Layout (≤767px)

**Structure**: Top App Bar + Main Content + Bottom Navigation (NO sidebars)

```
┌─────────────────────────┐
│  Top App Bar            │ ← Title, filter/sort buttons
│ ─────────────────────── │
│                         │
│                         │
│  Main Content           │ ← Full-screen view
│  (Full width)           │    Calendar OR Tasks
│                         │    (separate views)
│                         │
│ ─────────────────────── │
│  Bottom Navigation      │ ← Calendar | Tasks | + | Family | Profile
└─────────────────────────┘
```

**Top App Bar**:
- Height: 56px
- Left: Back button (if in modal) or App logo
- Center: View title (e.g., "Calendar", "All Tasks", "Family")
- Right: Context-specific actions (filter, sort icons)

**Main Content**:
- Full-screen, no sidebars
- Calendar view: Shows agenda/day view (not monthly grid)
- Tasks view: Scrollable task list (separate from calendar)
- No task sidebar on calendar view

**Bottom Navigation** (fixed position):
- Height: 64px (thumb-friendly zone)
- Items (5):
  1. **Calendar** (icon only) → /dashboard
     - Shows: Calendar agenda view
  2. **Tasks** (icon only) → /dashboard/tasks
     - Shows: All Tasks View
  3. **Add** (FAB, elevated) → Opens bottom sheet
     - Options: "Add Event" / "Add Task"
  4. **Family** (icon only) → /family
     - Shows: Family Hub
  5. **Profile** (icon only) → /profile
     - Shows: Profile Settings

**Active State**: Icon filled, accent color, small label appears above icon

**FAB Behavior** (shadcn/ui Sheet):
- Center item, elevated (raised)
- Tap: Opens bottom sheet with options: "Add Event" / "Add Task"
- Quick action: Long-press opens last used modal (Event or Task)

**Navigation Principle**:
- Bottom navigation provides fast switching between main views
- Each view is full-screen (maximizes content space)
- Tasks and calendar are separate views (not sidebar on mobile)

---

### 4.4. Modal and Overlay Navigation

**Modals** (Event/Task Creation and Edit):
- Desktop: Centered overlay, 600px width, backdrop dimmed
- Mobile: Full-screen slide-up, 100% width/height
- Close: X button (top-right) or Escape key or backdrop click
- Nested modals: Supported (e.g., Edit Task from Add Suggestion)

**Slide-Overs** (Family Hub, Profile on mobile):
- Mobile only: Slide from right, 90% width
- Desktop: Not used (full view instead)

**Toast Notifications**:
- Position: Top-center on desktop, bottom-center on mobile (above bottom nav)
- Duration: 3 seconds auto-dismiss
- Types: Success (green), Error (red), Info (blue)
- Actions: Optional action button (e.g., "Undo", "Retry")

---

### 4.5. Navigation Transitions

**Route Changes**:
- Instant (no page reload, SPA)
- Smooth content fade-in (200ms)
- Active nav item updates immediately

**Modal Transitions**:
- Open: Fade-in backdrop (150ms) + slide-up modal (200ms, ease-out)
- Close: Slide-down modal (150ms) + fade-out backdrop (150ms)

**Optimistic UI**:
- Immediate visual update (0ms)
- Loading spinner if server response > 500ms
- Rollback animation if error (shake + color flash)

---

## 5. Key Components

### 5.1. Event Card

**Purpose**: Display event on calendar grid or in list view

**Variants**:
- **Calendar Inline**: Compact, single line, time + title
- **List View**: Full details, multiple lines, click to expand

**Structure**:
- Time badge (e.g., "10:00 AM")
- Title (truncated if long)
- Visibility indicator:
  - Private: Lock icon (outline) + light background
  - Shared: No icon + solid background color
- Participant avatars (max 3 shown, +N for overflow)

**States**:
- Default: Normal colors
- Hover: Light highlight, pointer cursor
- Selected: Border accent color
- Past event: Reduced opacity (60%)

**Accessibility**:
- Button or link role (keyboard accessible)
- ARIA label: "[Time] [Title], [Visibility], [Participants]"

**Responsive**:
- Desktop: Hover shows tooltip with full details
- Mobile: Tap opens Event Edit Modal

---

### 5.2. Task Item

**Purpose**: Display task in Task Feed or on calendar

**Structure**:
- Checkbox (completion toggle)
- Title
- Due date badge (if applicable):
  - Overdue: Red background, "2 days ago"
  - Today: Orange background, "Today"
  - Future: Gray background, "in 3 days"
- Assignee name or avatar (small)
- Visibility indicator (lock icon if private)
- Source event link (if created from suggestion):
  - Icon: Link symbol
  - Tooltip: "From [Event Title]"
- Actions menu (three-dot icon, on hover/long-press):
  - Edit
  - Delete

**States**:
- Pending: Normal colors, empty checkbox
- Completed: Grayed out (opacity 60%), strikethrough, checked checkbox
- Hover: Light highlight, actions menu visible

**Accessibility**:
- Checkbox with label (task title)
- Actions menu keyboard navigable

**Responsive**:
- Desktop: Actions on hover
- Mobile: Swipe-left reveals actions (future enhancement)

---

### 5.3. AI Suggestion Item

**Purpose**: Display AI-generated task suggestion in Event Creation Modal with checkbox for bulk selection

**Structure**:
- Checkbox (left): For multi-selection (shadcn/ui Checkbox)
- Icon: Emoji or icon based on suggestion type
  - 🎂 Birthday
  - 🏥 Health
  - 🍿 Outing
  - ✈️ Travel
- Detected context label: "Detected: [Context]"
- Suggestion title: Bold, clear
- Due date hint: "(7 days before)" in lighter text
- Description (optional): Brief explanation of suggested task

**States**:
- Unchecked: Default state, light background
- Checked: Accent color background, checkmark visible
- Hover: Light highlight, pointer cursor
- Disabled: Grayed out (if conditions not met, e.g., outing without admins)

**Interaction Flow**:
1. User sees suggestion appear below title field
2. User clicks checkbox to select suggestion(s)
3. Multiple suggestions can be selected simultaneously
4. Submit button label updates: "Create Event & X Tasks"
5. On submit, checked suggestion_ids sent in accept_suggestions array
6. Suggestions remain visible (don't disappear when checked)

**Accessibility**:
- Checkbox with associated label (suggestion title)
- ARIA label includes full suggestion details
- Keyboard: Space toggles checkbox, Tab navigates
- Screen reader announces selection state changes

**Responsive**:
- Desktop: Horizontal layout (checkbox left, icon, text center/left-aligned)
- Mobile: Same layout, full width, larger touch target (48px min)

**shadcn/ui Components Used**:
- Checkbox
- Label
- Card (for suggestion container)

---

### 5.4. Filter Toggle Bar

**Purpose**: Allow users to filter calendar/task views

**Structure**:
- Button group (segmented control style)
- Options:
  - **Everything** (default): Show all accessible content
  - **My**: Show only user's private content + shared content
  - **Family**: Show only shared content
- Active state: Filled background, white text
- Inactive state: Outline, default text color

**States**:
- Default: "Everything" selected
- Hover: Light background on inactive buttons
- Active: Accent color background

**Accessibility**:
- Role: radiogroup
- Each button: role="radio"
- Keyboard: Arrow keys navigate, Space selects

**Responsive**:
- Desktop: Inline in header, full labels
- Mobile: Compact, may use icons + tooltips if space constrained

---

### 5.5. Family Member Pill

**Purpose**: Display family member in participant selection or assignee dropdown

**Structure**:
- Avatar (initials, colored background based on user ID hash)
- Display name
- Role badge (Admin/Member, small, only in member lists)
- Checkbox or radio (in selection contexts)

**States**:
- Unselected: Gray border
- Selected: Accent color border, checkmark
- Hover: Light highlight

**Accessibility**:
- Checkbox/radio with label
- Avatar is decorative (aria-hidden)

**Responsive**:
- Desktop: Inline, multiple per row
- Mobile: Stacked list, full width

---

### 5.6. Invitation Code Display

**Purpose**: Show invitation code in Family Hub with copy action

**Structure**:
- Code (monospace font, large): "ABC12XYZ"
- Metadata:
  - Created by: "[Admin Name]"
  - Expires: "in 6 days" or "Expired 2 days ago"
  - Status: "Active" (green) / "Used" (gray) / "Expired" (red)
- Copy button: Icon + "Copy" label

**States**:
- Active: Normal colors, copy button enabled
- Expired: Grayed out, copy button disabled
- Used: Grayed out, shows "Used by [Member Name]"
- Copied: Button changes to "Copied!" with checkmark (2 seconds)

**Accessibility**:
- Code is selectable text
- Copy button announces copy success to screen reader

**Responsive**:
- Desktop: Table row format
- Mobile: Card format, stacked

---

### 5.7. Empty State Card

**Purpose**: Guide users when views are empty, demonstrate AI value

**Structure**:
- Illustration or icon (large, centered)
- Heading: "Your [calendar/tasks] is empty"
- Subheading: Explanation text
- Primary CTA: Button (e.g., "Add Your First Event")
- Secondary content: Quick Start Cards (for calendar empty state)

**Quick Start Card** (sub-component):
- Example event title: "Dentist appointment next Friday"
- Preview of AI suggestion: "→ Prepare medical documents"
- "Try it" button

**States**:
- Default: Visible when no data
- Hidden: When at least one item exists

**Accessibility**:
- Proper heading hierarchy (H2 for main heading)
- Buttons with clear labels

**Responsive**:
- Desktop: Quick Start Cards in horizontal row (3 columns)
- Mobile: Quick Start Cards stacked vertically

---

### 5.8. Toast Notification

**Purpose**: Provide feedback for user actions and system events

**Structure**:
- Icon (success checkmark, error X, info i)
- Message text (single line, max 60 characters)
- Optional action button (e.g., "Undo", "Retry")
- Close button (X icon, optional)

**Types**:
- **Success**: Green background, white text
  - Examples: "Event created", "Task completed", "Code copied"
- **Error**: Red background, white text
  - Examples: "Failed to save", "Network error"
- **Info**: Blue background, white text
  - Examples: "Changes saved", "Invitation sent"

**Behavior**:
- Auto-dismiss: 3 seconds (pause on hover)
- Manual dismiss: Click X button
- Queue: Multiple toasts stack vertically
- Max simultaneous: 3 (oldest auto-dismissed)

**Accessibility**:
- Role: status or alert (based on urgency)
- Screen reader announces message
- Focus not moved (non-intrusive)

**Responsive**:
- Desktop: Top-center, 400px width
- Mobile: Bottom-center (above bottom nav), 90% width

---

### 5.9. Loading Skeleton

**Purpose**: Indicate loading state for async content

**Variants**:
- **Calendar Skeleton**: Gray boxes for event slots
- **Task List Skeleton**: Gray rows with animated shimmer
- **Profile Skeleton**: Gray avatar circle + text lines

**Behavior**:
- Animated shimmer effect (left-to-right gradient)
- Duration: Until data loads or 10 seconds max (then show error)

**Accessibility**:
- ARIA live region announces "Loading [content]"
- Does not trap focus

**Responsive**:
- Matches layout of actual content

---

### 5.10. Confirmation Dialog

**Purpose**: Confirm destructive actions (delete, logout)

**Structure**:
- Heading: "Confirm [Action]"
- Message: Explanation of consequences
- Buttons:
  - Primary: "Cancel" (safe action)
  - Destructive: "Delete" or "Logout" (red background)

**Behavior**:
- Modal overlay (dims background)
- Focus on Cancel button by default (safe default)
- Escape key cancels

**Accessibility**:
- Role: alertdialog
- Focus trap within dialog
- Screen reader announces dialog content

**Responsive**:
- Desktop: Centered, 400px width
- Mobile: Bottom sheet, full width

**shadcn/ui Components Used**:
- AlertDialog

---

### 5.11. Daily Tasks Sidebar

**Purpose**: Display tasks for selected calendar date (default: today) on desktop

**Visibility**:
- **Desktop (≥1024px)**: Visible on Calendar View (right side, 320px width)
- **Tablet (768px-1023px)**: Collapsible drawer (opened by icon)
- **Mobile (≤767px)**: Not shown (tasks accessed via bottom nav)

**Structure**:
- Header bar with title and action:
  - Left: "Tasks for [Date]" (e.g., "Tasks for Today", "Tasks for Jan 15")
  - Right: '+' icon button (shadcn/ui Button variant="ghost" size="icon")
- Date selector: Click title to change date (opens calendar picker)
- Task list (scrollable):
  - Filtered by selected date (due_date matches selected date)
  - Task Item components (5.2)
  - Group: Pending tasks first, completed tasks below
- '+' button: Opens Task Creation Modal with due_date pre-filled to selected date
- Empty state: "No tasks for this day" with illustration

**Interaction**:
- User clicks calendar date → Sidebar updates to show tasks for that date
- User clicks task checkbox → Task marked complete (optimistic UI)
- User clicks task title → Opens Task Edit Modal
- User clicks '+' icon (top-right) → Opens Task Creation Modal with due_date pre-filled to selected date
- User clicks sidebar title → Opens date picker to change displayed date

**States**:
- Loading: Skeleton loader (gray rows)
- Empty: Empty state with "Add Task" CTA
- Populated: Scrollable task list

**Accessibility**:
- Sidebar landmark: role="complementary"
- Heading: "Tasks for [Date]" (H2 level)
- List semantic markup (ul/li)
- Keyboard: Tab to navigate tasks, Space to toggle checkboxes

**Responsive Behavior**:
- Desktop: Fixed position, sticky scroll
- Tablet: Drawer slides from right (shadcn/ui Sheet)
- Mobile: Not displayed (separate All Tasks View)

**shadcn/ui Components Used**:
- Sheet (tablet drawer)
- ScrollArea (task list)
- Button (Add Task)
- Skeleton (loading state)

---

## 6. Requirement to UI Element Mapping

| Requirement | UI Element | View | Notes |
|-------------|------------|------|-------|
| **Authentication & Family Setup** |
| Email/password registration | Register form | Register View (2.2) | Inline validation, password strength indicator |
| Email/password login | Login form | Login View (2.3) | Auto-focus, show/hide password toggle |
| Family Hub creation | Create Family form | Create Family View (2.4) | Pre-filled placeholder, admin role explanation |
| Invitation code generation | Generate button + code display | Family Hub View (2.12) | Admin only, copy-to-clipboard |
| Invitation code redemption | Join Family form | Join Family View (2.5) | 8-char validation, clear error messages |
| Admin role | Role badge + admin-only features | Family Hub View (2.12) | Visual distinction, feature gating |
| Member role | Role badge | Family Hub View (2.12) | Limited permissions |
| **Binary Visibility Model** |
| Private events (Only Me) | Lock icon + outline style | Event Card (5.1) | Visible only to creator (RLS enforced) |
| Shared events (Family) | Solid background, no icon | Event Card (5.1) | Visible to all family members |
| Private tasks | Lock icon | Task Item (5.2) | Consistent with events |
| Shared tasks | No visibility indicator | Task Item (5.2) | Default state |
| Visibility toggle | Toggle switch | Event/Task Creation Modal (2.8, 2.10) | Clear labels, changes participant availability |
| **Manual Calendar** |
| Monthly view | Calendar grid (Schedule-X) | Calendar View (2.6) | Default view on desktop |
| Daily view | Agenda list | Calendar View (2.6) | Default view on mobile |
| Event creation form | Event Creation Modal | Event Creation Modal (2.8) | Title, date/time, visibility, participants |
| Event title input | Text input with AI analysis | Event Creation Modal (2.8) | Debounced, space-triggered analysis |
| Event date/time pickers | Date and time inputs | Event Creation Modal (2.8) | Validation: end > start |
| Participant checkboxes | Multi-select with member pills | Event Creation Modal (2.8) | Disabled if Private selected |
| **AI Assistant** |
| Real-time analysis | POST /events/analyze | Event Creation Modal (2.8) | Triggered on space, 500ms debounce |
| Suggestion display | AI Suggestion Item list | Event Creation Modal (2.8) | Below title field, slide-in animation |
| Birthday rule (7d before) | Suggestion with 🎂 icon | AI Suggestion Item (5.3) | Keyword: birthday, bday |
| Health rule (1d before) | Suggestion with 🏥 icon | AI Suggestion Item (5.3) | Keyword: doctor, dentist, clinic |
| Outing rule (3d before) | Suggestion with 🍿 icon | AI Suggestion Item (5.3) | Keyword: cinema, date, dinner + admins only |
| Travel rule (2d before) | Suggestion with ✈️ icon | AI Suggestion Item (5.3) | Keyword: flight, trip, vacation |
| Bulk suggestion acceptance | Checkboxes + accept_suggestions array | AI Suggestion Item (5.3), Event Creation Modal (2.8) | Multi-select checkboxes, bulk creation on submit via POST /events |
| Multi-select suggestions | Multiple checkboxes | AI Suggestion Item (5.3) | User can select multiple suggestions for atomic creation |
| Suggestion selection feedback | Dynamic submit button label | Event Creation Modal (2.8) | Label updates: "Create Event" → "Create Event & X Tasks" |
| **Task Module** |
| Task feed (single view) | Task list | Task Feed View (2.7) | All tasks: manual + AI-generated |
| Manual task creation | Task Creation Modal | Task Creation Modal (2.10) | Not linked to event |
| AI-generated task creation | POST /tasks/from-suggestion | Event Creation Modal (2.8) | Linked to event, tracks conversion |
| Task completion toggle | Checkbox | Task Item (5.2) | Optimistic UI, PATCH /tasks/:taskId |
| Completed task visual | Strikethrough + grayed out | Task Item (5.2) | Remains visible, not hidden |
| Task deletion | Delete button in actions menu | Task Edit Modal (2.11) | Soft delete (archived_at) |
| Due date display | Date badge | Task Item (5.2) | Color-coded: overdue (red), today (orange), future (gray) |
| Assignee display | Name or avatar | Task Item (5.2) | Defaults to creator for AI suggestions |
| Task filters | Filter Toggle Bar | Task Feed View (2.7) | Completed/Pending, Private/Shared, Assigned to Me |
| Task sorting | Sort dropdown | Task Feed View (2.7) | Due Date (asc/desc), Created Date |
| **User Stories** |
| US-001: Create family account | Register + Create Family flow | Views 2.2, 2.4 | Guided onboarding |
| US-002: Invite family members | Invitation management | Family Hub View (2.12) | Admin generates code, member redeems |
| US-003: Event + AI suggestion | Event Creation Modal | Event Creation Modal (2.8) | Real-time suggestions during typing |
| US-004: Private event for surprise | Visibility toggle (Private) | Event Creation Modal (2.8) | Lock icon, outline style, hidden from family |
| US-005: See all pending tasks | Task Feed with filters | Task Feed View (2.7) | Default: Show all pending |
| US-006: Check off task | Task checkbox | Task Item (5.2) | Optimistic UI, completion tracking |

---

## 7. User Pain Points and UI Solutions

| Pain Point | UI Solution | View | Implementation |
|------------|-------------|------|----------------|
| **Forgetting event preparations** | Real-time AI suggestions during event creation | Event Creation Modal (2.8) | POST /events/analyze triggers on space, suggestions appear immediately below title |
| **Mental load of tracking tasks** | Unified Task Feed with calendar integration | Task Feed View (2.7) + Calendar View (2.6) | Tasks with due_date appear on calendar grid, all tasks in feed |
| **Privacy concerns (surprise events)** | Clear Private/Shared toggle with visual indicators | Event Creation Modal (2.8), Event Card (5.1) | Lock icon, outline style for private; solid background for shared |
| **Mobile usage on-the-go** | Bottom navigation, thumb-friendly zones, FAB | Mobile Layout (4.3) | Bottom nav at 64px height, FAB for quick actions, swipe gestures (future) |
| **Unclear app value (first use)** | Empty states with Quick Start Cards | Calendar View (2.6), Task Feed View (2.7) | Interactive examples demonstrate AI, "Try it" buttons pre-fill forms |
| **Onboarding complexity** | Guided flows with contextual explanations | Onboarding Views (2.4, 2.5) | Single-field forms, clear role explanations, alternative paths |
| **Lost tasks in noise** | Filters, grouping, color-coded due dates | Task Feed View (2.7) | Group by time (Today, This Week, Later), overdue in red, filters for assignment |
| **Uncertainty about save status** | Toast notifications for all mutations | All views | Success/error toasts with action confirmations, "Last write wins" strategy |
| **Slow perceived performance** | Optimistic UI updates | Task checkbox, Event creation | useOptimistic hook updates UI immediately, syncs with server in background |
| **Admin vs Member confusion** | Role badges, feature gating, clear messaging | Family Hub View (2.12) | Admin-only features hidden (not disabled), role displayed in member list |
| **Concurrent edits** | Last-write-wins with toast confirmations | All edit views | No conflict resolution UI (MVP), toast announces save success |
| **Finding related tasks** | Source event links in tasks | Task Item (5.2) | Link icon, tooltip shows event title, click navigates to event |
| **Expired invitation codes** | Clear error messages, admin notification | Join Family View (2.5) | 410 Gone error with "Contact admin" prompt, admin sees expired codes |

---

## 8. Accessibility Checklist

### 8.1. Keyboard Navigation
- [ ] All interactive elements focusable (Tab order logical)
- [ ] Skip to main content link (first focusable element)
- [ ] Modal focus trap (Tab cycles within modal)
- [ ] Focus returns to trigger on modal close
- [ ] Arrow keys navigate calendar grid
- [ ] Space/Enter activate buttons and checkboxes
- [ ] Escape closes modals and dropdowns

### 8.2. Screen Reader Support
- [ ] Semantic HTML (header, nav, main, aside, footer)
- [ ] ARIA landmarks (role="navigation", role="main", etc.)
- [ ] ARIA labels for icon-only buttons
- [ ] ARIA live regions for dynamic content (toasts, suggestions)
- [ ] ARIA expanded/collapsed for dropdowns
- [ ] Form labels associated with inputs (for attribute)
- [ ] Error messages with role="alert"
- [ ] Calendar grid with proper ARIA roles (grid, row, gridcell)

### 8.3. Visual Accessibility
- [ ] Color contrast ratio ≥4.5:1 for text (WCAG AA)
- [ ] Color contrast ratio ≥3:1 for UI components (WCAG AA)
- [ ] Information not conveyed by color alone (icons + text)
- [ ] Focus indicators visible (2px outline, high contrast)
- [ ] Text resizable up to 200% without loss of functionality
- [ ] Minimum touch target size 44x44px (mobile)

### 8.4. Content Accessibility
- [ ] Heading hierarchy (H1 → H2 → H3, no skipping)
- [ ] Alt text for images (decorative images aria-hidden)
- [ ] Link text descriptive ("Learn more about invitations" vs "Click here")
- [ ] Form validation messages clear and specific
- [ ] Error messages provide guidance for correction

---

## 9. Security Considerations in UI

### 9.1. Authentication
- **Token Storage**: Access token in memory (React state), refresh token in httpOnly cookie
- **Session Expiry**: Silent refresh on 401 errors, logout on refresh failure
- **Logout**: Clear all local state, redirect to login, revoke session on server

### 9.2. Authorization
- **RLS Enforcement**: All data filtering done server-side, UI reflects permissions
- **Admin Features**: Hidden (not just disabled) for non-admins, verified on backend
- **Private Content**: Lock icon indicates privacy, API enforces visibility

### 9.3. Input Validation
- **Client-Side**: Immediate feedback (UX), basic format checks
- **Server-Side**: Authoritative validation (security), sanitization
- **Never Trust Client**: All permissions, visibility, and data integrity verified on backend

### 9.4. XSS Prevention
- **React**: Automatic escaping of user input
- **Dangerous HTML**: Never use dangerouslySetInnerHTML with user content
- **URLs**: Validate and sanitize any user-provided URLs

### 9.5. CSRF Protection
- **Supabase**: Built-in CSRF protection via JWT tokens
- **SameSite Cookies**: Refresh token cookie with SameSite=Lax

### 9.6. Rate Limiting
- **UI Feedback**: Show clear error message on 429 Too Many Requests
- **Retry Logic**: Exponential backoff with jitter for failed requests
- **Invitation Codes**: 5 attempts/hour limit, clear error message

---

## 10. Performance Considerations

### 10.1. Initial Load
- **Code Splitting**: Route-based lazy loading
- **Critical CSS**: Inline above-the-fold styles
- **Font Loading**: Subset fonts, font-display: swap
- **Images**: Optimized formats (WebP), responsive sizes

### 10.2. Runtime Performance
- **Optimistic UI**: Immediate updates with React 19 useOptimistic
- **Debouncing**: AI analysis debounced 500ms after space character
- **Virtualization**: Task list virtualized if > 100 items (react-window)
- **Memoization**: React.memo for expensive components (Event Card, Task Item)

### 10.3. Data Fetching
- **Pagination**: Tasks and events paginated (limit: 100)
- **Caching**: SWR or React Query for client-side cache
- **Stale-While-Revalidate**: Show cached data, fetch fresh in background
- **Prefetching**: Prefetch likely next views (e.g., Task Feed when on Calendar)

### 10.4. Mobile Optimization
- **Touch Targets**: Minimum 44x44px
- **Tap Delay**: Remove 300ms delay (touch-action: manipulation)
- **Scroll Performance**: Use transform for animations (GPU-accelerated)
- **Network Awareness**: Reduce polling frequency on slow connections

---

## 11. Future Enhancements (Post-MVP)

### 11.1. Advanced Filtering
- **Multi-Select Filters**: Filter by multiple participants, multiple tags
- **Saved Filter Presets**: User-defined filter sets
- **Smart Filters**: "Overdue tasks assigned to me"

### 11.2. Calendar Enhancements
- **Drag-and-Drop**: Reschedule events by dragging on calendar
- **Recurring Events**: Weekly, monthly repeats
- **Calendar Import**: iCal, Google Calendar, Apple Calendar sync
- **Multiple Calendars**: Work, Personal, Kids (color-coded)

### 11.3. Collaboration Features
- **Real-Time Updates**: WebSocket for live collaboration
- **Commenting**: Comments on events and tasks
- **Activity Feed**: Timeline of family activity
- **Notifications**: Email and push notifications for upcoming events/tasks

### 11.4. AI Enhancements
- **LLM Integration**: Natural language event parsing
- **Smart Scheduling**: Suggest optimal times based on family availability
- **Conflict Detection**: Warn about overlapping events
- **Custom Rules**: User-defined AI suggestion rules

### 11.5. Mobile App
- **Native Apps**: iOS and Android (React Native)
- **Offline Support**: Service workers for web app
- **Home Screen Widgets**: Quick view of today's tasks
- **Push Notifications**: Native notifications for reminders

---

## 12. Component Library and Styling Strategy

### 12.1. shadcn/ui Components

HomeHQ leverages **shadcn/ui** as the primary component library for consistent, accessible UI patterns. All components are built on Radix UI primitives with Tailwind CSS styling.

**Core shadcn/ui Components Used**:

| Component | Usage | Views |
|-----------|-------|-------|
| **Dialog** | Event/Task Creation and Edit Modals | 2.8, 2.9, 2.10, 2.11 |
| **Sheet** | Mobile action sheets, task drawer on tablet | Mobile layouts, Calendar sidebar |
| **Navigation Menu** | Top navigation bar (desktop) | All authenticated views |
| **Button** | Primary, secondary, destructive actions | All views |
| **Input** | Text fields for forms | All forms |
| **Checkbox** | AI suggestion selection, task completion | Event Creation Modal, Task items |
| **Switch** | Visibility toggle (Private/Shared) | Event/Task Creation Modals |
| **Calendar & DatePicker** | Date/time selection | Event/Task Creation Modals |
| **Select** | Assignee dropdown, sort options | Task Creation, All Tasks View |
| **Tabs** | Filter toggles, view switchers | Calendar filters, Task filters |
| **Toast** | Success/error notifications | All mutations |
| **Avatar** | User profile pictures | Family Hub, Profile |
| **Badge** | Role indicators, due date badges | Family Hub, Task items |
| **Card** | Empty states, suggestion containers | Calendar/Task empty states, AI suggestions |
| **Separator** | Visual dividers | All views |
| **Skeleton** | Loading states | Calendar, Task list |

**Benefits**:
- Accessibility: WCAG AA compliance out-of-box (ARIA, keyboard navigation, focus management)
- Consistency: Unified design language across all views
- Customization: Tailwind-based, easy to theme
- Maintenance: Copy-paste components, no npm dependencies for UI logic

**Component Customization**:
- All shadcn/ui components stored in `src/components/ui/`
- Customized via Tailwind CSS utility classes
- Brand colors and design tokens defined in `tailwind.config.ts`

---

### 12.2. Tailwind CSS Utility Variants

All responsive design is implemented using **Tailwind CSS utility variants** for breakpoint-specific styling.

**Breakpoint Strategy**:

```css
/* Default: Mobile-first (≤767px) */
.class-name

/* Tablet (≥768px) */
md:class-name

/* Desktop (≥1024px) */
lg:class-name

/* Large Desktop (≥1440px) */
xl:class-name
```

**Key Responsive Patterns**:

| Pattern | Implementation | Example |
|---------|----------------|---------|
| **Navigation** | Bottom nav on mobile, top nav on desktop | `<nav className="fixed bottom-0 lg:top-0">` |
| **Task Sidebar** | Hidden on mobile, visible on desktop | `<aside className="hidden lg:block lg:w-80">` |
| **Calendar Grid** | Agenda view on mobile, monthly on desktop | `<div className="flex flex-col lg:grid lg:grid-cols-7">` |
| **Modals** | Full-screen on mobile, centered on desktop | `<Dialog className="h-full lg:h-auto lg:max-w-2xl">` |
| **Typography** | Smaller text on mobile, larger on desktop | `<h1 className="text-2xl lg:text-4xl">` |
| **Spacing** | Compact on mobile, generous on desktop | `<div className="p-4 lg:p-8">` |
| **Grid Layouts** | Single column on mobile, multi-column on desktop | `<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">` |

**Common Utility Combinations**:

```tsx
// Hide on mobile, show on desktop
className="hidden lg:block"

// Full width on mobile, fixed width on desktop
className="w-full lg:w-80"

// Stack on mobile, horizontal on desktop
className="flex flex-col lg:flex-row"

// Fixed bottom on mobile, fixed top on desktop
className="fixed bottom-0 lg:top-0"

// Padding responsive
className="p-4 md:p-6 lg:p-8"

// Text size responsive
className="text-sm md:text-base lg:text-lg"
```

**State Variants**:

```tsx
// Hover states (desktop only)
className="hover:bg-accent lg:hover:shadow-lg"

// Focus states (all devices)
className="focus:ring-2 focus:ring-offset-2"

// Active states
className="active:scale-95"

// Disabled states
className="disabled:opacity-50 disabled:cursor-not-allowed"

// Dark mode (future enhancement)
className="bg-white dark:bg-gray-900"
```

**Performance Considerations**:
- Tailwind JIT (Just-In-Time) compiler generates only used classes
- Production builds: CSS purged to ~10-20KB
- No runtime CSS-in-JS overhead
- Critical CSS inlined for fast First Contentful Paint

---

## Appendix: Component Hierarchy

```
App
├── AuthProvider (Supabase session)
├── Router
│   ├── PublicRoutes (unauthenticated)
│   │   ├── LandingPage (/)
│   │   ├── LoginView (/auth/login)
│   │   └── RegisterView (/auth/register)
│   │
│   ├── OnboardingRoutes (authenticated, no family)
│   │   ├── CreateFamilyView (/onboarding/create-family)
│   │   └── JoinFamilyView (/onboarding/join-family)
│   │
│   └── AuthenticatedRoutes (authenticated, family assigned)
│       ├── DashboardLayout
│       │   ├── TopNavigationBar (desktop, shadcn/ui NavigationMenu)
│       │   │   ├── Logo
│       │   │   ├── NavItems (Calendar, Tasks, Family, Profile)
│       │   │   └── UserMenu (avatar, dropdown)
│       │   │
│       │   ├── BottomNavigation (mobile only)
│       │   │   ├── CalendarIcon → /dashboard
│       │   │   ├── TasksIcon → /dashboard/tasks
│       │   │   ├── AddFAB → ActionSheet
│       │   │   ├── FamilyIcon → /family
│       │   │   └── ProfileIcon → /profile
│       │   │
│       │   ├── MainContent
│       │   │   ├── CalendarView (/dashboard, default after login)
│       │   │   │   ├── CalendarHeader (month nav, filters)
│       │   │   │   ├── ContentWrapper
│       │   │   │   │   ├── CalendarGrid (Schedule-X, left/center)
│       │   │   │   │   │   ├── EventCard (multiple)
│       │   │   │   │   │   └── TaskItem (with due_date, multiple)
│       │   │   │   │   └── DailyTasksSidebar (right, desktop only, 320px)
│       │   │   │   │       ├── SidebarHeader
│       │   │   │   │       │   ├── Title ("Tasks for [Date]")
│       │   │   │   │       │   └── AddButton ('+' icon, top-right)
│       │   │   │   │       └── TaskList (filtered by selected date)
│       │   │   │   │           └── TaskItem (multiple)
│       │   │   │   └── EmptyState (if no events)
│       │   │   │       └── QuickStartCard (multiple)
│       │   │   │
│       │   │   ├── AllTasksView (/dashboard/tasks)
│       │   │   │   ├── PageHeader ("All Tasks")
│       │   │   │   ├── FilterBar (shadcn/ui Tabs)
│       │   │   │   ├── TaskList (scrollable, full width)
│       │   │   │   │   ├── TaskGroup (Today)
│       │   │   │   │   │   └── TaskItem (multiple)
│       │   │   │   │   ├── TaskGroup (This Week)
│       │   │   │   │   ├── TaskGroup (Later)
│       │   │   │   │   └── TaskGroup (No Due Date)
│       │   │   │   └── EmptyState (if no tasks)
│       │   │   │
│       │   │   ├── FamilyHubView (/family)
│       │   │   │   ├── FamilyHeaderCard (name, edit button)
│       │   │   │   ├── MembersSection
│       │   │   │   │   └── MemberPill (multiple)
│       │   │   │   └── InvitationsSection (admin only)
│       │   │   │       ├── GenerateCodeButton
│       │   │   │       └── InvitationCodeDisplay (multiple)
│       │   │   │
│       │   │   └── ProfileSettingsView (/profile)
│       │   │       ├── ProfileForm (display name)
│       │   │       ├── AccountInfo (email, role)
│       │   │       └── LogoutButton
│       │   │
│       │   └── Modals (overlays, shadcn/ui Dialog/Sheet)
│       │       ├── EventCreationModal
│       │       │   ├── EventForm
│       │       │   │   ├── TitleInput (with AI analysis)
│       │       │   │   ├── DateTimePickers (shadcn/ui Calendar)
│       │       │   │   ├── VisibilityToggle (shadcn/ui Switch)
│       │       │   │   └── ParticipantSelector (shadcn/ui Multi-Select)
│       │       │   ├── AISuggestionsPanel
│       │       │   │   └── AISuggestionItem (multiple)
│       │       │   │       ├── Checkbox (shadcn/ui)
│       │       │   │       ├── Icon (emoji)
│       │       │   │       └── SuggestionText
│       │       │   └── SubmitButton (dynamic label)
│       │       │
│       │       ├── EventEditModal (similar to creation, no suggestions)
│       │       ├── TaskCreationModal
│       │       ├── TaskEditModal
│       │       └── ConfirmationDialog (shadcn/ui AlertDialog)
│       │
│       └── ToastContainer (shadcn/ui Toast, fixed position)
│           └── Toast (multiple, stacked)
│
└── LoadingSpinner (global loading state)
```

---

**Document Version**: 2.0.0  
**Last Updated**: 2026-01-04  
**Status**: Ready for Implementation  
**Related Documents**: PRD (prd.md), API Plan (api-plan.md)

**Changelog**:
- v2.0.0 (2026-01-04): Major layout redesign
  - Changed from sidebar navigation to top navigation bar (desktop)
  - Added Daily Tasks Sidebar on Calendar View (right side, 320px)
  - Updated Event Creation Modal to use checkboxes for bulk suggestion acceptance
  - Added accept_suggestions array for atomic event + tasks creation
  - Integrated shadcn/ui components throughout
  - Added Tailwind CSS utility variants documentation
  - Post-login redirect directly to Calendar View
  - Mobile: Bottom navigation only, no sidebars
- v1.0.0 (2026-01-02): Initial UI plan

