const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const QRCode = require('qrcode');
const PDFDocument = require('pdfkit');
require('dotenv').config({ path: './config.env' });

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Ensure student_photos directory exists
const photosDir = path.join(__dirname, 'public', 'student_photos');
if (!fs.existsSync(photosDir)) {
  fs.mkdirSync(photosDir, { recursive: true });
}

// Configure multer for photo uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, photosDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `student-${req.params.id}-${uniqueSuffix}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  
  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error('Only JPG and PNG images are allowed'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: fileFilter
});

// Database connection pool
const db = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'student_db',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  multipleStatements: true
});

// Test database connection
db.getConnection((err, connection) => {
  if (err) {
    console.error('Database connection failed:', err);
    process.exit(1);
  }
  console.log('Connected to MySQL database');
  connection.release();
});

// Create tables if they don't exist (MySQL schema)
const createTablesQuery = `
  CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('admin', 'user') DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  );
  
  CREATE TABLE IF NOT EXISTS students (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    age INT NOT NULL,
    course VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    photo VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  );
  
  CREATE TABLE IF NOT EXISTS attendance (
    id INT PRIMARY KEY AUTO_INCREMENT,
    student_id INT NOT NULL,
    \`date\` DATE NOT NULL,
    status ENUM('present','absent','late') NOT NULL DEFAULT 'present',
    notes VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS results (
    id INT PRIMARY KEY AUTO_INCREMENT,
    student_id INT NOT NULL,
    subject VARCHAR(255) NOT NULL,
    term VARCHAR(100) DEFAULT 'Term 1',
    marks INT NOT NULL,
    grade VARCHAR(10),
    remarks VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS fees (
    id INT PRIMARY KEY AUTO_INCREMENT,
    student_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    due_date DATE NOT NULL,
    status ENUM('pending','paid','overdue') DEFAULT 'pending',
    description VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS payments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    fee_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    method VARCHAR(100) DEFAULT 'cash',
    paid_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`;
// Helper Functions

// Email validation - must be Gmail
function isGmailEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.toLowerCase().endsWith('@gmail.com');
}

// Async database query helper
function queryAsync(query, params = []) {
  return new Promise((resolve, reject) => {
    db.query(query, params, (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });
}

// Allowed attendance statuses
const allowedAttendanceStatuses = ['present', 'absent', 'late'];

// Calculate grade from marks
function calculateGradeFromMarks(marks) {
  if (marks >= 85) return 'A';
  if (marks >= 70) return 'B';
  if (marks >= 55) return 'C';
  if (marks >= 40) return 'D';
  return 'F';
}

// Determine fee status based on due date and balance
function determineFeeStatus(dueDate, balance, amount) {
  if (balance <= 0) return 'paid';
  // Only mark as overdue if amount is greater than 100000
  if (amount > 100000) {
    const due = new Date(dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    if (due < today) return 'overdue';
  }
  return 'pending';
}

// Enrich invoices with calculated fields
function enrichInvoices(invoices) {
  return invoices.map(invoice => {
    const paidTotal = parseFloat(invoice.paid_total || 0);
    const amount = parseFloat(invoice.amount || 0);
    const balance = Math.max(amount - paidTotal, 0);
    const dueDate = invoice.due_date ? new Date(invoice.due_date) : null;
    
    // Properly compute status: paid first, then overdue (only if amount > 100000), then pending
    let status;
    if (paidTotal >= amount) {
      status = 'paid';
    } else if (amount > 100000 && dueDate) {
      // Only mark as overdue if amount is greater than 100000
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      dueDate.setHours(0, 0, 0, 0);
      if (dueDate < today) {
        status = 'overdue';
      } else {
        status = 'pending';
      }
    } else {
      status = 'pending';
    }
    
    return {
      ...invoice,
      paid_total: paidTotal,
      balance: balance,
      status: status
    };
  });
}

// No sqlite fallback: this server uses MySQL (student_db) only

// Initialize MySQL tables
db.query(createTablesQuery, (err) => {
  if (err) {
    console.error('Error creating tables:', err);
  } else {
    console.log('Database tables ready');

    db.query('SELECT COUNT(*) as count FROM users', (err, results) => {
      if (!err && results[0].count === 0) {
        const hashedPassword = bcrypt.hashSync('admin123', 10);
        db.query('INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)', ['admin', 'admin@sms.com', hashedPassword, 'admin'], (err) => {
          if (err) console.error('Error creating default admin:', err);
          else console.log('Default admin user created: username=admin, password=admin123');
        });
      }
    });
  }
});

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ success: false, message: 'Invalid or expired token' });
    req.user = user;
    next();
  });
};

// Routes

// Authentication Routes

// POST /auth/register - Register new user
app.post('/auth/register', async (req, res) => {
  const { username, email, password } = req.body;
  
  // Validation
  if (!username || !email || !password) {
    return res.status(400).json({ 
      success: false, 
      message: 'Username, email, and password are required' 
    });
  }
  
  if (password.length < 6) {
    return res.status(400).json({ 
      success: false, 
      message: 'Password must be at least 6 characters long' 
    });
  }
  
  if (!isGmailEmail(email)) {
    return res.status(400).json({ 
      success: false, 
      message: 'Please provide a valid gmail.com address' 
    });
  }
  
  try {
    // Check if user already exists
    const existingUser = await new Promise((resolve, reject) => {
      db.query('SELECT * FROM users WHERE username = ? OR email = ?', [username, email], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    if (existingUser.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Username or email already exists' 
      });
    }
    
    // Hash password
    const hashedPassword = bcrypt.hashSync(password, 10);
    
    // Insert new user
    const result = await new Promise((resolve, reject) => {
      db.query(
        'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
        [username, email, hashedPassword],
        (err, results) => {
          if (err) reject(err);
          else resolve(results);
        }
      );
    });
    
    // Generate JWT token
    const token = jwt.sign(
      { id: result.insertId, username, email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.status(201).json({ 
      success: true, 
      message: 'User registered successfully',
      token,
      user: { id: result.insertId, username, email }
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error registering user',
      error: error.message 
    });
  }
});

// POST /auth/login - Login user
app.post('/auth/login', async (req, res) => {
  const { username, password } = req.body;
  
  // Validation
  if (!username || !password) {
    return res.status(400).json({ 
      success: false, 
      message: 'Username and password are required' 
    });
  }
  
  try {
    // Find user
    const users = await new Promise((resolve, reject) => {
      db.query('SELECT * FROM users WHERE username = ? OR email = ?', [username, username], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    if (users.length === 0) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid username or password' 
      });
    }
    
    const user = users[0];
    
    // Verify password
    const isValidPassword = bcrypt.compareSync(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid username or password' 
      });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.json({ 
      success: true, 
      message: 'Login successful',
      token,
      user: { id: user.id, username: user.username, email: user.email, role: user.role }
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error during login',
      error: error.message 
    });
  }
});

// GET /auth/verify - Verify token
app.get('/auth/verify', authenticateToken, (req, res) => {
  res.json({ 
    success: true, 
    message: 'Token is valid',
    user: req.user 
  });
});

// --- Analytics Routes ---
app.get('/analytics/insights', authenticateToken, async (req, res) => {
  try {
    const [students, attendanceRows, resultRows] = await Promise.all([
      queryAsync('SELECT id, name, course FROM students ORDER BY name'),
      queryAsync('SELECT student_id, status FROM attendance'),
      queryAsync('SELECT student_id, subject, term, marks, created_at FROM results')
    ]);

    const attendanceStats = {};
    attendanceRows.forEach((row) => {
      if (!row.student_id) return;
      if (!attendanceStats[row.student_id]) {
        attendanceStats[row.student_id] = { present: 0, total: 0 };
      }
      attendanceStats[row.student_id].total += 1;
      if (row.status === 'present') {
        attendanceStats[row.student_id].present += 1;
      }
    });

    const latestMarksMap = {};
    resultRows.forEach((row) => {
      if (!row.student_id) return;
      const markValue = Number(row.marks) || 0;
      const createdAt = row.created_at ? new Date(row.created_at) : new Date();
      const existing = latestMarksMap[row.student_id];
      if (!existing || createdAt > existing.date) {
        latestMarksMap[row.student_id] = { date: createdAt, marks: [markValue] };
      } else if (existing && createdAt.getTime() === existing.date.getTime()) {
        existing.marks.push(markValue);
      }
    });

    const atRiskStudents = students.map((student) => {
      const attendance = attendanceStats[student.id];
      const attendancePercent = attendance && attendance.total
        ? Number(((attendance.present / attendance.total) * 100).toFixed(1))
        : null;

      const latestExam = latestMarksMap[student.id];
      const latestAverage = latestExam
        ? Number((latestExam.marks.reduce((sum, mark) => sum + mark, 0) / latestExam.marks.length).toFixed(1))
        : null;

      if (
        attendancePercent !== null &&
        attendancePercent < 75 &&
        latestAverage !== null &&
        latestAverage < 40
      ) {
        return {
          id: student.id,
          name: student.name,
          course: student.course,
          attendancePercent,
          latestAverage
        };
      }
      return null;
    }).filter(Boolean);

    const subjectSet = new Set();
    const termSet = new Set();
    const comboAverages = {};

    resultRows.forEach((row) => {
      const subject = row.subject || 'General';
      const term = row.term || 'Term';
      subjectSet.add(subject);
      termSet.add(term);
      const key = `${term}@@${subject}`;
      if (!comboAverages[key]) {
        comboAverages[key] = { total: 0, count: 0 };
      }
      comboAverages[key].total += Number(row.marks) || 0;
      comboAverages[key].count += 1;
    });

    const subjects = Array.from(subjectSet).sort((a, b) => a.localeCompare(b));
    const terms = Array.from(termSet).sort((a, b) => a.localeCompare(b));
    const heatmapValues = terms.map((term) =>
      subjects.map((subject) => {
        const entry = comboAverages[`${term}@@${subject}`];
        return entry ? Number((entry.total / entry.count).toFixed(1)) : null;
      })
    );

    res.json({
      success: true,
      data: {
        atRiskStudents,
        heatmap: {
          subjects,
          terms,
          values: heatmapValues
        }
      }
    });
  } catch (error) {
    console.error('Analytics insights error:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to load insights',
      error: error.message
    });
  }
});

// Student Routes (Protected)

// GET /students - Get all students
app.get('/students', authenticateToken, (req, res) => {
  const query = 'SELECT * FROM students ORDER BY created_at DESC';
  
  db.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching students:', err);
      return res.status(500).json({ 
        success: false, 
        message: 'Error fetching students',
        error: err.message 
      });
    }
    
    res.json({ 
      success: true, 
      data: results,
      count: results.length 
    });
  });
});

// GET /students/:id - Get student by ID
app.get('/students/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const query = 'SELECT * FROM students WHERE id = ?';
  
  db.query(query, [id], (err, results) => {
    if (err) {
      console.error('Error fetching student:', err);
      return res.status(500).json({ 
        success: false, 
        message: 'Error fetching student',
        error: err.message 
      });
    }
    
    if (results.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Student not found' 
      });
    }
    
    res.json({ 
      success: true, 
      data: results[0] 
    });
  });
});

// GET /students/search/:name - Search students by name
app.get('/students/search/:name', authenticateToken, (req, res) => {
  const { name } = req.params;
  const query = 'SELECT * FROM students WHERE name LIKE ? ORDER BY name';
  const searchTerm = `%${name}%`;
  
  db.query(query, [searchTerm], (err, results) => {
    if (err) {
      console.error('Error searching students:', err);
      return res.status(500).json({ 
        success: false, 
        message: 'Error searching students',
        error: err.message 
      });
    }
    
    res.json({ 
      success: true, 
      data: results,
      count: results.length,
      searchTerm: name 
    });
  });
});

// POST /students - Add new student
app.post('/students', authenticateToken, (req, res) => {
  const { name, age, course, email } = req.body;
  
  // Validation
  if (!name || !age || !course || !email) {
    return res.status(400).json({ 
      success: false, 
      message: 'All fields (name, age, course, email) are required' 
    });
  }
  
  if (age < 1 || age > 150) {
    return res.status(400).json({ 
      success: false, 
      message: 'Age must be between 1 and 150' 
    });
  }
  
  if (!isGmailEmail(email)) {
    return res.status(400).json({ 
      success: false, 
      message: 'Please provide a valid gmail.com address' 
    });
  }
  
  const query = 'INSERT INTO students (name, age, course, email) VALUES (?, ?, ?, ?)';
  
  db.query(query, [name, age, course, email], (err, results) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ 
          success: false, 
          message: 'Email already exists' 
        });
      }
      console.error('Error adding student:', err);
      return res.status(500).json({ 
        success: false, 
        message: 'Error adding student',
        error: err.message 
      });
    }
    
    res.status(201).json({ 
      success: true, 
      message: 'Student added successfully',
      data: { id: results.insertId, name, age, course, email }
    });
  });
});

// PUT /students/:id - Update student
app.put('/students/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { name, age, course, email } = req.body;
  
  // Validation
  if (!name || !age || !course || !email) {
    return res.status(400).json({ 
      success: false, 
      message: 'All fields (name, age, course, email) are required' 
    });
  }
  
  if (age < 1 || age > 150) {
    return res.status(400).json({ 
      success: false, 
      message: 'Age must be between 1 and 150' 
    });
  }
  
  if (!isGmailEmail(email)) {
    return res.status(400).json({ 
      success: false, 
      message: 'Please provide a valid gmail.com address' 
    });
  }
  
  const query = 'UPDATE students SET name = ?, age = ?, course = ?, email = ? WHERE id = ?';
  
  db.query(query, [name, age, course, email, id], (err, results) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ 
          success: false, 
          message: 'Email already exists' 
        });
      }
      console.error('Error updating student:', err);
      return res.status(500).json({ 
        success: false, 
        message: 'Error updating student',
        error: err.message 
      });
    }
    
    if (results.affectedRows === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Student not found' 
      });
    }
    
    res.json({ 
      success: true, 
      message: 'Student updated successfully',
      data: { id, name, age, course, email }
    });
  });
});

// POST /students/upload-photo/:id - Upload student photo
app.post('/students/upload-photo/:id', authenticateToken, upload.single('photo'), (req, res) => {
  const { id } = req.params;
  
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }
  
  const photoPath = `student_photos/${req.file.filename}`;
  
  // Get old photo to delete it
  const getOldPhotoQuery = 'SELECT photo FROM students WHERE id = ?';
  db.query(getOldPhotoQuery, [id], (err, oldResults) => {
    if (err) {
      fs.unlinkSync(req.file.path);
      console.error('Error fetching old photo:', err);
      return res.status(500).json({ 
        success: false, 
        message: 'Error updating student photo',
        error: err.message 
      });
    }
    
    if (oldResults.length === 0) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ 
        success: false, 
        message: 'Student not found' 
      });
    }
    
    // Delete old photo file if exists
    if (oldResults[0].photo) {
      const oldPhotoPath = path.join(__dirname, 'public', oldResults[0].photo);
      if (fs.existsSync(oldPhotoPath)) {
        fs.unlinkSync(oldPhotoPath);
      }
    }
    
    // Update student record with new photo path
    const updateQuery = 'UPDATE students SET photo = ? WHERE id = ?';
    db.query(updateQuery, [photoPath, id], (err, results) => {
      if (err) {
        // Delete uploaded file if database update fails
        fs.unlinkSync(req.file.path);
        console.error('Error updating student photo:', err);
        return res.status(500).json({ 
          success: false, 
          message: 'Error updating student photo',
          error: err.message 
        });
      }
      
      res.json({ 
        success: true, 
        message: 'Photo uploaded successfully',
        photo: photoPath
      });
    });
  });
});

// GET /students/:id/id-card - Generate student ID card PDF
app.get('/students/:id/id-card', authenticateToken, async (req, res) => {
  const { id } = req.params;
  
  const query = 'SELECT * FROM students WHERE id = ?';
  db.query(query, [id], async (err, results) => {
    if (err) {
      console.error('Error fetching student:', err);
      return res.status(500).json({ 
        success: false, 
        message: 'Error fetching student',
        error: err.message 
      });
    }
    
    if (results.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Student not found' 
      });
    }
    
    const student = results[0];
    
    try {
      // Generate QR code
      const qrUrl = `http://localhost:${process.env.PORT || 3000}/student/${student.id}`;
      const qrCodeDataURL = await QRCode.toDataURL(qrUrl, {
        width: 150,
        margin: 2
      });
      
      // Create PDF
      const doc = new PDFDocument({
        size: [400, 250], // ID card size
        margin: 20
      });
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="id-card-${student.id}.pdf"`);
      
      doc.pipe(res);
      
      // Draw border
      doc.rect(10, 10, 380, 230).stroke();
      
      // Photo section (left side)
      const photoX = 30;
      const photoY = 40;
      const photoSize = 100;
      
      if (student.photo) {
        const photoPath = path.join(__dirname, 'public', student.photo);
        if (fs.existsSync(photoPath)) {
          doc.image(photoPath, photoX, photoY, { width: photoSize, height: photoSize, fit: [photoSize, photoSize] });
        } else {
          // Placeholder if photo doesn't exist
          doc.rect(photoX, photoY, photoSize, photoSize).stroke();
          doc.fontSize(12).text('No Photo', photoX + 20, photoY + 40);
        }
      } else {
        // Placeholder if no photo
        doc.rect(photoX, photoY, photoSize, photoSize).stroke();
        doc.fontSize(12).text('No Photo', photoX + 20, photoY + 40);
      }
      
      // Student details (right side)
      const detailsX = 150;
      let detailsY = 50;
      
      doc.fontSize(20).font('Helvetica-Bold').text('STUDENT ID CARD', detailsX, detailsY);
      detailsY += 30;
      
      doc.fontSize(14).font('Helvetica').text(`Name: ${student.name}`, detailsX, detailsY);
      detailsY += 20;
      doc.text(`ID: ${student.id}`, detailsX, detailsY);
      detailsY += 20;
      doc.text(`Course: ${student.course}`, detailsX, detailsY);
      detailsY += 20;
      doc.fontSize(10).text(`Email: ${student.email}`, detailsX, detailsY);
      
      // QR code (bottom right)
      const qrX = 230;
      const qrY = 150;
      doc.image(qrCodeDataURL, qrX, qrY, { width: 80, height: 80 });
      
      doc.end();
    } catch (error) {
      console.error('Error generating ID card:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error generating ID card',
        error: error.message 
      });
    }
  });
});

// DELETE /students/:id - Delete student
app.delete('/students/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  
  // First get student to delete photo file
  const getQuery = 'SELECT photo FROM students WHERE id = ?';
  db.query(getQuery, [id], (err, results) => {
    if (err) {
      console.error('Error fetching student:', err);
      return res.status(500).json({ 
        success: false, 
        message: 'Error deleting student',
        error: err.message 
      });
    }
    
    if (results.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Student not found' 
      });
    }
    
    // Delete photo file if exists
    if (results[0].photo) {
      const photoPath = path.join(__dirname, 'public', results[0].photo);
      if (fs.existsSync(photoPath)) {
        fs.unlinkSync(photoPath);
      }
    }
    
    // Delete student record
    const deleteQuery = 'DELETE FROM students WHERE id = ?';
    db.query(deleteQuery, [id], (err, deleteResults) => {
      if (err) {
        console.error('Error deleting student:', err);
        return res.status(500).json({ 
          success: false, 
          message: 'Error deleting student',
          error: err.message 
        });
      }
      
      res.json({ 
        success: true, 
        message: 'Student deleted successfully' 
      });
    });
  });
});

// --- Attendance Routes ---

// GET /attendance - list all attendance records
app.get('/attendance', authenticateToken, (req, res) => {
  const query = `SELECT a.id, a.student_id, s.name as student_name, a.date, a.status, a.notes, a.created_at
                 FROM attendance a
                 LEFT JOIN students s ON s.id = a.student_id
                 ORDER BY a.date DESC, a.created_at DESC`;

  db.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching attendance:', err);
      return res.status(500).json({ success: false, message: 'Error fetching attendance', error: err.message });
    }
    res.json({ success: true, data: results, count: results.length });
  });
});

// GET /attendance/student/:id - attendance for a student
app.get('/attendance/student/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const query = `SELECT id, student_id, date, status, notes, created_at FROM attendance WHERE student_id = ? ORDER BY date DESC`;
  db.query(query, [id], (err, results) => {
    if (err) {
      console.error('Error fetching student attendance:', err);
      return res.status(500).json({ success: false, message: 'Error fetching attendance', error: err.message });
    }
    res.json({ success: true, data: results, count: results.length });
  });
});

// POST /attendance - record attendance (single or bulk)
// Single: { student_id, date, status, notes }
// Bulk: { bulk: true, date, records: [{ student_id, status, notes? }, ...] }
app.post('/attendance', authenticateToken, (req, res) => {
  console.log('Attendance request received:', {
    hasBulk: !!req.body.bulk,
    bulkValue: req.body.bulk,
    hasRecords: !!req.body.records,
    recordsType: Array.isArray(req.body.records),
    recordsLength: req.body.records ? req.body.records.length : 0
  });
  
  // Check if this is a bulk request (check both boolean true and string "true")
  const isBulk = req.body.bulk === true || req.body.bulk === 'true' || (req.body.records && Array.isArray(req.body.records) && req.body.records.length > 0);
  
  if (isBulk && Array.isArray(req.body.records) && req.body.records.length > 0) {
    const { date, records } = req.body;
    
    if (!date) {
      return res.status(400).json({ success: false, message: 'date is required for bulk attendance' });
    }
    
    if (!records || records.length === 0) {
      return res.status(400).json({ success: false, message: 'records array is required and must not be empty' });
    }

    // Validate all records
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      if (!record.student_id && record.student_id !== 0) {
        return res.status(400).json({ success: false, message: `Record ${i + 1}: student_id is required` });
      }
      if (!record.status) {
        return res.status(400).json({ success: false, message: `Record ${i + 1}: status is required` });
      }
      if (!allowedAttendanceStatuses.includes(record.status)) {
        return res.status(400).json({ success: false, message: `Record ${i + 1}: Invalid attendance status: ${record.status}` });
      }
    }

    // Insert all records
    const values = records.map(record => [
      parseInt(record.student_id), 
      date, 
      record.status, 
      record.notes || null
    ]);
    
    const query = 'INSERT INTO attendance (student_id, `date`, status, notes) VALUES ?';
    
    db.query(query, [values], (err, result) => {
      if (err) {
        console.error('Error recording bulk attendance:', err);
        return res.status(500).json({ success: false, message: 'Error recording bulk attendance', error: err.message });
      }
      res.status(201).json({ 
        success: true, 
        message: `Attendance recorded for ${records.length} student(s)`, 
        count: records.length,
        insertedIds: Array.from({ length: records.length }, (_, i) => result.insertId + i)
      });
    });
    return;
  }

  // Single attendance record (existing functionality)
  const { student_id, date, status, notes } = req.body;
  if (!student_id || !date || !status) {
    return res.status(400).json({ success: false, message: 'student_id, date and status are required' });
  }

  if (!allowedAttendanceStatuses.includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid attendance status' });
  }

  const query = 'INSERT INTO attendance (student_id, `date`, status, notes) VALUES (?, ?, ?, ?)';
  db.query(query, [student_id, date, status, notes || null], (err, result) => {
    if (err) {
      console.error('Error recording attendance:', err);
      return res.status(500).json({ success: false, message: 'Error recording attendance', error: err.message });
    }
    res.status(201).json({ success: true, message: 'Attendance recorded', id: result.insertId });
  });
});

// --- Results Routes ---

// GET /results - list all results
app.get('/results', authenticateToken, (req, res) => {
  const query = `SELECT r.id, r.student_id, s.name as student_name, r.subject, r.term, r.marks, r.grade, r.remarks, r.created_at
                 FROM results r
                 LEFT JOIN students s ON s.id = r.student_id
                 ORDER BY r.created_at DESC`;
  db.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching results:', err);
      return res.status(500).json({ success: false, message: 'Error fetching results', error: err.message });
    }
    res.json({ success: true, data: results, count: results.length });
  });
});

// GET /results/student/:id - results for a student
app.get('/results/student/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const query = 'SELECT id, student_id, subject, term, marks, grade, remarks, created_at FROM results WHERE student_id = ? ORDER BY created_at DESC';
  db.query(query, [id], (err, results) => {
    if (err) {
      console.error('Error fetching student results:', err);
      return res.status(500).json({ success: false, message: 'Error fetching results', error: err.message });
    }
    res.json({ success: true, data: results, count: results.length });
  });
});

// POST /results - add a result { student_id, subject, term, marks, grade, remarks }
app.post('/results', authenticateToken, (req, res) => {
  const { student_id, subject, term, marks, remarks } = req.body;
  if (!student_id || !subject || typeof marks === 'undefined') {
    return res.status(400).json({ success: false, message: 'student_id, subject and marks are required' });
  }

  const numericMarks = Number(marks);
  if (!Number.isFinite(numericMarks) || numericMarks < 0 || numericMarks > 100) {
    return res.status(400).json({ success: false, message: 'Marks must be between 0 and 100' });
  }

  const safeSubject = subject.trim();
  const safeTerm = (term || 'Term 1').trim();
  const computedGrade = calculateGradeFromMarks(numericMarks);

  const query = 'INSERT INTO results (student_id, subject, term, marks, grade, remarks) VALUES (?, ?, ?, ?, ?, ?)';
  db.query(query, [student_id, safeSubject, safeTerm, numericMarks, computedGrade, remarks || null], (err, result) => {
    if (err) {
      console.error('Error inserting result:', err);
      return res.status(500).json({ success: false, message: 'Error inserting result', error: err.message });
    }
    res.status(201).json({ success: true, message: 'Result recorded', id: result.insertId });
  });
});

// --- Fees & Payments Routes ---

// GET /fees - list invoices
app.get('/fees', authenticateToken, (req, res) => {
  const query = `SELECT f.id, f.student_id, s.name as student_name, f.amount, f.due_date, f.status, f.description, f.created_at,
                        COALESCE(p.paid_total, 0) AS paid_total
                 FROM fees f
                 LEFT JOIN students s ON s.id = f.student_id
                 LEFT JOIN (
                   SELECT fee_id, SUM(amount) AS paid_total
                   FROM payments
                   GROUP BY fee_id
                 ) p ON p.fee_id = f.id
                 ORDER BY f.created_at DESC`;
  db.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching fees:', err);
      return res.status(500).json({ success: false, message: 'Error fetching fees', error: err.message });
    }
    const invoices = enrichInvoices(results);
    res.json({ success: true, data: invoices, count: invoices.length });
  });
});

// GET /fees/student/:id - fees for a student
app.get('/fees/student/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const query = `SELECT f.id, f.student_id, f.amount, f.due_date, f.status, f.description, f.created_at,
                        COALESCE(p.paid_total, 0) AS paid_total
                 FROM fees f
                 LEFT JOIN (
                   SELECT fee_id, SUM(amount) AS paid_total
                   FROM payments
                   GROUP BY fee_id
                 ) p ON p.fee_id = f.id
                 WHERE f.student_id = ?
                 ORDER BY f.created_at DESC`;
  db.query(query, [id], (err, results) => {
    if (err) {
      console.error('Error fetching student fees:', err);
      return res.status(500).json({ success: false, message: 'Error fetching fees', error: err.message });
    }
    const invoices = enrichInvoices(results);
    res.json({ success: true, data: invoices, count: invoices.length });
  });
});

// POST /fees - create invoice { student_id, amount, due_date, description }
app.post('/fees', authenticateToken, (req, res) => {
  const { student_id, amount, due_date, description } = req.body;
  if (!student_id || !amount || !due_date) {
    return res.status(400).json({ success: false, message: 'student_id, amount and due_date are required' });
  }

  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return res.status(400).json({ success: false, message: 'Amount must be greater than zero' });
  }

  const query = 'INSERT INTO fees (student_id, amount, due_date, description) VALUES (?, ?, ?, ?)';
  db.query(query, [student_id, numericAmount, due_date, description || null], (err, result) => {
    if (err) {
      console.error('Error creating fee invoice:', err);
      return res.status(500).json({ success: false, message: 'Error creating fee', error: err.message });
    }
    res.status(201).json({ success: true, message: 'Fee invoice created', id: result.insertId });
  });
});

// POST /fees/pay - record a payment { fee_id, amount, method }
app.post('/fees/pay', authenticateToken, (req, res) => {
  const { fee_id, amount, method } = req.body;
  if (!fee_id || typeof amount === 'undefined') {
    return res.status(400).json({ success: false, message: 'fee_id and amount are required' });
  }

  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return res.status(400).json({ success: false, message: 'Payment amount must be greater than zero' });
  }

  const feeQuery = 'SELECT amount, due_date FROM fees WHERE id = ?';
  db.query(feeQuery, [fee_id], (feeErr, feeRows) => {
    if (feeErr) {
      console.error('Error fetching fee:', feeErr);
      return res.status(500).json({ success: false, message: 'Error recording payment' });
    }
    if (feeRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    const feeAmount = parseFloat(feeRows[0].amount);
    const dueDate = feeRows[0].due_date;

    db.query('SELECT COALESCE(SUM(amount),0) AS paid_total FROM payments WHERE fee_id = ?', [fee_id], (sumErr, sumRows) => {
      if (sumErr) {
        console.error('Error fetching payment total:', sumErr);
        return res.status(500).json({ success: false, message: 'Error recording payment' });
      }

      const paidTotal = parseFloat(sumRows[0].paid_total || 0);
      const remaining = feeAmount - paidTotal;

      if (numericAmount - remaining > 0.01) {
        return res.status(400).json({ success: false, message: 'Payment exceeds remaining balance' });
      }

      const insertPayment = 'INSERT INTO payments (fee_id, amount, method) VALUES (?, ?, ?)';
      db.query(insertPayment, [fee_id, numericAmount, method || 'cash'], (insertErr, insertResult) => {
        if (insertErr) {
          console.error('Error recording payment:', insertErr);
          return res.status(500).json({ success: false, message: 'Error recording payment', error: insertErr.message });
        }

        const updatedPaid = paidTotal + numericAmount;
        const balance = Math.max(feeAmount - updatedPaid, 0);
        const status = determineFeeStatus(dueDate, balance, feeAmount);
        db.query('UPDATE fees SET status = ? WHERE id = ?', [status, fee_id], () => {});

        res.status(201).json({
          success: true,
          message: 'Payment recorded',
          paymentId: insertResult.insertId,
          paidTotal: updatedPaid,
          balance,
          status
        });
      });
    });
  });
});

// Serve SPA pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/index.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    success: false, 
    message: 'Internal server error' 
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    message: 'Route not found' 
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('Student Management System is ready!');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  db.end((err) => {
    if (err) console.error('Error closing database pool:', err);
    else console.log('Database pool closed');
    process.exit(0);
  });
});
