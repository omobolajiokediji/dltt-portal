import * as functions from 'firebase-functions';
import { google } from 'googleapis';
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
admin.initializeApp();
const sheets = google.sheets('v4');
// Get the directory of the current file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Load service account key
const serviceAccountPath = path.join(__dirname, '../service-account-key.json');
const serviceAccountData = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
const auth = new google.auth.GoogleAuth({
    credentials: serviceAccountData,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
export const createTeachersSheet = functions.https.onCall(async (data, context) => {
    // Verify user is authenticated
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    try {
        const db = admin.firestore();
        const usersSnap = await db.collection('users').where('role', '==', 'teacher').get();
        // Prepare data
        const teachers = usersSnap.docs.map((doc) => doc.data());
        const headers = [
            'Full Name',
            'State',
            'Gender',
            'Email',
            'Phone Number',
            'Account Number',
            'Account Name',
            'Bank Name',
        ];
        const rows = teachers.map((teacher) => [
            teacher.name || '',
            teacher.state || '',
            teacher.gender || '',
            teacher.email || '',
            teacher.phone || '',
            teacher.accountNumber || '',
            teacher.accountName || '',
            teacher.bank || '',
        ]);
        // Create spreadsheet
        const authClient = await auth.getClient();
        const request = {
            auth: authClient,
            requestBody: {
                properties: {
                    title: `DLTT Teachers Data - ${new Date().toLocaleDateString()}`,
                },
            },
        };
        const response = await sheets.spreadsheets.create(request);
        const spreadsheetId = response.data.spreadsheetId;
        // Add header row and data
        await sheets.spreadsheets.values.update({
            auth: authClient,
            spreadsheetId: spreadsheetId,
            range: 'Sheet1!A1',
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [headers, ...rows],
            },
        });
        // Format header row
        await sheets.spreadsheets.batchUpdate({
            auth: authClient,
            spreadsheetId: spreadsheetId,
            requestBody: {
                requests: [
                    {
                        repeatCell: {
                            range: {
                                sheetId: 0,
                                startRowIndex: 0,
                                endRowIndex: 1,
                            },
                            cell: {
                                userEnteredFormat: {
                                    backgroundColor: { red: 0.2, green: 0.6, blue: 0.2 },
                                    textFormat: {
                                        foregroundColor: { red: 1, green: 1, blue: 1 },
                                        bold: true,
                                    },
                                },
                            },
                            fields: 'userEnteredFormat(backgroundColor,textFormat)',
                        },
                    },
                ],
            },
        });
        return {
            success: true,
            spreadsheetId: spreadsheetId,
            url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
        };
    }
    catch (error) {
        console.error('Error creating sheet:', error);
        throw new functions.https.HttpsError('internal', 'Failed to create spreadsheet');
    }
});
