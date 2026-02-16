# ExpenseTracker
A production-ready personal finance Android app built with Expo and React Native. Features include expense and income tracking, account management, analytics with interactive charts, expense books, bill splitting, recharge reminders, notifications, PDF export, and secure backup/restore. Designed with a minimal and professional UI.
💰 Expense Tracker App

A production-ready personal finance Android application built using Expo + React Native.
Designed with a minimal, professional UI and built with a product-focused mindset.

🚀 Features
💸 Expense & Income Management

Add, edit, delete expenses

Add, edit, delete income

Multiple accounts with real-time balance updates

Category & subcategory management

Source of income tracking

📊 Advanced Analytics

Monthly, weekly, and daily expense graphs

Interactive pie charts

Income vs Expense comparison graphs

Category-wise & subcategory-wise breakdown

Expense book analytics

📘 Expense Books

Create separate books (e.g., Painting Cost, Trip Budget)

Add income & expense inside books

Auto total calculation

Income vs Expense graph per book

Export book as professional PDF

👥 Bill Splitter (Group Expense Book)

Add members

Auto split (equal/custom)

Track who owes whom

Settlement tracking

📅 Smart Recharge & Upcoming Expenses

Track mobile recharge validity (28/56/84 days)

Automatic expiry calculation

Local reminder notifications

Upcoming expenses section

🔔 Notifications

Daily 9 PM expense reminder

Recharge expiry reminder

💾 Backup & Restore

Export data as JSON

Full restore support (including recharge metadata)

🔊 UX Enhancements

Separate sounds for expense & income

Animated professional landing screen

SafeArea support for all devices

Gold coin adaptive app icon

🛠 Tech Stack

Expo (EAS Build)

React Native

TypeScript

SQLite (expo-sqlite)

React Query

Lucide Icons

Local Notifications

PDF Generation

📦 Installation (Development)
npm install
npx expo start

📲 Build APK (Android)
eas build --platform android --profile preview

🔐 Data Safety

Atomic transaction updates

No destructive schema changes

Secure financial balance recalculations

Backup support before updates

🎯 Product Vision

This project was built not just as a finance app, but as a modular financial engine, focusing on:

Data integrity

UX clarity

Financial correctness

Real-world usability

📌 Version

Current Version: 1.9.2 (Build 22)
