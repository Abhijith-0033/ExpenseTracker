# How to Install Expense Tracker on Your Android Phone

Since you want to "install" the app (have a standalone icon on your home screen without opening Expo Go), you need to build an **APK file**. We will use EAS (Expo Application Services) to do this easily.

## Prerequisites

1.  **Expo Account**: You need a free account at [expo.dev](https://expo.dev/signup).
2.  **EAS CLI**: You need the build tool installed.

## Step 1: Install EAS CLI
Run this command in your terminal:
```bash
npm install -g eas-cli
```
*Note: If you get a permission error, try running your terminal as Administrator.*

## Step 2: Login to Expo
Run:
```bash
eas login
```
Enter your Expo username and password when prompted.

## Step 3: Link Your Project
Run:
```bash
eas build:configure
```
*   It will ask `"Would you like into automatically create an EAS project for @your-username/ExpenseTracker?"` -> **Type `yes`**
*   If it asks about platforms, choose **Android**.
*   (It might detect the `eas.json` file I just created for you, which is good).

## Step 4: Build the APK
Run this specific command to build a simplified APK for testing:
```bash
eas build -p android --profile preview
```

## Step 5: Install on Phone
1.  **Process**: The build will take about 10-15 minutes in the cloud.
2.  **Download**: When finished, the terminal will show a **link** (usually ending in `.apk`).
3.  **QR Code**: It will also show a QR code.
4.  **Scan & Install**:
    *   Open your phone's camera or a QR scanner.
    *   Scan the code to download the `.apk` file.
    *   Tap the downloaded file.
    *   You may need to allow **"Install from Unknown Sources"** (Android security prompt).
    *   Tap **Install**.

## Alternative: Local Development (Wired)
If you just want to test properly without waiting for a build:
1.  Install **"Expo Go"** from the Google Play Store on your phone.
2.  Connect your phone to the same Wi-Fi as your computer.
3.  In your terminal, run: `npx expo start -c`
4.  Scan the QR code shown in the terminal with the Expo Go app.
*Note: This is not a permanent install; it requires the development server to be running.*
