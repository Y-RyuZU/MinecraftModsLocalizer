/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/src/**/*.{test,spec}.{js,jsx,ts,tsx}'
  ],
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '\\.bun\\.test\\.(ts|tsx)$',
    '\\.vitest\\.test\\.(ts|tsx)$',
    '<rootDir>/src/__tests__/services/translation-service.test.ts',
    '<rootDir>/src/__tests__/services/translation-runner.test.ts',
    '<rootDir>/src/__tests__/adapters/openai-adapter.test.ts',
    '<rootDir>/src/__tests__/tabs/mods-tab.test.tsx',
    '<rootDir>/src/__tests__/components/translation-tab.test.tsx',
    '<rootDir>/src/__tests__/e2e/',
    '<rootDir>/src/__tests__/services/file-service-lang-format.test.ts',
    '<rootDir>/src/__tests__/test-setup.ts',
    '<rootDir>/src/lib/services/__tests__/ftb-quest-realistic.e2e.test.ts',
    '<rootDir>/src/__tests__/integration/realistic-minecraft-directory.test.ts',
    '<rootDir>/src/__tests__/test-utils/minecraft-directory-mock.ts'
  ],
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/app/globals.css',
    '!src/pages/_*.tsx'
  ],
  coverageReporters: ['text', 'lcov', 'html'],
  coverageDirectory: 'coverage',
  testTimeout: 10000,
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: {
        jsx: 'react-jsx',
      },
    }],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(.*\\.mjs$))',
  ],
}