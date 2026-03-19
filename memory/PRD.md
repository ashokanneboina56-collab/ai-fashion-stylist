# AI Fashion Designer - Product Requirements Document

## Overview
AI Fashion Designer is a premium AI-powered wardrobe management and outfit recommendation mobile application. It acts as a personal AI stylist that helps users digitize their wardrobe, automatically classify clothes using AI, generate outfit combinations, track outfit history, receive clothing recommendations, and view wardrobe analytics.

## Tech Stack
- **Frontend**: React Native (Expo SDK 54) with expo-router
- **Backend**: FastAPI (Python) 
- **Database**: MongoDB (local)
- **AI**: OpenAI GPT-5.2 via emergentintegrations library
- **Auth**: JWT + Emergent Google OAuth

## Core Features

### 1. Authentication
- Email/password registration and login (JWT-based)
- Google social login (Emergent OAuth)
- Secure token storage with AsyncStorage
- 7-day token expiry

### 2. Wardrobe Dashboard
- Grid layout (2 columns) of clothing items
- Each card: image, name, category, color tag, wear count
- Search bar with text filtering
- Category filter chips (All, Tops, Bottoms, Shoes, etc.)
- Sort by most/least worn
- Pull-to-refresh
- FAB button to add new items

### 3. Add Clothing (AI-Powered)
- Camera capture or gallery upload
- Image processing: resize, compress, optimize
- AI analysis via GPT-5.2 vision:
  - Category detection (Tops, Bottoms, Shoes, etc.)
  - Color identification
  - Texture analysis (cotton, silk, denim, etc.)
  - Style classification (casual, formal, sporty, etc.)
  - Automatic name generation
- Results display with attribute breakdown
- Add another or return to wardrobe

### 4. Clothing Detail
- Hero image display
- Full attribute breakdown (category, color, texture, style)
- Wear count and date added
- Delete item functionality
- "Predict Matching Outfit" button

### 5. AI Outfit Prediction
- Select any wardrobe item
- AI generates up to 3 outfit combinations
- Each outfit shows: Top, Bottom, Shoes, Accessories
- Compatibility score (percentage)
- Reason for match (color harmony, style compatibility)
- Actions: "Wear Today", "Save Outfit", "Generate New"

### 6. Outfit History
- Track previously worn outfits with dates
- Item details for each outfit
- Avoid repeated outfit suggestions

### 7. AI Recommendations
- AI suggests new clothing items based on wardrobe
- Real store links: Amazon India, Flipkart, Myntra, Meesho
- Match score and reason for recommendation
- Price range indication
- Direct shop links

### 8. Wardrobe Analytics
- Total items, outfits, and worn count
- Category distribution (horizontal bar chart)
- Color distribution (color circles)
- Style insights (chips)
- Most worn and least worn items

## Design
- **Theme**: Dark mode luxury (#050505 background)
- **Accent**: Gold (#D4AF37)
- **Typography**: PlayfairDisplay (headings) + Lato (body)
- **Layout**: Card-based UI with rounded corners and soft shadows
- **Animations**: FadeInUp, staggered reveals via react-native-reanimated

## API Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | User registration |
| POST | /api/auth/login | User login |
| POST | /api/auth/google | Google OAuth |
| GET | /api/auth/me | Get current user |
| POST | /api/auth/logout | Logout |
| GET | /api/wardrobe | List wardrobe items |
| POST | /api/wardrobe/add | Add clothing with AI analysis |
| GET | /api/wardrobe/:id | Get item details |
| DELETE | /api/wardrobe/:id | Delete item |
| POST | /api/outfit/predict | AI outfit prediction |
| POST | /api/outfit/save | Save outfit |
| POST | /api/outfit/wear | Record wearing outfit |
| GET | /api/outfit/history | Get outfit history |
| GET | /api/outfit/saved | Get saved outfits |
| GET | /api/recommendations | AI recommendations |
| GET | /api/analytics | Wardrobe analytics |

## Database Collections
- **users**: user_id, name, email, password, profile_image, created_at
- **user_sessions**: user_id, session_token, expires_at, created_at
- **wardrobe_items**: item_id, user_id, image_base64, name, category, color, texture, style, wear_count, created_at
- **outfits**: outfit_id, user_id, top_id, bottom_id, shoes_id, accessory_id, compatibility_score, reason, created_at
- **outfit_history**: history_id, user_id, outfit_id, worn_date

## Environment Variables
### Backend (.env)
- MONGO_URL
- DB_NAME
- EMERGENT_LLM_KEY
- JWT_SECRET

### Frontend (.env)
- EXPO_PUBLIC_BACKEND_URL
- EXPO_PACKAGER_PROXY_URL
- EXPO_PACKAGER_HOSTNAME

## Future Enhancements
- Background removal using U2Net/MODNet for cleaner product images
- Season-based outfit suggestions
- Social sharing of outfits
- Wardrobe value estimation
- Subscription-based premium features for monetization
