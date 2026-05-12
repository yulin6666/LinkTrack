import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/server.ts',
    '!src/workers/**',
    '!src/config/**',
  ],
  coverageReporters: ['text', 'lcov'],
  // Allow Jest to transform ESM packages like nanoid
  transformIgnorePatterns: [
    'node_modules/(?!(nanoid)/)',
  ],
  // Prevent ts-jest from re-compiling on every test run
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: { module: 'commonjs' } }],
  },
};

export default config;
