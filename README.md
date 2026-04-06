markdown# Promet Source – UI & Accessibility Audit Tool

## Overview
An AI-powered web auditing tool built for Promet Source's pre-sales workflow. It analyzes up to 7 pages at once for accessibility, UX, SEO, performance, and more — generating a structured, exportable report that helps the team identify and communicate issues to prospects.

---

## Features
- **Multi-page audit** — scan up to 7 URLs in a single session
- **4 audit types** — Full UI Audit, Accessibility Focus, Migration Assessment, Technical Audit
- **WCAG 2.2 AA aligned** — issues mapped to specific WCAG criteria
- **Pinpoint issue location** — every finding includes visual location, HTML snippet, CSS selector, and DevTools snippet
- **Severity scoring** — Critical, High, Medium, Low with color-coded indicators
- **Score rings** — per-page and average scores visualized at a glance
- **Consolidated summary** — cross-page issue counts and score table
- **CSV export** — full report downloadable for Google Sheets or Excel
- **Rate limit protection** — automatic retry with exponential backoff between pages
- **Fully accessible UI** — keyboard navigable, screen reader friendly, WCAG 2.2 AA compliant focus indicators

---

## Tech Stack
- **React** (Vite + TypeScript)
- **Lucide React** — icons
- **Anthropic Claude API** — `claude-sonnet-4-20250514` with web search tool
- No backend, no database — fully client-side

---

## Project Structure
src/
├── App.tsx        ← entire application lives here
├── main.tsx       ← React entry point
├── index.css      ← global base styles
assets/
public/
index.html
package.json
vite.config.ts

---

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Anthropic API key (handled automatically in Claude.ai artifacts — no setup needed in StackBlitz)

### Installation
npm install
npm install lucide-react
npm run dev

---

## Deployment (StackBlitz)
1. Paste `App.tsx` contents into `src/App.tsx`
2. Confirm `src/main.tsx` imports `App` correctly
3. Run `npm install lucide-react` in the terminal
4. Click **Save** then **Share** to get your shareable link
5. Optionally click **Create a repository** to back up to GitHub

---

## Usage
1. Enter up to **7 page URLs** (must start with `https://`)
2. Select an **audit type**
3. Click **Run Audit**
4. Review results per page — expand/collapse categories and findings
5. Download the **CSV report** from the consolidated summary section

---

## Audit Types

| Type | Categories Covered |
|---|---|
| Full UI Audit | Accessibility, Design Consistency, UX, Visual Hierarchy, Mobile Responsiveness, SEO, Performance |
| Accessibility Focus | Perceivable, Operable, Understandable, Robust, SEO, Performance |
| Migration Assessment | Content Inventory, File Assets, Technical Architecture, Data Structures, Integrations, SEO, Performance |
| Technical Audit | SEO Fundamentals, Performance Analysis, Code Quality, Security Basics, Best Practices |

---

## Rate Limit Handling
The tool automatically manages API rate limits through:
- **Progressive cooldown** between pages (4s–10s, scaling with page count)
- **Exponential backoff retry** — up to 4 retries per page (4s → 8s → 16s → 32s)
- Status messages keep the auditor informed throughout

---

## Important Notes
- Intended for **pre-sales use** — recommended page count is 3–5 pages for a focused report
- Audit results are **session-only** — export the CSV before closing or refreshing
- StackBlitz free projects may go inactive after extended inactivity — refresh and wait 10–15 seconds to wake them up

---

## Built By
Promet Source — specialists in accessibility, performance, and Drupal migrations for the public sector.  
[prometsource.com/contact](https://www.prometsource.com/contact)