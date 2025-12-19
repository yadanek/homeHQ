# HomeHQ

## Project description

HomeHQ is a browser-based family headquarters that centralizes calendars, tasks, and private lists while leveraging a rule-driven AI assistant to relieve the mental load of managing household logistics. Unlike passive calendars, the app understands context: when an admin adds an event such as “Birthday,” “Doctor visit,” or “Parents night out,” the AI engine immediately suggests the relevant follow-up task (buy a gift, book a sitter, gather documents). Role-aware family spaces keep admins in full control and children seeing only shared calendars and lists.

![Version](https://img.shields.io/badge/version-0.0.0-blue)
![Hosting](https://img.shields.io/badge/hosting-Vercel-black)
![License](https://img.shields.io/badge/license-To%20Be%20Defined-lightgrey)

## Table of contents

- [Project description](#project-description)
- [Tech stack](#tech-stack)
- [Getting started locally](#getting-started-locally)
- [Available scripts](#available-scripts)
- [Project scope](#project-scope)
- [Project status](#project-status)
- [License](#license)



## Tech stack

- **Frontend:** Vite 6 + React 19 (Actions, `useOptimistic`), Schedule-X calendar, TypeScript 5, Tailwind 4, Shadcn/ui.
- **Backend:** Supabase (PostgreSQL with RLS, Supabase Auth with `family_id` metadata, Edge Functions for iCal imports and rule evaluation).
- **AI:** Hard-coded keyword rules inside Edge Functions for MVP; architectural readiness for future OpenRouter.ai LLM enhancements.
- **CI/CD & hosting:** GitHub Actions builds Docker/test pipelines and validates RLS logic, deployed on Vercel.

## Getting started locally

1. Install Node.js (v18 or newer recommended for Vite 7+) and npm.
2. Clone the repo and install dependencies:
   ```bash
   git clone https://github.com/yadanek/homeHQ.git
   cd homeHQ
   npm install
   ```
3. Start the dev server:
   ```bash
   npm run dev
   ```
4. Open the local URL (typically `http://localhost:5173`) to interact with the app.

Supabase integration requires configuring your own project credentials and Edge Functions; document the necessary environment variables once those services are provisioned. Add a `.nvmrc` file if your team standardizes on a Node version.

## Available scripts

- `npm run dev` – Runs Vite’s dev server with HMR for local development.
- `npm run build` – Executes `tsc -b` followed by `vite build` to compile production assets.
- `npm run lint` – Runs ESLint across the project.
- `npm run preview` – Serves the production build locally for verification.

## Project scope

- **Family setup & auth:** Email/password registration, automatic family creation, invite codes, and role mapping (Administrators vs. limited family members/children).
- **Calendar + integrations:** Month/week/day responsive views, native event creation with participants, Apple Calendar import (read-only) that triggers background AI analysis.
- **AI assistant (rule engine):** Hard-coded keyword matching for birthdays, parents-only outings, health, travel, and car-related tasks; suggestions shown inline with event creation or via a modal after import.
- **Tasks module:** Admin-only task list with sorting, editing, completion, and deletion for AI-generated or manual tasks.
- **Lists:** Shared vs. private lists with add/remove actions and checkboxes to keep the household aligned.

MVP boundaries: web-only (responsive design), read-only Apple import, non-editable AI rules, possible duplicate suggestions on repeated imports, UI-only notifications, and no built-in chat.

## Project status

The project is currently in the MVP stage and under active development.

## License

This project is licensed under the MIT Licence.