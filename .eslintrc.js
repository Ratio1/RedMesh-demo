module.exports = {
  root: true,
  extends: ["next/core-web-vitals", "eslint:recommended"],
  parserOptions: {
    project: ["./tsconfig.json"],
    tsconfigRootDir: __dirname
  },
  globals: {
    JSX: 'readonly'
  },
  rules: {
    "@next/next/no-html-link-for-pages": "off",
    "react/jsx-props-no-spreading": "off",
    "no-unused-vars": "off"
  }
};
