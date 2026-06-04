# Secure Offline Facial Authentication System

A modern, enterprise-grade mobile application for offline facial authentication designed for highway field workers. Built with React Native (Expo), featuring a complete authentication flow with simulated face recognition and liveness detection.

## Design Features

### Color Palette
- **Primary**: Pastel Blue (#AFCBFF)
- **Secondary**: Soft Blue (#7EA7FF)
- **Background**: Off White (#F8FAFC)
- **Surface**: Light Gray (#EAEFF5)
- **Text**: Dark Navy (#1E2A3A)
- **Success**: Pastel Green (#A5D6A7)
- **Error**: Pastel Red (#EF9A9A)

### Design Language
- Modern enterprise UI with compact layouts
- Subtle 8px corner radius throughout
- Minimal soft shadows for depth
- Clean flat cards without glassmorphism
- Smooth animations and micro-interactions
- Fully responsive for all mobile screen sizes

## App Screens

### Authentication Flow
1. **Splash Screen** - Animated logo with smooth fade-in
2. **Login Screen** - Employee ID + password authentication
3. **Face Check** - Enrollment status verification
4. **Face Enrollment** - 5-step guided face capture with liveness detection
5. **Face Authentication** - 3 liveness challenges (blink, turn, smile)
6. **Success/Failure** - Authentication result screens

### Main App (Tab Navigation)
1. **Home Dashboard**
   - Welcome header with profile card
   - Authentication status
   - Last sync status
   - Quick actions (Verify, Sync, Logs, Attendance)
   - Recent activity timeline

2. **Attendance Screen**
   - Monthly calendar view
   - Weekly grouped attendance cards
   - Present/Absent indicators
   - Check-in/check-out times
   - Total working hours per day
   - Monthly summary statistics

3. **Logs Screen**
   - Activity logs with timestamps
   - Sync status indicators
   - Success/failure badges
   - Offline queue count

4. **Settings Screen**
   - Profile information
   - Device info and offline storage status
   - Face re-enrollment option
   - Cache management
   - Logout functionality

### Additional Screens
- **Sync Screen** - AWS sync progress with data purge
- **Offline indicators** - Throughout the app

## Features

### Core Functionality
**Simulated Face Recognition** - Mock enrollment and authentication
**Liveness Detection** - Blink, head movement, and smile challenges
**Offline-First** - All data stored locally using AsyncStorage
**Auto-Attendance** - Marks attendance on successful authentication
**Activity Logging** - Tracks all authentication events
**Sync Capability** - UI for AWS sync (mock implementation)

### Technical Features
- **State Management**: Zustand for global state
- **Local Storage**: AsyncStorage for offline data
- **Navigation**: Expo Router with file-based routing
- **Animations**: React Native Reanimated for smooth transitions
- **Date Handling**: date-fns for all date operations
- **Type Safety**: TypeScript throughout

## Project Structure

```
app/frontend/
├── app/
│   ├── (auth)/
│   │   ├── _layout.tsx         # Auth layout
│   │   └── login.tsx           # Login screen
│   ├── (tabs)/
│   │   ├── _layout.tsx         # Tab navigation
│   │   ├── index.tsx           # Home dashboard
│   │   ├── attendance.tsx      # Attendance calendar
│   │   ├── logs.tsx            # Activity logs
│   │   └── settings.tsx        # Settings
│   ├── _layout.tsx             # Root layout
│   ├── splash.tsx              # Splash screen
│   ├── face-check.tsx          # Face enrollment check
│   ├── face-enroll.tsx         # Face enrollment
│   ├── face-auth.tsx           # Face authentication
│   ├── auth-success.tsx        # Success screen
│   ├── auth-failure.tsx        # Failure screen
│   └── sync.tsx                # Sync screen
├── src/
│   ├── components/
│   │   ├── Button.tsx          # Reusable button
│   │   ├── Card.tsx            # Card component
│   │   ├── Input.tsx           # Input with validation
│   │   └── StatusChip.tsx      # Status indicator
│   ├── store/
│   │   ├── authStore.ts        # Auth state management
│   │   └── attendanceStore.ts  # Attendance & logs
│   ├── theme/
│   │   └── colors.ts           # Design system
│   └── utils/
│       └── storage/            # Storage abstraction
├── app.json                    # Expo configuration
├── package.json                # Dependencies
└── tsconfig.json               # TypeScript config
```

## Installation & Setup

### Prerequisites
- Node.js 18+
- Yarn
- Expo CLI

### Install Dependencies
```bash
cd /app/frontend
yarn install
```

### Environment Variables
Already configured in `.env`:
- `EXPO_PUBLIC_BACKEND_URL` - Backend API URL
- `EXPO_PACKAGER_HOSTNAME` - Preview hostname
- `EXPO_PACKAGER_PROXY_URL` - Proxy URL

### Run the App
```bash
yarn start
```

## 🧪 Testing Credentials

### Login
- **Employee ID**: Any value (e.g., \"EMP001\", \"FIELD123\")
- **Password**: `demo123`

### Test Flow
1. Login with credentials above
2. Complete 5-step face enrollment (all simulated)
3. Authenticate with 3 liveness challenges
4. View auto-marked attendance
5. Check logs and sync status
6. Explore attendance calendar

## Data Models

### User
```typescript
{
  id: string
  employeeId: string
  name: string
  department: string
  faceEnrolled: boolean
}
```

### Attendance Record
```typescript
{
  id: string
  userId: string
  date: string (YYYY-MM-DD)
  checkIn: string (HH:mm:ss)
  checkOut: string | null
  status: 'present' | 'absent'
  workingHours: number
  synced: boolean
}
```

### Auth Log
```typescript
{
  id: string
  userId: string
  timestamp: string (ISO)
  type: 'face_auth' | 'login' | 'enrollment'
  status: 'success' | 'failed'
  synced: boolean
}
```

## Key Highlights

### UX Excellence
- **Thumb-friendly UI** - All important actions within reach
- **Smooth animations** - Spring animations and micro-interactions
- **Loading states** - Clear feedback for all async operations
- **Error handling** - User-friendly error messages
- **Offline indicators** - Always visible connectivity status

### Performance
- **Optimized bundle** - Code splitting with Expo Router
- **Efficient animations** - Native driver for 60fps
- **Smart caching** - Local storage for offline capability
- **Fast navigation** - File-based routing for instant transitions

### Accessibility
- **High contrast** - WCAG compliant color combinations
- **Touch targets** - Minimum 44x44pt for all interactive elements
- **Clear labels** - Descriptive text for all actions
- **Keyboard handling** - Proper KeyboardAvoidingView usage

## Future Enhancements

### Planned Features
- [ ] Real face recognition integration (TensorFlow Lite/MediaPipe)
- [ ] Actual AWS sync implementation
- [ ] Push notifications for attendance reminders
- [ ] Biometric device authentication (fingerprint/Face ID)
- [ ] Advanced analytics dashboard
- [ ] Offline maps integration
- [ ] Team collaboration features

### Technical Improvements
- [ ] E2E testing with Detox
- [ ] CI/CD pipeline
- [ ] Performance monitoring
- [ ] Crash reporting
- [ ] A/B testing framework

## Notes

- **Face Detection**: Currently simulated - ready for real ML integration
- **AWS Sync**: UI complete - needs backend integration
- **Backend**: Not required for current demo (all client-side)
- **Platform**: Tested on iOS, Android, and Web

## License

Proprietary - Internal use only

## Support

For issues or questions, contact the development team.
ishasolanki0225@gmail.com

---

