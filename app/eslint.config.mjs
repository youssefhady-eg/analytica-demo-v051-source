import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

/** ESLint 9 flat config. `next lint` was removed in Next 16, so linting runs
 *  through ESLint directly (`npm run lint` → `eslint .`). */
const config = [
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "node_modules/**",
      "coverage/**",
      "test-results/**",
      "playwright-report/**",
      "*.tsbuildinfo",
      "next-env.d.ts",
    ],
  },
  ...nextCoreWebVitals,
  {
    files: ["**/*.{js,jsx,mjs,ts,tsx,mts,cts}"],
    rules: {
      "react-hooks/exhaustive-deps": "warn",
    },
  },
];

export default config;
