import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "next-env.d.ts",
    // סקריפטי k6 לבדיקת עומס — מריצים תחת runtime של k6, לא חלק מקוד האפליקציה.
    // k6 מחייב default export של פונקציה, שמתנגש עם כללי הלינט של האפליקציה.
    "load-test/**",
  ]),
]);

export default eslintConfig;
