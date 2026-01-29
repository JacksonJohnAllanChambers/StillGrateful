-- Still Grateful API - Initial Database Schema
-- Migration: 0001_initial_schema.sql

-- Table for logging sends (does not store message content for privacy)
CREATE TABLE sends (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sender_hash TEXT NOT NULL,
  recipient_domain TEXT NOT NULL,
  context_tag TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Index for querying sends by sender
CREATE INDEX idx_sends_sender_hash ON sends(sender_hash);

-- Index for querying sends by status
CREATE INDEX idx_sends_status ON sends(status);

-- Table for rate limiting
CREATE TABLE rate_limits (
  sender_hash TEXT PRIMARY KEY,
  send_count INTEGER DEFAULT 0,
  window_start TEXT DEFAULT (datetime('now'))
);
