/** @type {import('ts-jest').JestConfigWithTsJest} */

export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFiles: ['./test/jest.setup.ts'],
  roots: ['./test'],
  moduleNameMapper: {
    '\\.(scss|css)$': '<rootDir>/test/style-mock.ts',
  },
};
