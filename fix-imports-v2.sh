#!/bin/bash

# Fix logger imports
echo "🔧 Fixing logger imports..."

# src/*.ts
for file in src/*.ts; do
  [ -f "$file" ] && sed -i '' "s|from '.*utils/logger'|from './utils/logger'|g" "$file"
done

# src/components/*.tsx
for file in src/components/*.tsx; do
  [ -f "$file" ] && sed -i '' "s|from '.*utils/logger'|from '../utils/logger'|g" "$file"
done

# src/services/*.ts
for file in src/services/*.ts; do
  [ -f "$file" ] && sed -i '' "s|from '.*utils/logger'|from '../utils/logger'|g" "$file"
done

# src/lib/*.ts
for file in src/lib/*.ts; do
  [ -f "$file" ] && sed -i '' "s|from '.*utils/logger'|from '../utils/logger'|g" "$file"
done

# src/config/*.ts
for file in src/config/*.ts; do
  [ -f "$file" ] && sed -i '' "s|from '.*utils/logger'|from '../utils/logger'|g" "$file"
done

# src/utils/*.ts (excluding logger.ts itself)
for file in src/utils/*.ts; do
  [ -f "$file" ] && [ "$(basename "$file")" != "logger.ts" ] && sed -i '' "s|from '.*utils/logger'|from './logger'|g" "$file"
done

echo "✅ Imports fixed"
