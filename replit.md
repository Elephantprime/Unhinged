# Overview

Unhinged is a modern dating application built with a hybrid Firebase/Node.js architecture. The platform emphasizes "radically honest dating" where users post their red flags first, creating an authentic dating experience through community features like chat rooms, live streaming, badges, and user reviews. The application includes both serverless functions for payments and a traditional Express.js server for additional API endpoints.

# Recent Changes

## September 17, 2025 - Districts System Firebase Security Rules Fixed

### Firebase Security Rules Resolution
- **Root Cause**: Missing Firebase security rules for new `districts_polls` and `districts_stories` collections
- **Error**: "failed-precondition" Firebase errors causing "Error loading content" display
- **Solution**: Added comprehensive security rules for new Districts collections:
  - `districts_polls` - Poll creation, voting, reading, and deletion with proper user validation
  - `districts_stories` - Story creation, sharing, reactions, and deletion with content size limits
- **Result**: Districts system now loads properly without Firebase errors

### Technical Implementation
- Added security rules with proper field validation, size limits, and user ownership checks
- Maintained anonymity requirements for confessions while allowing user attribution for other content
- Implemented proper CRUD permissions with admin override capabilities

## September 16, 2025 - Critical System Failures Resolved

### Major System Recovery - All Critical Issues Fixed
- **Authentication System Restored**: Fixed Firebase Auth initialization timing issues that were causing "No authenticated user" errors despite successful login
- **Function Export/Import Fixed**: Resolved missing function exports that were causing "handler is not a function" and "sendLiveStreamMessage is not defined" errors 
- **Avatar System Repaired**: Eliminated shared localStorage fallback that was causing all users to display the same profile picture - now each user sees their own avatar
- **UI Navigation Restored**: Fixed Districts, Spotlight, Passport button handlers and modal closing functionality

### Technical Achievements
- **Centralized Authentication**: Implemented proper `waitForAuth()` usage across all pages with async/await patterns
- **Module Scope Resolution**: Fixed ES6 module exports to make streaming and navigation functions globally accessible
- **User-Specific Avatar Loading**: Replaced shared fallback system with proper UID-based avatar persistence
- **Event Handler Binding**: Restored proper event listeners for all interactive UI elements

### Verification Results
- ✅ **Chat Authentication**: Users now properly enter chat rooms with "Successfully entered chat with presence tracking"
- ✅ **Real-time Features**: Table joining, presence tracking, and live counters all functional
- ✅ **Profile Pictures**: User-specific avatar loading confirmed with proper localStorage keying
- ✅ **Interactive Elements**: All buttons, modals, and navigation working as intended

## September 15, 2025 - Complete Unhinged World Metaverse Implementation

### Major Platform Completion
- **Complete Metaverse Implementation**: Successfully delivered comprehensive "Unhinged World" platform with 6 major sections:
  - **Lounge**: Real-time social tables with avatar system, global/table/whisper chat, user presence tracking
  - **Arcade**: Gamified experience with points, badges, leaderboards, enhanced games (Truth/Dare, Casino, Trivia, Meme contests)
  - **Stages**: Live events platform with audio rooms, video pods with WebRTC, Hot Seat Q&A system, event board
  - **Districts**: 6 themed communities (Dating, Memes, Confessions, Debates, Support, Gaming) with specialized features
  - **Passports**: Comprehensive interaction tracking system with stamps, travel logs, social encounters
  - **Spotlight**: User highlighting system with token-based features

### Critical Technical Achievements
- **WebRTC Integration**: Full peer-to-peer video/audio streaming with Firebase signaling for live events
- **Real-time Architecture**: Comprehensive Firestore listeners for live chat, presence, events, and notifications across all sections
- **Gamification System**: Complete points/badges/stamps system with cross-platform tracking and rewards
- **Security Implementation**: Comprehensive Firestore security rules for all collections with proper user ownership validation
- **Global API Integration**: Unified PassportAPI system tracking user activity across all World sections

### Passport System (New)
- **Interaction Tracking**: Automatic stamp collection for chat participation, game completion, event attendance
- **Travel History**: Complete log of user visits across all World sections with timestamps
- **Social Encounters**: Recording and tracking of user interactions and connections
- **Real-time Notifications**: Toast system for stamp awards and achievement unlocks
- **Cross-platform Integration**: Seamless activity tracking across Lounge, Arcade, Stages, Districts, and Spotlight

## September 15, 2025 - Lounge Table Reorganization
- **Enhanced Lounge Structure**: Completely reorganized lounge tables into 4 themed categories with 25 total themed tables
  - **💖 Dating Energy**: The Love Seat, Thirst Trap, Situationship, Swipe Right, First Date Table, It's Complicated  
  - **🍸 Lounge Vibes**: The Barstool, VIP Booth, The Dance Floor, Champagne Corner, Late Night Confessions, Candlelight Table
  - **🤯 Unhinged**: The Red Flag Table, Ghosting Central, Toxic Exes Anonymous, Gaslight Grill, Delulu Den, The Drama Table
  - **🎭 Icebreakers**: Truth or Dare Table, Hot Take HQ, Unpopular Opinions, Dealbreaker Diner, Would You Rather Booth, Storytime Spot
- **Tab-based Navigation**: Added 5 main tabs (Dating Energy, Lounge Vibes, Unhinged, Icebreakers, Games) for better organization
- **Enhanced Visual Design**: Custom color schemes and gradients for each table category with improved responsive grid layout
- **Improved Chat Integration**: Chat titles now display themed table names instead of generic "Table 1" format
- **Avatar Persistence**: User avatars and preferences save automatically to Firebase profiles and load on return visits

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Static HTML/CSS/JS**: Multi-page application with vanilla JavaScript modules
- **Firebase SDK Integration**: Client-side Firebase authentication, Firestore database, and storage
- **Responsive Design**: Mobile-first CSS with custom design system using CSS variables
- **Module System**: ES6 modules for code organization (firebase.js, app.js, profile_lock.js, etc.)

## Backend Architecture
- **Hybrid Deployment**: 
  - Vercel serverless functions for payment processing and form submissions
  - Express.js server (server.js) for development and additional endpoints
  - Firebase hosting for static assets
- **Authentication**: Firebase Auth with profile completion enforcement
- **CORS Configuration**: JSON-based CORS settings supporting multiple deployment environments

## Data Storage
- **Firebase Firestore**: Primary database for users, chat messages, rooms, live streams, badges, and reviews
- **Firebase Storage**: User profile photos and media uploads
- **Security Rules**: Comprehensive Firestore rules with user ownership validation and access controls
- **Real-time Features**: Firestore listeners for live chat, streaming, and notifications

## Key Features Architecture
- **Profile System**: Multi-step profile creation with photo uploads and completion validation
- **Chat System**: Real-time messaging with multiple themed rooms and user presence
- **Live Streaming**: WebRTC peer-to-peer video streaming with Firebase signaling
- **Gamification**: Badge system and red flags with completion tracking
- **Payment Integration**: Square payment processing for donations and premium features
- **User Reviews**: Community-driven feedback system for dating experiences

## Authentication & Authorization
- **Firebase Authentication**: Email/password authentication with profile completion gates
- **Profile Gating**: Utility system ensuring users complete profiles before accessing features
- **Role-based Access**: Firestore security rules based on user ownership and authentication state
- **Session Management**: Firebase Auth state persistence across page navigation

# External Dependencies

## Core Services
- **Firebase Suite**: Authentication, Firestore database, Storage, and Hosting
- **Vercel**: Serverless function hosting and deployment platform
- **Square API**: Payment processing for donations and premium features

## Development Stack
- **Node.js & Express**: Development server and API endpoints
- **ES6 Modules**: Modern JavaScript module system for frontend code
- **CORS**: Cross-origin resource sharing for multi-domain deployment

## Third-party Integrations
- **WebRTC**: Browser-based real-time communication for live streaming
- **Google STUN Servers**: ICE servers for WebRTC peer connection establishment
- **Bcrypt.js**: Password hashing for additional security layers
- **Mongoose**: MongoDB object modeling (backend models for potential future use)

## CDN & External Resources
- **Firebase CDN**: Firebase SDK delivery via Google's CDN
- **System Fonts**: Native font stack for performance (Inter, system-ui, Segoe UI, Roboto, Arial)