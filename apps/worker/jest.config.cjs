module.exports = {
  rootDir: ".",
  testEnvironment: "node",
  testRegex: ".*\\.spec\\.ts$",
  transform: {
    "^.+\\.(t|j)s$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.spec.json" }],
  },
  moduleFileExtensions: ["js", "json", "ts"],
  moduleNameMapper: {
    "^@hooklane/contracts$": "<rootDir>/../../packages/contracts/src/index.ts",
    "^@hooklane/integrations$":
      "<rootDir>/../../packages/integrations/dist/index.js",
    "^@hooklane/db$": "<rootDir>/../../packages/db/src/index.ts",
    "^@hooklane/queue$": "<rootDir>/../../packages/queue/src/index.ts",
  },
};
