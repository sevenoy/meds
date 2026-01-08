#!/bin/bash

# Fix duplicate logger imports
echo "🔧 Fixing duplicate logger imports..."

for file in $(find src App.tsx -type f \( -name "*.ts" -o -name "*.tsx" \)); do
  # Remove duplicate logger imports
  awk '
    /import.*logger/ {
      if (!seen) {
        print
        seen = 1
      }
      next
    }
    { print }
  ' "$file" > "$file.tmp" && mv "$file.tmp" "$file"
done

echo "✅ Fixed duplicate imports"
echo "📊 Logger imports: $(grep -r "import.*logger" src App.tsx 2>/dev/null | wc -l)"
