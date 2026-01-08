#!/bin/bash

# Production Cleanup Script
# Removes all console.log/warn and debug fetch calls

echo "🧹 Starting production cleanup..."

# Step 1: Remove all #region agent log blocks
echo "📝 Removing debug fetch blocks..."
find src App.tsx -type f \( -name "*.ts" -o -name "*.tsx" \) -exec perl -i -0pe 's/\s*\/\/ #region agent log.*?\/\/ #endregion\n?//gs' {} \;

# Step 2: Create backup
echo "💾 Creating backup..."
cp -r src src.backup.$(date +%Y%m%d_%H%M%S)

# Step 3: Add logger import to all files that use console
echo "📦 Adding logger imports..."
for file in $(grep -rl "console\.\(log\|warn\)" src App.tsx 2>/dev/null); do
  # Check if logger import already exists
  if ! grep -q "from.*logger" "$file"; then
    # Calculate relative path to logger
    depth=$(echo "$file" | tr -cd '/' | wc -c)
    if [[ "$file" == "App.tsx" ]]; then
      prefix="./src/utils/logger"
    elif [[ $depth -eq 1 ]]; then
      prefix="../utils/logger"
    elif [[ $depth -eq 2 ]]; then
      prefix="../../utils/logger"
    else
      prefix="../utils/logger"
    fi
    
    # Add import after the last import statement
    sed -i '' "/^import/a\\
import { logger } from '$prefix';\\
" "$file"
  fi
done

# Step 4: Replace console.log with logger.log
echo "🔄 Replacing console.log..."
find src App.tsx -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' 's/console\.log/logger.log/g' {} \;

# Step 5: Replace console.warn with logger.warn
echo "🔄 Replacing console.warn..."
find src App.tsx -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' 's/console\.warn/logger.warn/g' {} \;

# Step 6: Count remaining issues
echo ""
echo "✅ Cleanup complete!"
echo ""
echo "📊 Statistics:"
echo "  console.log remaining: $(grep -r "console\.log" src App.tsx 2>/dev/null | wc -l)"
echo "  console.warn remaining: $(grep -r "console\.warn" src App.tsx 2>/dev/null | wc -l)"
echo "  console.error remaining: $(grep -r "console\.error" src App.tsx 2>/dev/null | wc -l)"
echo "  debug fetch remaining: $(grep -r "127\.0\.0\.1:7245" src App.tsx 2>/dev/null | wc -l)"
echo ""
echo "  logger.log added: $(grep -r "logger\.log" src App.tsx 2>/dev/null | wc -l)"
echo "  logger.warn added: $(grep -r "logger\.warn" src App.tsx 2>/dev/null | wc -l)"
