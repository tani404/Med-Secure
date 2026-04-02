/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        /* MD3 surface */
        surface: {
          DEFAULT: "#faf8ff",
          dim: "#d2d9f4",
          bright: "#faf8ff",
          "c-lowest": "#ffffff",
          "c-low": "#f2f3ff",
          "c": "#eaedff",
          "c-high": "#e2e7ff",
          "c-highest": "#dae2fd",
          variant: "#dae2fd",
          tint: "#0053db"
        },
        /* MD3 primary */
        primary: {
          DEFAULT: "#004ac6",
          container: "#2563eb",
          fixed: "#dbe1ff",
          "fixed-dim": "#b4c5ff"
        },
        /* MD3 secondary */
        secondary: {
          DEFAULT: "#006e2d",
          container: "#7cf994",
          fixed: "#7ffc97",
          "fixed-dim": "#62df7d"
        },
        /* MD3 tertiary */
        tertiary: {
          DEFAULT: "#824500",
          container: "#a65900",
          fixed: "#ffdcc3",
          "fixed-dim": "#ffb77d"
        },
        /* MD3 error */
        error: {
          DEFAULT: "#ba1a1a",
          container: "#ffdad6"
        },
        /* MD3 outline */
        outline: {
          DEFAULT: "#737686",
          variant: "#c3c6d7"
        },
        /* On-color tokens */
        "on-surface": "#131b2e",
        "on-surface-variant": "#434655",
        "on-primary": "#ffffff",
        "on-primary-container": "#eeefff",
        "on-primary-fixed": "#00174b",
        "on-primary-fixed-variant": "#003ea8",
        "on-secondary": "#ffffff",
        "on-secondary-container": "#007230",
        "on-secondary-fixed": "#002109",
        "on-secondary-fixed-variant": "#005320",
        "on-tertiary": "#ffffff",
        "on-tertiary-container": "#ffede1",
        "on-tertiary-fixed": "#2f1500",
        "on-tertiary-fixed-variant": "#6e3900",
        "on-error": "#ffffff",
        "on-error-container": "#93000a",
        "on-background": "#131b2e",
        "inverse-surface": "#283044",
        "inverse-on-surface": "#eef0ff",
        "inverse-primary": "#b4c5ff"
      },
      fontFamily: {
        headline: ["Newsreader", "serif"],
        body: ["Manrope", "sans-serif"],
        label: ["Space Grotesk", "monospace"],
        sans: ["Manrope", "system-ui", "sans-serif"],
        display: ["Newsreader", "serif"]
      },
      borderRadius: {
        DEFAULT: "0.125rem",
        lg: "0.25rem",
        xl: "0.5rem",
        "2xl": "0.75rem",
        "3xl": "1rem",
        full: "9999px"
      },
      boxShadow: {
        card: "0 1px 3px rgba(15, 23, 42, 0.04), 0 4px 16px -4px rgba(15, 23, 42, 0.06)",
        soft: "0 4px 24px -4px rgba(0, 74, 198, 0.12)",
        glow: "0 0 40px -8px rgba(0, 74, 198, 0.15)"
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease-out forwards",
        "fade-up": "fadeUp 0.6s ease-out forwards"
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        }
      }
    }
  },
  plugins: []
};
