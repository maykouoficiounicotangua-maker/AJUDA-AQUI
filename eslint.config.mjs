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
    "next-env.d.ts",
    // scripts/testes de apoio e arquivos gerados
    "playwright-report/**",
    "test-results/**",
  ]),
  {
    rules: {
      // React Hook Form usa watch(); o React Compiler apenas deixa de memoizar esses componentes (sem bug).
      "react-hooks/incompatible-library": "off",
    },
  },
]);

export default eslintConfig;
