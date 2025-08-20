module.exports = {
  testEnvironment: 'node',
  preset: 'ts-jest',
  testPathIgnorePatterns: ['<rootDir>/dist/', '<rootDir>/.config/', '<rootDir>/node_modules/'],
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  testMatch: ['**/__tests__/**/*.(ts|js)', '**/*.(test|spec).(ts|js)'],
  collectCoverageFrom: [
    'src/**/*.{ts,js}',
    '!src/**/*.d.ts',
    '!src/__tests__/**',
  ],
};