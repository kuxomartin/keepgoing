// SERVER-ONLY — never import this in client components
// Uses googleapis which is a Node.js-only package

import { google } from 'googleapis'

function getGoogleAuth() {
  const email = process.env.GOOGLE_CLIENT_EMAIL
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (!email || !key) {
    throw new Error(
      'Missing Google credentials. Set GOOGLE_CLIENT_EMAIL and GOOGLE_PRIVATE_KEY in environment variables.'
    )
  }

  return new google.auth.JWT({
    email,
    key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
}

/**
 * Fetch all rows from a Google Sheet tab.
 * Returns string[][] where row[0] is the header row.
 */
export async function fetchSheetRows(
  spreadsheetId: string,
  sheetName: string
): Promise<string[][]> {
  const auth = getGoogleAuth()
  const sheets = google.sheets({ version: 'v4', auth })

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: sheetName,
  })

  return (response.data.values ?? []) as string[][]
}

/**
 * Fetch only the header row (first row) from a sheet.
 * Used for the preview/column-mapping feature.
 */
export async function fetchSheetHeaders(
  spreadsheetId: string,
  sheetName: string
): Promise<string[]> {
  const auth = getGoogleAuth()
  const sheets = google.sheets({ version: 'v4', auth })

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!1:3`, // first 3 rows for headers + sample
  })

  const rows = (response.data.values ?? []) as string[][]
  return rows[0]?.map((h) => String(h).trim()) ?? []
}
