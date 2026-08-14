'use strict';

/**
 * ARCIO — Google Sheets Integration Service
 * Encapsulates Google Sheets API administrative reporting operations.
 * Spreadsheet: ARCIO Student Records
 * Worksheet: Students
 */

const path = require('path');
const fs = require('fs');
const { google } = require('googleapis');

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID || '16wdvpxSkQvmdlpS0ZqB4qVWu5S1an6A98nL8c0MOZ0w';
const SHEET_NAME = 'Students';
const CREDENTIALS_PATH = path.join(__dirname, '..', 'credentials', 'arcio-sheets-service.json');

let sheetsClient = null;

function getSheetsClient() {
  if (sheetsClient) return sheetsClient;

  const credentialsJson = process.env.GOOGLE_SHEETS_CREDENTIALS_JSON;

  console.log('[GOOGLE SHEETS ENV]', {
    exists: Boolean(credentialsJson),
    length: credentialsJson?.length || 0,
    startsWithJson: credentialsJson?.trim().startsWith('{') || false,
  });

  let authOptions;

  if (credentialsJson) {
    try {
      const credentials = JSON.parse(credentialsJson);

      authOptions = {
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      };
    } catch (err) {
      throw new Error(
        `Invalid GOOGLE_SHEETS_CREDENTIALS_JSON: ${err.message}`
      );
    }
  } else if (fs.existsSync(CREDENTIALS_PATH)) {
    // Local development fallback
    authOptions = {
      keyFile: CREDENTIALS_PATH,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    };
  } else {
    throw new Error(
      'Google Sheets credentials not configured. ' +
      'Set GOOGLE_SHEETS_CREDENTIALS_JSON in the environment.'
    );
  }

  const auth = new google.auth.GoogleAuth(authOptions);

  sheetsClient = google.sheets({
    version: 'v4',
    auth,
  });

  return sheetsClient;
}

/**
 * Normalizes registration number for consistent comparison.
 */
function normalizeRegNo(regNo) {
  return (regNo || '').toString().trim().toUpperCase();
}

/**
 * Synchronizes student details into Google Sheet ("Students" worksheet).
 * If student row exists (matched by Registration No), updates the row.
 * Otherwise appends a new row.
 */
async function syncStudentToSheet(studentData) {
  const {
    registerNo,
    name,
    email,
    experimentsCompleted = '0/10',
    advancedCompleted = '0/3',
    certificateStatus = 'Not Issued',
    lastActive = new Date().toISOString().split('T')[0],
  } = studentData;

  const normalizedReg = normalizeRegNo(registerNo);
  if (!normalizedReg) {
    throw new Error('Missing registration number for Google Sheets sync.');
  }

  const sheets = getSheetsClient();

  // Read existing rows to check for duplicate/existing student
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A:G`,
  });

  const rows = response.data.values || [];
  let existingRowIndex = -1;

  // Search row (skip header at index 0)
  for (let i = 1; i < rows.length; i++) {
    const rowReg = normalizeRegNo(rows[i][0]);
    if (rowReg === normalizedReg) {
      existingRowIndex = i + 1; // 1-indexed row number in Google Sheets
      break;
    }
  }

  const rowValues = [
    normalizedReg,
    name || '',
    email || '',
    experimentsCompleted,
    advancedCompleted,
    certificateStatus,
    lastActive,
  ];

  if (existingRowIndex > 0) {
    // Update existing row
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A${existingRowIndex}:G${existingRowIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [rowValues],
      },
    });
    console.log(`[GOOGLE SHEETS] Updated student record row ${existingRowIndex} for ${normalizedReg}`);
    return { action: 'updated', rowIndex: existingRowIndex };
  } else {
    // Append new row
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:G`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [rowValues],
      },
    });
    console.log(`[GOOGLE SHEETS] Appended new student record for ${normalizedReg}`);
    return { action: 'appended' };
  }
}

module.exports = {
  syncStudentToSheet,
  SPREADSHEET_ID,
};
