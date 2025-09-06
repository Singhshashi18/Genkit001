{
  "name": "dotprompt",
  "version": "1.1.1",
  "description": "Dotprompt: Executable GenAI Prompt Templates",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "repository": {
    "type": "git",
    "url": "https://github.com/google/dotprompt.git",
    "directory": "js"
  },
  "keywords": [
    "genai",
    "prompting",
    "llms",
    "templating",
    "handlebars"
  ],
  "author": "",
  "license": "ISC",
  "devDependencies": {
    "@types/node": "^22.13.13",
    "@vitest/coverage-v8": "^3.0.9",
    "prettier": "^3.5.3",
    "tsup": "^8.4.0",
    "tsx": "^4.19.3",
    "typedoc": "^0.28.1",
    "typedoc-plugin-markdown": "^4.6.0",
    "typescript": "^5.8.2",
    "vitest": "^3.0.9"
  },
  "dependencies": {
    "@types/handlebars": "^4.1.0",
    "handlebars": "^4.7.8",
    "yaml": "^2.7.0"
  },
  "scripts": {
    "compile": "tsup-node src/index.ts --dts --format esm,cjs",
    "build": "npm run compile && tsc -p ./tsconfig.build.json --noEmit",
    "watch": "npm run compile -- --watch",
    "test": "vitest run --coverage",
    "test:watch": "vitest"
  }
}