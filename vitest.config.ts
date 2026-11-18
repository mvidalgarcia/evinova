import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    // .feature files are read at run time, not imported, so watch mode can't see them.
    // Re-run the matching test when one changes: foo.feature -> foo.test.ts.
    watchTriggerPatterns: [
      {
        pattern: /^(.*)\.feature$/,
        testsToRun: (_file, match) => `${match[1]}.test.ts`,
      },
    ],
  },
});
