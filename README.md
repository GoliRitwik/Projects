# Student Management System (SMS)

A complete full-stack Student Management System with a modern, responsive frontend and a robust Node.js backend with MySQL database.

## Features

### Frontend
-  **Authentication System** - Login/Register with JWT tokens
-  **User Management** - User info display and logout functionality
-  **Protected Routes** - All student operations require authentication
-  Clean, responsive design with modern UI
-  Add new students with form validation
-  View all students in a sortable table
-  Edit existing students inline
-  Delete students with confirmation
-  Search students by name
-  Real-time feedback with success/error messages
-  Loading states and smooth animations
-  Mobile-responsive design

### Backend
-  **JWT Authentication** - Secure token-based authentication
-  **User Registration & Login** - Complete auth system
-  **Password Hashing** - bcrypt for secure password storage
-  **Route Protection** - Middleware to protect student routes
-  RESTful API with Express.js
-  MySQL database integration
-  Full CRUD operations
-  Input validation and error handling
-  Search functionality
-  CORS enabled for frontend communication
-  Environment configuration

## Prerequisites

Before running the application, make sure you have:

1. **Node.js** (v14 or higher) - [Download here](https://nodejs.org/)
2. **MySQL** (v8.0 or higher) - [Download here](https://dev.mysql.com/downloads/)
3. **Git** (optional) - [Download here](https://git-scm.com/)

## Installation & Setup

### 1. Clone or Download the Project
```bash
# If using Git
git clone <repository-url>
cd student-management-system

# Or simply download and extract the project files
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Database Setup

#### Create MySQL Database
1. Open MySQL command line or MySQL Workbench
2. Run the following SQL commands:

```sql
-- Create the database
CREATE DATABASE student_db;

-- Use the database
USE student_db;

-- Create the students table (this will be created automatically by the app)
CREATE TABLE IF NOT EXISTS students (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    age INT NOT NULL,
    course VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

#### Configure Database Connection
1. Open `config.env` file
2. Update the database credentials:

```env
DB_HOST=localhost
DB_USER=your_mysql_username
DB_PASSWORD=your_mysql_password
DB_NAME=student_db
PORT=3000
JWT_SECRET=your-super-secret-jwt-key-change-in-production
```

**Important:** 
- Replace `your_mysql_username` and `your_mysql_password` with your actual MySQL credentials
- Change the `JWT_SECRET` to a secure random string for production use

### 4. Start the Application

#### Development Mode (with auto-restart)
```bash
npm run dev
```

#### Production Mode
```bash
npm start
```

### 5. Access the Application
Open your web browser and navigate to:
```
http://localhost:3000
```

**Default Login Credentials:**
- **Username:** admin
- **Password:** admin123

The application will automatically redirect you to the login page if you're not authenticated.

## API Endpoints

The backend provides the following REST API endpoints:

### Authentication Endpoints
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/auth/register` | Register new user | No |
| POST | `/auth/login` | Login user | No |
| GET | `/auth/verify` | Verify JWT token | Yes |

### Student Management Endpoints (All require authentication)
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/students` | Get all students | Yes |
| GET | `/students/:id` | Get student by ID | Yes |
| GET | `/students/search/:name` | Search students by name | Yes |
| POST | `/students` | Add new student | Yes |
| PUT | `/students/:id` | Update student | Yes |
| DELETE | `/students/:id` | Delete student | Yes |

### Example API Usage

#### Register New User
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "newuser",
    "email": "user@example.com",
    "password": "password123"
  }'
```

#### Login User
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "admin123"
  }'
```

#### Get All Students (with authentication)
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:3000/students
```

#### Add New Student (with authentication)
```bash
curl -X POST http://localhost:3000/students \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "name": "John Doe",
    "age": 22,
    "course": "Computer Science",
    "email": "john.doe@example.com"
  }'
```

#### Search Students (with authentication)
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:3000/students/search/John
```

## Project Structure

```
student-management-system/
├── public/                 # Frontend files
│   ├── index.html         # Main application page
│   ├── login.html         # Login/Register page
│   ├── styles.css         # CSS styles
│   ├── script.js          # Main app JavaScript
│   └── auth.js            # Authentication JavaScript
├── server.js              # Backend server
├── package.json           # Node.js dependencies
├── config.env             # Environment configuration
├── database-setup.sql     # Database initialization script
└── README.md              # This file

## SQLite fallback (easy local testing)

If you don't have MySQL installed or prefer to run a local demo, the server includes a SQLite fallback.

- To run in SQLite mode set either `DB_USE_SQLITE=true` in `config.env` or leave `DB_PASSWORD` blank — the app will automatically fall back to a local SQLite database file at `data/demo.db`.
- The server will create the tables and a default admin user (username: `admin`, password: `admin123`) when started the first time.

Example `config.env` for SQLite mode:

```env
DB_USE_SQLITE=true
PORT=3000
JWT_SECRET=replace-with-a-secure-key
```

This makes it simple to run the application locally without installing a separate database server.

## Offline PDF generation fallback

Invoice PDF generation in the browser uses jsPDF. The app attempts to load a local vendor copy first (`/vendor/jspdf.umd.min.js`) and falls back to a CDN.

- For fully offline PDF generation, download the UMD build of jsPDF and place it at `public/vendor/jspdf.umd.min.js`.
- If the browser blocks the CDN or can't load external scripts, you will see a friendly message and can use the CSV export as an alternative.

Example: download from https://github.com/parallax/jsPDF/releases and save the UMD file in `public/vendor`.
```

## Technologies Used

### Frontend
- **HTML5** - Semantic markup
- **CSS3** - Modern styling with gradients and animations
- **Vanilla JavaScript** - No frameworks, pure ES6+
- **Font Awesome** - Icons
- **Fetch API** - HTTP requests

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MySQL2** - Database driver
- **JWT** - JSON Web Tokens for authentication
- **bcryptjs** - Password hashing
- **CORS** - Cross-origin resource sharing
- **dotenv** - Environment variables

## Features in Detail

### Authentication System
- **JWT Token-based Authentication** - Secure, stateless authentication
- **User Registration & Login** - Complete user management
- **Password Security** - bcrypt hashing with salt rounds
- **Session Management** - Remember me functionality
- **Route Protection** - All student operations require authentication
- **Auto-logout** - Session expiration handling

### Form Validation
- Required field validation
- Email format validation
- Age range validation (1-150)
- Duplicate email prevention
- Password strength requirements
- Username uniqueness validation

### User Experience
- **Login/Register Interface** - Clean, tabbed authentication forms
- **User Info Display** - Shows current user and role in header
- **Logout Functionality** - Secure session termination
- Real-time form validation
- Loading spinners during API calls
- Success/error message notifications
- Confirmation dialogs for destructive actions
- Responsive design for all screen sizes
- Smooth animations and hover effects

### Data Management
- **Protected API Calls** - All requests include JWT tokens
- Automatic table refresh after operations
- Search functionality with real-time results
- Edit mode with form pre-population
- Student count display
- Empty state handling
- **Session Persistence** - Maintains login state across browser sessions

## Troubleshooting

### Common Issues

#### 1. Database Connection Error
```
Error: connect ECONNREFUSED 127.0.0.1:3306
```
**Solution:** Make sure MySQL is running and check your database credentials in `config.env`.

#### 2. Port Already in Use
```
Error: listen EADDRINUSE: address already in use :::3000
```
**Solution:** Either stop the process using port 3000 or change the PORT in `config.env`.

#### 3. CORS Error
```
Access to fetch at 'http://localhost:3000/students' from origin 'http://localhost:3000' has been blocked by CORS policy
```
**Solution:** The CORS middleware is already configured. Make sure you're accessing the app through the server (http://localhost:3000) not directly opening the HTML file.

#### 4. Module Not Found
```
Error: Cannot find module 'express'
```
**Solution:** Run `npm install` to install all dependencies.

### Database Issues

#### Reset Database
If you need to reset the database:
```sql
DROP DATABASE student_db;
CREATE DATABASE student_db;
```

#### Check Database Connection
You can test the database connection by running:
```bash
node -e "
const mysql = require('mysql2');
const db = mysql.createConnection({
  host: 'localhost',
  user: 'your_username',
  password: 'your_password',
  database: 'student_db'
});
db.connect((err) => {
  if (err) console.error('Connection failed:', err);
  else console.log('Database connected successfully');
  process.exit();
});
"
```

## Development

### Adding New Features
1. Backend: Add new routes in `server.js`
2. Frontend: Update `script.js` for new functionality
3. Styling: Modify `styles.css` for UI changes

### Code Structure
- **server.js**: Contains all backend logic, routes, and database operations
- **script.js**: Frontend JavaScript with class-based architecture
- **styles.css**: Modern CSS with responsive design and animations

## License

This project is open source and available under the [MIT License](LICENSE).

## Support

If you encounter any issues or have questions:
1. Check the troubleshooting section above
2. Verify your MySQL installation and credentials
3. Ensure all dependencies are installed correctly
4. Check the browser console for any JavaScript errors

---

**Happy Coding! 🎓**
