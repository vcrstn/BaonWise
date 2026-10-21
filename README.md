# BaonWise — Smart Student Budgeting & Allowance Tracker

**BaonWise** is a modern, student-friendly budgeting web application built to help students track daily expenses, stretch their *baon* (allowance), set aside funds for necessities and savings (*ipon*), and make informed spending decisions.

---

## ✨ Key Features

- **Personalized Allowance Dashboard**
  - Supports **Daily**, **Weekly** (5, 6, or 7 active days), and **Monthly** allowance cycles.
  - Real-time summary cards for **Total Allowance**, **Remaining Balance**, **Total Expenses**, and **Daily Spending Limit**.
  - Visual spending progress bar and 7-day activity bar chart.

- **“Can I Afford This?” Reality Checker**
  - Instant affordability check before buying an item.
  - Evaluates item price against remaining balance, reserved necessities + *ipon*, and safe daily spending limits.
  - Provides actionable recommendations on whether to buy now or save more first.

- **Expense Tracking & Search**
  - Log, edit, and delete expenses across student-focused categories (**Food**, **Transportation**, **School**, **Personal**, **Others**).
  - Filter by category or search transactions in real time from the top navigation bar.

- **Budget Planner & Allocation**
  - Allocate allowance between **Necessities**, **Savings Goal (*Ipon*)**, and **Flexible Spending**.
  - Interactive donut chart visualizing reserved vs. flexible budget alongside overall cycle progress.

- **Spending Reports & Insights**
  - Category-by-category spending breakdown with visual progress bars.
  - Automatic highlights for top spending categories, transaction count, and average expense size.

- **Authentication & Per-User Data Management**
  - Sign in with **Google OAuth 2.0 (Google Identity Services)** or create a local email & password account.
  - Per-user data persistence in `localStorage` so multiple accounts on the same browser keep separate budgets.
  - **CSV Export** for spreadsheet backups, cycle reset (clearing expenses while keeping settings), and full factory reset.

---

## 🛠️ Tech Stack

- **Framework:** [React 19](https://react.dev/)
- **Language:** [TypeScript](https://www.typescriptlang.org/)
- **Build Tool:** [Vite 8](https://vite.dev/)
- **Styling:** [Tailwind CSS v4](https://tailwindcss.com/) + Custom CSS Variables (`Poppins` typography & contrast-rich pastel design tokens)
- **Authentication:** Google Identity Services (OAuth 2.0) & Local Account Auth
- **Storage:** Browser `localStorage` with CSV Export (`Blob` API)

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** (v18+ recommended)
- **npm**

### 1. Clone the repository

```bash
git clone https://github.com/vcrstn/BaonWise.git
cd BaonWise
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure Google OAuth 2.0 (Optional)

BaonWise works out of the box with local email/password accounts. To enable real **Google Sign-In**:

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Create an **OAuth 2.0 Web Client ID** in the [Google Cloud Console](https://console.cloud.google.com/apis/credentials) and add `http://localhost:5173` under **Authorized JavaScript origins**.
3. Paste your Client ID into `.env`:
   ```env
   VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   ```
   *(You can also paste or update your Client ID directly inside the app via the Google Sign-In configuration modal.)*

### 4. Start the development server

```bash
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## 📜 Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Start the Vite development server |
| `npm run build` | Build the production bundle into `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run format` | Format source files using `oxfmt` |

---

## 📂 Project Structure

```text
BaonWise/
├── public/
│   └── favicon.svg        # App icon
├── src/
│   ├── App.tsx            # Core application views, state management, and OAuth logic
│   ├── index.css          # Design tokens, layout rules, and responsive styles
│   ├── main.tsx           # React DOM entry point
│   └── vite-env.d.ts      # Vite TypeScript environment declarations
├── .env.example           # Example environment variables for Google OAuth
├── index.html             # HTML entry point & Google GSI script
├── package.json           # Dependencies and scripts
├── tsconfig.json          # TypeScript configuration
└── vite.config.ts         # Vite & Tailwind plugin configuration
```
