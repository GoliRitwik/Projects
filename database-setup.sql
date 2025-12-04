-- Student Management System Database Setup
-- Run this script in MySQL to set up the database

-- Create database
CREATE DATABASE IF NOT EXISTS student_db;

-- Use the database
USE student_db;

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('admin', 'user') DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create students table
CREATE TABLE IF NOT EXISTS students (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    age INT NOT NULL,
    course VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Insert default admin user (password: admin123)
INSERT INTO users (username, email, password, role) VALUES
('admin', 'admin@sms.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin');

-- Insert sample students data (optional)
INSERT INTO students (name, age, course, email) VALUES
('John Doe', 22, 'Computer Science', 'john.doe@example.com'),
('Jane Smith', 21, 'Mathematics', 'jane.smith@example.com'),
('Mike Johnson', 23, 'Physics', 'mike.johnson@example.com'),
('Sarah Wilson', 20, 'Chemistry', 'sarah.wilson@example.com'),
('David Brown', 24, 'Biology', 'david.brown@example.com');

-- Verify the setup
SELECT 'Database setup completed successfully!' as status;
SELECT COUNT(*) as total_students FROM students;

-- Attendance table
CREATE TABLE IF NOT EXISTS attendance (
    id INT PRIMARY KEY AUTO_INCREMENT,
    student_id INT NOT NULL,
    `date` DATE NOT NULL,
    status ENUM('present','absent','late') NOT NULL DEFAULT 'present',
    notes VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Results table
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

-- Fees / invoices table
CREATE TABLE IF NOT EXISTS fees (
    id INT PRIMARY KEY AUTO_INCREMENT,
    student_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    due_date DATE NOT NULL,
    status ENUM('pending','paid','overdue') DEFAULT 'pending',
    description VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payments table (records payments against fees)
CREATE TABLE IF NOT EXISTS payments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    fee_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    method VARCHAR(100) DEFAULT 'cash',
    paid_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sample seeded attendance, results and fees for demo student (if students exist)
INSERT INTO attendance (student_id, `date`, status, notes)
SELECT id, CURDATE(), 'present', 'First day attendance' FROM students LIMIT 1;

INSERT INTO results (student_id, subject, term, marks, grade, remarks)
SELECT id, 'Mathematics', 'Term 1', 85, 'A', 'Good performance' FROM students LIMIT 1;

INSERT INTO fees (student_id, amount, due_date, status, description)
SELECT id, 1500.00, DATE_ADD(CURDATE(), INTERVAL 30 DAY), 'pending', 'Tuition fee - semester' FROM students LIMIT 1;

