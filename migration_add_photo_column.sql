-- Migration: Add photo column to students table
-- Run this in your MySQL client if the students table already exists

ALTER TABLE students 
ADD COLUMN photo VARCHAR(255) NULL 
AFTER email;

-- Verify the change
DESCRIBE students;

