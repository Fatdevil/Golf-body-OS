/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  roots: ['<rootDir>/tests', '<rootDir>/src'],
  testMatch: [
    '**/*.test.ts',
    '**/*.test.tsx',
  ],
  moduleNameMapper: {
    '^@core/(.*)$': '<rootDir>/src/core/$1',
    '^@protocols/(.*)$': '<rootDir>/src/protocols/$1',
    '^@ui/(.*)$': '<rootDir>/src/ui/$1',
    '^@modules/(.*)$': '<rootDir>/modules/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
