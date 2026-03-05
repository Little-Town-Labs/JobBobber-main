// @ts-check
import nextConfig from "eslint-config-next/core-web-vitals"
import prettierConfig from "eslint-config-prettier/flat"

export default [
  ...nextConfig,
  prettierConfig,
  {
    settings: {
      react: { version: "19.0" },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
    },
  },
]
