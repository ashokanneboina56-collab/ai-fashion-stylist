# AI Fashion Stylist Frontend

This is an Expo-based React Native application that serves as the mobile/web interface for the AI Fashion Stylist.

## Prerequisites

- [Node.js](https://nodejs.org/) (LTS recommended)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)
- [Expo Go](https://expo.dev/go) app installed on your phone (for mobile testing)

## Frontend Setup

### 1. Install Dependencies
```bash
npm install
# or
yarn install
```

### 2. Environment Configuration
Create a `.env` file in this directory with the following content:
```env
EXPO_PUBLIC_BACKEND_URL=http://your-computer-ip:8000
```
> **Note:** Use your computer's local IP address instead of `localhost` if you are testing on a physical phone.

### 3. Start the Application
To start the Expo development server:
```bash
npx expo start
```

### 4. Running on Different Platforms
- **Android:** Press `a` in the terminal (requires Android Studio/emulator or a connected device).
- **iOS:** Press `i` in the terminal (requires macOS and Xcode).
- **Web:** Press `w` in the terminal.
- **Physical Phone:** Scan the QR code displayed in the terminal using the Expo Go app.
