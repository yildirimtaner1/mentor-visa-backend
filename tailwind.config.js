/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  corePlugins: {
    preflight: false, // Disables Tailwind's CSS reset so it doesn't break our existing custom vanilla CSS!
  },
  plugins: [],
}
