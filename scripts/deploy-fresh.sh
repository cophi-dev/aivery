#!/bin/bash

# Terminal colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Starting fresh deployment process...${NC}"

# 1. Make scripts executable
chmod +x scripts/update-manifest.js
echo -e "${GREEN}✅ Made scripts executable${NC}"

# 2. Update manifest with new build ID
node scripts/update-manifest.js
if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Failed to update manifest${NC}"
  exit 1
fi

# 3. Clean Vercel cache
echo -e "${YELLOW}Cleaning Vercel cache...${NC}"
npm run clean-vercel
if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Failed to clean Vercel cache${NC}"
  exit 1
fi

# 4. Commit changes
echo -e "${YELLOW}Committing changes...${NC}"
git add public/manifest.json
git commit -m "Deploy: Fresh build with cache busting ($(date))"
if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Failed to commit changes${NC}"
  exit 1
fi

# 5. Push to main branch
echo -e "${YELLOW}Pushing to main...${NC}"
git push origin main
if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Failed to push to main${NC}"
  exit 1
fi

# 6. Deploy to Vercel with force-dynamic flag
echo -e "${YELLOW}Deploying to Vercel...${NC}"
NEXT_DISABLE_STATIC_GENERATION=true NEXT_FORCE_DYNAMIC=true NEXT_RUNTIME=nodejs npx vercel --prod
if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Vercel deployment failed${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo -e "${BLUE}Open in an incognito window to verify your changes.${NC}" 