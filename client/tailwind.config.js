/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        editor: {
          bg: {
            dark: '#1e1e2e',
            light: '#ffffff'
          },
          sidebar: {
            dark: '#181825',
            light: '#f8fafc'
          },
          border: {
            dark: '#313244',
            light: '#e2e8f0'
          }
        }
      }
    },
  },
  plugins: [],
}
