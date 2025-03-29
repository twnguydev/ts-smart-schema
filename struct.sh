mkdir -p ts-smart-schema/src/{core,types,utils,plugins}
cd ts-smart-schema

npm init -y

npm install --save-dev typescript @types/node jest ts-jest @types/jest prettier eslint

cat > tsconfig.json << EOL
{
  "compilerOptions": {
    "target": "es2020",
    "module": "commonjs",
    "declaration": true,
    "outDir": "./dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "lib": ["es2020", "dom"],
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "**/*.test.ts"]
}
EOL

cat > jest.config.js << EOL
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  collectCoverage: true,
  coverageDirectory: 'coverage',
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts']
};
EOL

cat > package.json << EOL
{
  "name": "ts-smart-schema",
  "version": "0.1.0",
  "description": "A powerful schema validation and transformation library for TypeScript",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "jest",
    "lint": "eslint --ext .ts src/",
    "format": "prettier --write \"src/**/*.ts\"",
    "prepare": "npm run build",
    "prepublishOnly": "npm test && npm run lint"
  },
  "keywords": [
    "typescript",
    "validation",
    "schema",
    "transformation",
    "type-safety"
  ],
  "author": "",
  "license": "MIT",
  "files": [
    "dist"
  ],
  "devDependencies": {
    "@types/jest": "^29.5.0",
    "@types/node": "^18.15.11",
    "eslint": "^8.38.0",
    "jest": "^29.5.0",
    "prettier": "^2.8.7",
    "ts-jest": "^29.1.0",
    "typescript": "^5.0.4"
  }
}
EOL