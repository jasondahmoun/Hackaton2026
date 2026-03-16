/* Tokens partagés — ne jamais hardcoder des couleurs dans les composants */

export const theme = {
  primary:      "var(--c-primary)",
  primaryLight: "var(--c-primary-light)",
  primaryDark:  "var(--c-primary-dark)",
  success:      "var(--c-success)",
  successLight: "var(--c-success-light)",
  error:        "var(--c-error)",
  errorLight:   "var(--c-error-light)",
  warning:      "var(--c-warning)",
  warningLight: "var(--c-warning-light)",
  bg:           "var(--c-bg)",
  bgWhite:      "var(--c-bg-white)",
  border:       "var(--c-border)",
  borderStrong: "var(--c-border-strong)",
  textHeading:  "var(--c-text-heading)",
  textBody:     "var(--c-text-body)",
  textMuted:    "var(--c-text-muted)",
  font:         "var(--sans)",
};

export const severityConfig = {
  critique: {
    color:  "var(--c-error)",
    bg:     "var(--c-error-light)",
    border: "#FECACA",
    label:  "Critique",
  },
  warn: {
    color:  "var(--c-warning)",
    bg:     "var(--c-warning-light)",
    border: "#FDE68A",
    label:  "Avertissement",
  },
  ok: {
    color:  "var(--c-success)",
    bg:     "var(--c-success-light)",
    border: "#A7F3D0",
    label:  "Conforme",
  },
};
