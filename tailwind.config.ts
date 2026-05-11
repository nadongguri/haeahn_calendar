import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#4c5868",
        muted: "#707985",
        panel: "#f7f8fa",
        line: "#c9cdd1",
        accent: "#0e4e96"
      },
      boxShadow: {
        soft: "0 16px 40px rgba(76, 88, 104, 0.10)"
      }
    }
  },
  plugins: []
};

export default config;
