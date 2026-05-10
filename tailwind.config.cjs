/**
 * Slack-influenced design system for the CRM apps.
 *
 * The sidebar uses Slack's classic 8-part Aubergine theme:
 *   1. Column BG       — #4D394B (sidebar background)
 *   2. Menu BG Hover   — #3E313C (slightly darker on hover)
 *   3. Active Item     — #4C9689 (the teal "selected" pill)
 *   4. Active Item TxT — #FFFFFF
 *   5. Hover Item      — #5D475C (lighter aubergine on row hover)
 *   6. Text Color      — #FFFFFF (with #B7AFB6 for muted)
 *   7. Active Presence — #38978D (Slack's green presence indicator)
 *   8. Mention Badge   — #E01E5A (Slack's pink-red unread / mention)
 *
 * Brand accents come from Slack's official 5-color brand:
 *   - Aubergine #4A154B
 *   - Green     #2EB67D (confirm)
 *   - Blue      #36C5F0 (info)
 *   - Red       #E01E5A (alert)
 *   - Yellow    #ECB22E (warn)
 */
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        sidebar: {
          DEFAULT: "#4D394B",
          alt: "#3E313C",
          active: "#4C9689",
          hover: "#5D475C",
          text: "#FFFFFF",
          muted: "#B7AFB6",
          divider: "#3D2C3C",
          presence: "#38978D",
          mention: "#E01E5A",
        },
        brand: {
          aubergine: "#4A154B",
          green:     "#2EB67D",
          blue:      "#36C5F0",
          red:       "#E01E5A",
          yellow:    "#ECB22E",
        },
        confirm: {
          50:  "#ECFDF5",
          100: "#D1FAE5",
          500: "#2EB67D",
          600: "#1FA76C",
          700: "#118A56",
        },
        surface: {
          DEFAULT: "#FFFFFF",
          subtle: "#F8F8F8",
          muted: "#F1F2F4",
          divider: "#E1E3E6",
        },
        ink: {
          DEFAULT: "#1D1C1D",
          muted: "#616061",
          faint: "#868686",
        },
      },
      boxShadow: {
        card: "0 1px 1px rgba(0,0,0,0.05), 0 1px 3px rgba(0,0,0,0.08)",
        modal: "0 12px 32px rgba(0,0,0,0.18)",
      },
      fontFamily: {
        sans: [
          "Lato",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Helvetica Neue",
          "sans-serif",
        ],
      },
      fontSize: {
        "sidebar-section": ["11px", { lineHeight: "16px", letterSpacing: "0.06em" }],
        "sidebar-row":     ["14px", { lineHeight: "20px" }],
        "chat-body":       ["15px", { lineHeight: "22px" }],
        "chat-meta":       ["11px", { lineHeight: "14px" }],
      },
      borderRadius: {
        pill: "9999px",
      },
    },
  },
  plugins: [],
};
