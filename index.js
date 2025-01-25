const sqlite3 = require('sqlite3').verbose();
const sqlite = require('sqlite');
const fs = require('fs');
const path = require('path');
const AWS = require('aws-sdk');


// Get database paths from command line arguments
const dbPath = process.argv[2];
const competitorsDbPath = process.argv[3];
const bucket = process.argv[4]
if (!dbPath || !competitorsDbPath || !bucket) {
  console.error('Please provide the paths to the SQLite databases and S3 bucket as command line arguments.');
  process.exit(1);
}

// Resolve the database paths
const resolvedDbPath = path.resolve(dbPath);
const resolvedCompetitorsDbPath = path.resolve(competitorsDbPath);
const queryHeat1 = 'SELECT C_NUM, C_STATUS, C_TIME FROM TTIMEINFOS_HEAT1';
const queryHeat2 = 'SELECT C_NUM, C_STATUS, C_TIME FROM TTIMEINFOS_HEAT2';
const queryCompetitors = 'SELECT C_NUM, C_LAST_NAME, C_FIRST_NAME, C_CATEGORY FROM TCOMPETITORS';

// Helper function to map status codes to descriptions or time
const getTimeOrStatus = (status, time) => {
  if (status === 1) return 'DNS';
  if (status === 2) return 'DNF';
  if (status === 3) return 'DSQ';
  return formatTime(time);
};

// Function to upload the file to S3
async function uploadFileToS3(fileContent) {
	try {
		// Initialize the S3 service without explicitly providing credentials
		const s3 = new AWS.S3();

		const fileName = 'skiers_data.html';
  
		const params = {
			Bucket: bucket,
			Key: fileName,
			Body: fileContent,
			ContentType: 'text/html'
		};

		// Upload the file using S3
		const result = await s3.upload(params).promise();
		console.log("File uploaded successfully:", result);
		return result; // Return the result if needed
	} catch (error) {
		console.error("Error uploading file:", error);
		throw error; // Re-throw the error for handling by the caller
	}
}

// Helper function to calculate the sum of times
const calculateSum = (heat1, heat2) => {
  if (heat1.status === 0 && heat2.status === 0 && heat1.time !== null && heat2.time !== null) {
	return formatTime(heat1.time + heat2.time);
  }
  return '-';
};

// Helper function to format time in mm:ss.ss
const formatTime = (timeInMs) => {
  if (timeInMs === null) return '-';
  const minutes = Math.floor(timeInMs / 60000);
  const seconds = ((timeInMs % 60000) / 1000).toFixed(2);
  return `${minutes}:${seconds.padStart(5, '0')}`;
};

async function fetchCompetitors() {
  try {
    const db = await sqlite.open({ filename: resolvedCompetitorsDbPath, driver: sqlite3.Database });
    const rows = await db.all(queryCompetitors);
    await db.close();
	return rows;
  } catch (err) {
    console.error('Error:', err.message);
  }
}
async function resultsFromHeats() {
  try {
    const db = await sqlite.open({ filename: resolvedDbPath, driver: sqlite3.Database });
    const rowsHeat1 = await db.all(queryHeat1);
	const rowsHeat2 = await db.all(queryHeat2);
    await db.close();
	return {heat1:rowsHeat1,heat2:rowsHeat2};
  } catch (err) {
    console.error('Error:', err.message);
  }
}

async function queryAndUpload() {
	try {
	const competitors = await fetchCompetitors();
	const heats = await resultsFromHeats();
	// Combine data from all tables
	const combinedRows = competitors.map(competitor => {
	  const row1 = heats.heat1.find(row => row.C_NUM === competitor.C_NUM) || { C_STATUS: null, C_TIME: null };
	  const row2 = heats.heat2.find(row => row.C_NUM === competitor.C_NUM) || { C_STATUS: null, C_TIME: null };
	  return {
		C_NUM: competitor.C_NUM,
		LastName: competitor.C_LAST_NAME,
		FirstName: competitor.C_FIRST_NAME,
		Category: competitor.C_CATEGORY,
		Heat1: { status: row1.C_STATUS, time: row1.C_TIME },
		Heat2: { status: row2.C_STATUS, time: row2.C_TIME }
	  };
	});
	// Group data by category
	const groupedByCategory = combinedRows.reduce((groups, row) => {
	  if (!groups[row.Category]) groups[row.Category] = [];
	  groups[row.Category].push(row);
	  return groups;
	}, {});
	// Create HTML content
        let htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Results</title>
  <style>
    body { font-family: Arial, sans-serif; }
    table { width: 80%; margin: 20px auto; border-collapse: collapse; }
    th, td { border: 1px solid #ccc; padding: 10px; text-align: center; }
    th { background-color: #f4f4f4; }
    h2 { text-align: center; margin-top: 20px; }
  </style>
</head>
<body>
  <h1 style="text-align: center;">Results</h1>
`;

        for (const [category, rows] of Object.entries(groupedByCategory)) {
          htmlContent += `  <h2>Category: ${category}</h2>
  <table>
    <thead>
      <tr>
        <th>Bib Number (C_NUM)</th>
        <th>Last Name</th>
        <th>First Name</th>
        <th>Heat1 Time</th>
        <th>Heat2 Time</th>
        <th>Total Time</th>
      </tr>
    </thead>
    <tbody>
`;
		for (const row of rows)
          {
            htmlContent += `      <tr>
        <td>${row.C_NUM}</td>
        <td>${row.LastName}</td>
        <td>${row.FirstName}</td>
        <td>${getTimeOrStatus(row.Heat1.status, row.Heat1.time)}</td>
        <td>${getTimeOrStatus(row.Heat2.status, row.Heat2.time)}</td>
        <td>${calculateSum(row.Heat1, row.Heat2)}</td>
      </tr>
`;
          }
          htmlContent += `    </tbody>
  </table>
`;
        }

        htmlContent += `</body>
</html>`;
		console.log(htmlContent);
	await uploadFileToS3(htmlContent);
	
	process.exit(0);
  } catch (error) {
    console.error('Error querying users:', error);
  }
	
}

(async () => {
	await queryAndUpload();
})();

