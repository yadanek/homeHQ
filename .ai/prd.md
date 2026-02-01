# Product Requirements Document (PRD) - HomeHQ

**Document Version:** 2.0  
**Last Updated:** February 1, 2026  
**Current Status:** MVP Completed - Planning Future Development

---

## 1. Product Overview (v1.0 - MVP Completed ✅)

HomeHQ is a web-based "command center" for families. The v1.0 MVP focuses on **Logistics Automation**: reducing a parent's mental load by automatically suggesting tasks based on calendar events.

The core hypothesis is that users will find value in an application that "thinks ahead" by suggesting necessary preparations for family events, even without external integrations or complex list management.

**Current Implementation Status:** The MVP has been successfully implemented with all core features operational. Authentication, family management, event creation with AI-powered task suggestions, and task management are fully functional.

## 2. The Core Problem

Parents suffer from **Mental Load**. Entering "Doctor's Appointment" is easy, but remembering to "Prepare medical records" 24 hours before is the hidden cognitive burden. HomeHQ v1.0 automates the transition from _knowing_ about an event to _preparing_ for it.

## 3. MVP Implementation Status ✅

### 3.1. Authentication & Family Setup ✅ **COMPLETED**

- ✅ **Registration/Login:** Email and password authentication fully implemented
   - Login page with email/password validation
   - Registration page with password confirmation
   - Password recovery functionality
   - Logout functionality
   
- ✅ **The Family Space:** First user to register creates a "Family Hub" and becomes Admin
   - Atomic family creation with automatic admin assignment
   - Database function `create_family_and_assign_admin()` operational
   
- ✅ **Simplified Invitations:** Admin generates invitation codes via Family Settings
   - 8-character alphanumeric codes
   - Configurable expiration (default 7 days)
   - Code redemption flow for new members
   
- ✅ **Basic Roles:**
   - **Admin:** Full access, can generate invitation codes, manage family
   - **Member:** Access to shared and personal content
   
- ✅ **Family Members (without accounts):** Support for non-user family members
   - Children, pets, or other dependents can be added
   - Can be selected as event participants
   - Visual distinction (👤 adult, 👶 child icons)

### 3.2. Binary Visibility Model ✅ **COMPLETED**

Implementation complete for two visibility levels:

1. ✅ **Private (Only Me):** Visible only to the creator via RLS policies
   
2. ✅ **Shared (Family):** Visible to everyone in the family hub via RLS policies

### 3.3. Manual Calendar ✅ **COMPLETED**

- ✅ **Web View:** Monthly calendar view with event display
   - Color-coded events (blue = private, green = shared)
   - Click to view event details
   
- ✅ **Event Creation:** Full implementation with dialog UI
   - Title, Date, Time fields
   - Description (optional)
   - Toggle for "Private" or "Shared"
   - Participant selection (profiles and family members)
   
- ✅ **Event Management:**
   - Create events (POST /events)
   - Update events (PATCH /events/:eventId)
   - Delete events (DELETE /events/:eventId - soft delete)
   - View event details with participants

- ✅ **Participants:** Comprehensive participant management
   - Select registered users (profiles)
   - Select family members without accounts
   - Automatic family validation
   - Private events cannot have multiple participants (enforced)

### 3.4. AI Assistant (Immediate Suggestions) ✅ **COMPLETED**

The AI engine analyzes events during manual creation and provides contextual suggestions.

**✅ Implemented MVP Rules:**

1. ✅ **Birthday:** (Keywords: birthday, bday) → Suggests: "Buy a gift" (7 days before)
   
2. ✅ **Health:** (Keywords: doctor, dentist, clinic) → Suggests: "Prepare medical documents" (1 day before)
   
3. ✅ **Outing:** (Keywords: cinema, date, dinner / Participants: Admins only) → Suggests: "Book a babysitter" (3 days before)
   
4. ✅ **Travel:** (Keywords: flight, trip, vacation) → Suggests: "Pack bags" (2 days before)

**✅ Interface Implementation:**

- Live suggestions appear as user types event title
- Checkbox selection for accepting suggestions
- Automatic task creation from accepted suggestions
- Edge Function deployed for AI analysis

### 3.5. Task Module ✅ **COMPLETED**

- ✅ **Task Feed:** Single view showing all tasks with comprehensive filtering
   - Filter by completion status
   - Filter by assignee ("me" or specific user)
   - Filter by due date ranges
   - Filter by related event
   - Sort options (due date asc/desc, created date)
   
- ✅ **Task Status:** 
   - Mark tasks as "Completed" (PATCH /tasks/:taskId)
   - Automatic tracking of completion timestamp and user
   - Delete tasks
   
- ✅ **Visibility:** Tasks inherit "Private" or "Shared" status
   - RLS policies enforce visibility rules
   - Private tasks visible only to creator
   
- ✅ **Task Details:** Rich task information
   - Title, due date, description
   - Created by, assigned to, completed by (with names)
   - Related event information
   - Suggestion tracking (created from AI or manual)
   

## 4. MVP Product Boundaries (Implemented Scope)

The MVP successfully delivered on a focused scope while maintaining quality:

**✅ Implemented in MVP:**
- ✅ Manual event entry (web interface)
- ✅ AI-powered task suggestions based on keyword matching
- ✅ Binary visibility model (Private/Shared)
- ✅ Email/password authentication
- ✅ Family creation and invitation system
- ✅ Task management with filtering and completion tracking
- ✅ Event CRUD operations (Create, Read, Update, Delete)
- ✅ Family members without user accounts
- ✅ Comprehensive participant management

**✅ Security & Performance Delivered:**
- ✅ Row Level Security (RLS) policies enforced at database level
- ✅ JWT-based authentication via Supabase Auth
- ✅ Optimized database queries with proper indexes
- ✅ Type-safe implementation with TypeScript and Zod validation
   
**📝 Deferred to Future Development:**
- ❌ iCal/Apple/Google Import (manual entry only)
- ❌ Standalone task lists or custom categories
- ❌ "Specific People" sharing (only Private or Family-wide)
- ❌ Push notifications or email alerts
- ❌ Mobile native app (browser-only for now)
- ❌ Advanced AI (using contextual keyword matching)
- ❌ External integrations
   

## 5. User Stories - Implementation Status

### Overview ✅ **COMPLETED**
- **US-000: Main Dashboard**
    * ✅ **IMPLEMENTED:** Dashboard with month view calendar and task sidebar
    * ✅ Personal events highlighted in blue
    * ✅ Family events highlighted in green
    * ✅ Task list in right sidebar
    * ✅ Click on calendar day filters tasks for that date
    * ✅ Event details modal on event click

### Setup ✅ **COMPLETED**

- **US-001:** ✅ **IMPLEMENTED:** As a user, I want to create a family account so my partner and I can share a digital space.
   - CreateFamilyPage with form validation
   - Atomic database function for family creation
   - Automatic admin role assignment
   
- **US-002:** ✅ **IMPLEMENTED:** As an Admin, I want to invite my family members via a code so they can see shared events.
   - Family Settings dialog with invitation management
   - Generate 8-character codes with configurable expiration
   - Code redemption flow during registration
   - View active/expired invitation codes

### Calendar & AI ✅ **COMPLETED**

- **US-003:** ✅ **IMPLEMENTED:** As a user, I want to manually add "Dentist appointment" and have the system suggest "Prepare documents" so I don't forget them on the day of the visit.
   - CreateEventDialog with real-time AI suggestions
   - Edge Function for keyword analysis
   - Checkbox selection for accepting suggestions
   - Automatic task creation from accepted suggestions
   
- **US-004:** ✅ **IMPLEMENTED:** As a parent, I want to mark a "Surprise Anniversary Dinner" as **Private** so my kids don't see it on the calendar.
   - Private/Shared toggle in event creation
   - RLS policies enforce visibility
   - Private events displayed only to creator
   - Database trigger prevents multiple participants on private events

### Tasks ✅ **COMPLETED**

- **US-005:** ✅ **IMPLEMENTED:** As a user, I want to see a list of all pending tasks (both AI-suggested and manual) so I can stay organized.
   - TaskList component in dashboard sidebar
   - Comprehensive filtering (completion status, assignee, due date, event)
   - Sort options (due date, creation date)
   - Visual distinction between AI-suggested and manual tasks
   
- **US-006:** ✅ **IMPLEMENTED:** As a user, I want to check off a task as "Done" so my partner knows it has been handled.
   - Checkbox toggle for task completion
   - PATCH /tasks/:taskId endpoint
   - Automatic timestamp and user tracking on completion
   - Visual feedback (strikethrough, color change)

### Secure Access and Authentication ✅ **COMPLETED**
- **US-007:** ✅ **IMPLEMENTED:**
  
**Title:** Secure Access

**Implementation Status:** All acceptance criteria completed

**Completed Features:**
- ✅ Login and registration on dedicated pages (LoginPage, RegisterPage)
- ✅ Email and password required for login
- ✅ Email, password, and password confirmation required for registration
- ✅ LandingPage for non-logged-in users with app description
- ✅ Authentication required for creating events/tasks and reading calendar data
- ✅ Login button on LandingPage (corrected from PRD error - not on Dashboard)
- ✅ Logout button in UserMenu (top-right corner of Dashboard)
- ✅ No external login services (Google, GitHub) - email/password only
- ✅ Password recovery flow implemented (ResetPasswordPage, UpdatePasswordPage)

**Technical Implementation:**
- Supabase Auth for authentication backend
- JWT tokens for session management
- useAuth hook for authentication state management
- Protected routing with automatic redirects
- RLS policies enforce data access control
   

## 6. Success Metrics (MVP Baseline Established)

The MVP implementation provides the foundation for measuring these key metrics:

1. **Suggestion Conversion:** ✅ Tracking implemented - percentage of AI suggestions actually "Added" to the task list
   - Backend tracks `created_from_suggestion` flag
   - Target: >50%
   - Data collection ready via analytics integration
   
2. **Daily Active Users (DAU):** ✅ Authentication system enables tracking
   - User login timestamps recorded
   - Session management implemented
   - Target: Users log in 2+ times per week
   
3. **Task Completion:** ✅ Completion tracking fully functional
   - `completed_at` and `completed_by` fields tracked
   - Task completion rate can be calculated
   - Distinction between AI-generated and manual tasks available

**Next Steps for Metrics:**
- Integrate analytics platform (e.g., PostHog, Mixpanel)
- Create dashboards for metric visualization
- Set up automated reporting

---

## 7. Future Development Plans

This section outlines features deferred from the MVP that represent opportunities for future enhancement.

### 7.1. Enhanced Calendar Integration

**Calendar Import/Export:**
- iCal format support for importing existing calendars
- Google Calendar integration
- Apple Calendar integration
- Two-way sync capabilities
- Conflict resolution for overlapping events

**Advanced Views:**
- Daily view with hour-by-hour breakdown
- Weekly view with multi-day event spanning
- Agenda view (list format)
- Multi-calendar overlay (family, personal, work)

### 7.2. Advanced Notification System

**Push Notifications:**
- Browser push notifications for upcoming events
- Email digests (daily/weekly summaries)
- SMS notifications for critical reminders
- Customizable notification preferences per user
- Notification scheduling (e.g., 1 day before, 1 hour before)

**Smart Notifications:**
- AI-powered notification timing optimization
- Location-based reminders
- Weather-aware notifications (e.g., "Pack umbrella" if rain forecasted)

### 7.3. Mobile Applications

**Native Mobile Apps:**
- iOS app (Swift/SwiftUI)
- Android app (Kotlin/Jetpack Compose)
- Offline mode with sync
- Mobile-specific features:
  - Widget support
  - Quick-add shortcuts
  - Voice input for events
  - Photo attachments for events

**Progressive Web App (PWA):**
- Enhanced mobile web experience
- Add to home screen capability
- Offline functionality
- Push notification support

### 7.4. Advanced Task Management

**Standalone Task Lists:**
- Custom categories/folders (e.g., "Shopping," "Home Improvement," "Work")
- Recurring tasks (daily, weekly, monthly patterns)
- Task templates for common activities
- Task dependencies (prerequisite tasks)
- Subtasks and checklists

**Collaborative Features:**
- Task comments and discussions
- File attachments to tasks
- Task history and audit log
- Task assignments with notifications

### 7.5. Granular Sharing Controls

**Specific People Sharing:**
- Share individual events with selected family members only
- Group-based sharing (e.g., "Adults only," "Kids")
- Guest access for non-family members (e.g., babysitter)
- Permission levels (view only, edit, admin)

**External Sharing:**
- Public calendar links (read-only)
- Guest invitations via email
- Temporary access codes for visitors

### 7.6. Enhanced AI Capabilities

**Machine Learning-Based Suggestions:**
- Learn from user acceptance/rejection patterns
- Personalized suggestions based on family history
- Predict task duration based on past completions
- Smart scheduling recommendations

**Natural Language Processing:**
- Parse complex event descriptions
- Extract dates, times, and locations automatically
- Context-aware suggestions (e.g., "Pack sunscreen" for beach trips)

**Proactive Assistance:**
- Suggest events based on patterns (e.g., "Doctor visit is overdue")
- Budget tracking for event-related expenses
- Shopping list generation from event needs

### 7.7. Integrations and Ecosystem

**Third-Party Integrations:**
- Weather APIs for event planning
- Map integrations for location-based events
- Shopping list apps (e.g., AnyList, Out of Milk)
- Video conferencing (Zoom, Meet) for virtual events
- Food delivery services

**Smart Home Integration:**
- Alexa/Google Assistant voice commands
- Siri Shortcuts
- IFTTT/Zapier automation
- Smart display support

### 7.8. Analytics and Insights

**Family Insights Dashboard:**
- Busiest days/weeks visualization
- Task completion trends
- AI suggestion effectiveness metrics
- Family member contribution statistics

**Personal Productivity:**
- Individual task completion rates
- Time tracking for tasks
- Productivity patterns and recommendations
- Goal setting and tracking

### 7.9. Event Editing UI Enhancements

**Current State:** Backend fully supports event editing (PATCH /events/:eventId)

**Future UI Enhancements:**
- Inline editing from calendar view
- Drag-and-drop event rescheduling
- Bulk event operations
- Event duplication/templates
- Recurring event patterns

### 7.10. Testing and Quality Assurance

**Enhanced Testing Coverage:**
- Comprehensive E2E test suite with Playwright
- Visual regression testing
- Performance benchmarking
- Accessibility audits (WCAG 2.1 AA compliance)
- Load testing for multi-family scenarios

### 7.11. Premium Features (Monetization)

**Freemium Model:**
- Free tier: Up to 5 family members, basic features
- Premium tier:
  - Unlimited family members
  - Advanced AI suggestions
  - Priority support
  - Extended history (1+ year)
  - Export/backup capabilities
  - Custom branding

### 7.12. Localization and Internationalization

**Multi-Language Support:**
- Interface translations (Spanish, French, German, etc.)
- Date/time formatting per locale
- Currency localization for budget features
- Cultural event suggestions (local holidays)

---

## Appendix: Changelog

**v2.0 (2026-02-01):**
- Reorganized document to reflect MVP completion
- Moved unimplemented features to "Future Development Plans"
- Added implementation status to all user stories
- Added technical architecture section
- Corrected US-007 login button location (LandingPage, not Dashboard)

**v1.0 (2026-01-02):**
- Initial PRD for MVP scope
- Defined core features and user stories
   
