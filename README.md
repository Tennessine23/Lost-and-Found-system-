# Eastlands College Lost & Found

A lightweight, responsive web application for reporting, browsing, and reclaiming lost and found items on campus. Built with vanilla HTML, CSS, and JavaScript using `localStorage` for zero-backend deployment.

## Features

- **Report Lost or Found Items:** Submit item details, category, campus location, date/time, and an optional photo (automatically resized client-side).
- **Search & Filter:** Filter items in real time by keyword, status (`Lost` / `Found`), and category (`Wallets`, `Phones`, `Keys`, `Bags`, `Laptops`, `Other`).
- **Automated Match Alerts:** Notifies users in **My Items** when a newly reported found item matches the category of their open lost report.
- **Ownership Verification & Claims:** Users can submit private item descriptions to claim found items; administrators review and approve/reject claims before handover.
- **Admin Dashboard:** View campus-wide item and claim metrics, approve or reject pending claims, update item statuses, and remove reports.
- **Responsive Design:** Adapts between a bottom tab bar on mobile devices and a sidebar layout on desktop screens.

## Project Structure

```text
eastlands-lost-and-found/
├── index.html   # App shell and view templates
├── styles.css   # Responsive layout, theme tokens, and component styles
├── app.js       # Client-side router, UI rendering, and localStorage database
└── README.md    # Project documentation
