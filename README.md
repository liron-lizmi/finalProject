# PlanIt - Event Planning & Management Platform

A comprehensive full-stack web application for planning and managing events. From guest lists to seating arrangements, budget tracking to vendor coordination - PlanIt helps you organize every aspect of your event in one place.

## Features

### Event Management
- Create and manage multiple events (weddings, birthdays, corporate events, conferences, parties)
- Share events with collaborators with customizable permission levels (view/edit)
- Real-time notifications for shared events

### Guest Management
- Add, edit, and organize guests with group categorization
- Track RSVP status (pending, confirmed, declined)
- Import guests from multiple sources:
  - CSV/Excel files
  - Google Contacts
  - VCF (vCard) files
- Public RSVP page for easy guest responses
- Gift tracking 

### Smart Seating Arrangements
- Visual drag-and-drop seating layout designer
- Support for multiple table types (round, rectangular, square)
- AI-powered automatic seating generation with customizable preferences:
  - Keep groups together
  - Balance table sizes
  - Handle special seating requests
  - Separated seating support (male/female)
- Auto-sync with guest list changes
- Export seating charts to PDF

### Budget Management
- Set total budget with category allocation
- Track expenses by category (venue, catering, photography, music, decoration, etc.)
- Record income from gifts and other sources
- Budget alerts when approaching spending thresholds
- Export to Excel/PDF

### Vendor & Venue Coordination
- Search vendors and venues using Google Places integration
- Filter by category and location
- Save and manage vendor contacts for each event

### Task Management & Calendar
- Create tasks with priorities and due dates
- Categorize tasks by type
- Set reminders with recurrence options
- Sync with Google Calendar

### Ride Sharing
- Public ride coordination page
- Guests can offer or request rides
- Track seat availability and departure times

### Multi-Language Support
- Full internationalization (English & Hebrew)
- RTL layout support

## Tech Stack

### Frontend
- **React 18** - UI framework
- **React Router** - Client-side routing
- **Axios** - HTTP client
- **i18next** - Internationalization
- **Google Maps API** - Location services

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MongoDB** - Database
- **Mongoose** - ODM
- **JWT** - Authentication
- **bcryptjs** - Password hashing

### Integrations
- **Google OAuth 2.0** - Social authentication
- **Google Calendar API** - Calendar sync
- **Google Contacts API** - Contact import
- **Google Places API** - Venue/vendor search
- **EmailJS** - Email notifications

## Live Demo

Check out the live application: [PlanIt](https://planit-frontend-uf6v.onrender.com)
    
@All rights reserved
