This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Database Configuration

This application uses MongoDB for data storage. Follow these steps to set up your database connection:

1. Make sure you have MongoDB installed locally or have access to a MongoDB instance
2. Create a `.env.local` file in the root directory with the following content:

```
MONGODB_URI=mongodb://localhost:27017/aivery
```

Replace the URI with your actual MongoDB connection string if using a remote instance.

3. To initialize the database with sample data, run the application and navigate to `/init-db`
4. To verify database connectivity, navigate to `/check-db`

## Strava Integration

The application supports integration with Strava to import running and swimming activities. Users can choose to sync activities manually or enable automatic sync of new activities via Strava webhooks.

### Setup

1. Create a Strava API application at https://www.strava.com/settings/api
2. Set the Authorization Callback Domain to your app's domain (or `localhost:3000` for development)
3. Add the Strava credentials to your environment variables:

```
STRAVA_CLIENT_ID=your_client_id
STRAVA_CLIENT_SECRET=your_client_secret
NEXT_PUBLIC_APP_URL=http://localhost:3000 # or your production URL
```

### Webhook Configuration

For automatic syncing of new Strava activities, set up a webhook subscription:

1. Deploy your app to a public URL (webhooks require public HTTPS endpoints)
2. Set up the webhook via the admin API:

```
curl -X GET "https://your-app-url/api/strava/setup?action=create" \
  -H "Authorization: Bearer your_admin_key"
```

The webhook subscription will listen for new activities created in Strava and automatically import them based on user preferences.

### Local Testing with ngrok

For local development, you can use ngrok to expose your local server:

1. Install ngrok: https://ngrok.com/
2. Create a free ngrok account and get your authtoken
3. Configure ngrok with your auth token:
   ```
   ngrok config add-authtoken YOUR_AUTH_TOKEN
   ```
4. Start your Next.js app: `npm run dev`
5. Run ngrok to expose port 3000: `ngrok http 3000`
6. Copy the HTTPS URL provided by ngrok (e.g., https://a1b2c3d4.ngrok.io)
7. Update your `.env.local`:
   ```
   NEXT_PUBLIC_APP_URL=https://your-ngrok-url
   ALLOW_LOCALHOST_WEBHOOK=true
   ```
8. Restart your app and set up the webhook

#### Testing Webhooks Without Strava

You can test webhook functionality locally without connecting to Strava using the debug endpoint:

```bash
curl -X POST http://localhost:3000/api/strava/test-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "object_type": "activity",
    "object_id": 12345678987654321,
    "aspect_type": "create",
    "owner_id": YOUR_ATHLETE_ID,
    "event_time": 1516126040
  }'
```

Replace `YOUR_ATHLETE_ID` with the Strava athlete ID from your database.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## AI Integration

This application integrates with Anthropic's Claude API for generating personalized fitness content:

### Key Features
- Dynamic fitness quotes with user context awareness
- Personalized chat responses based on fitness goals and history
- Timestamp-based randomization for consistent variety

### Prompt Design
- Optimized for Claude's concise response style
- Short system roles with clear numbered instructions
- User messages include specific context (time of day, workout history, goals)
- Temperature set to 0.7 for balance between creativity and consistency
- Character limits enforced (100-150 chars for quotes)

### Transition from OpenAI to Claude
- Codebase cleaned up after Claude transition: Removed OpenAI references, standardized formatting, and ensured consistency in prompts and API calls
- Consistent temperature settings (0.7 for creative tasks, 0.3 for structured tasks)
- Standardized max_tokens values (75 for quotes, 100-500 for longer responses)
- Unified response handling with common getTextFromResponse utility function
- Improved error handling and fallback mechanisms

### Local Testing
Test the AI endpoints with:
```bash
# Test dynamic quotes (authenticated)
curl "http://localhost:3000/api/quotes/dynamic?name=YourName"

# Test regular quotes
curl "http://localhost:3000/api/quotes"
```

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
