const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

// Get database paths from command line arguments
const dbPath = process.argv[2];
const competitorsDbPath = process.argv[3];
if (!dbPath || !competitorsDbPath) {
  console.error('Please provide the paths to the SQLite databases as command line arguments.');
  process.exit(1);
}

// Resolve the database paths
const resolvedDbPath = path.resolve(dbPath);
const resolvedCompetitorsDbPath = path.resolve(competitorsDbPath);

// Connect to the SQLite databases
const db = new sqlite3.Database(resolvedDbPath, (err) => {
  if (err) {
    console.error('Error connecting to SQLite database:', err.message);
    return;
  }
  console.log(`Connected to the SQLite database at ${resolvedDbPath}`);
});

const competitorsDb = new sqlite3.Database(resolvedCompetitorsDbPath, (err) => {
  if (err) {
    console.error('Error connecting to competitors SQLite database:', err.message);
    return;
  }
  console.log(`Connected to the competitors SQLite database at ${resolvedCompetitorsDbPath}`);
});

// Query the TTIMEINFOS_HEAT1, TTIMEINFOS_HEAT2, and TCOMPETITORS tables and generate HTML
const generateHtml = () => {
  const queryHeat1 = 'SELECT C_NUM, C_STATUS, C_TIME FROM TTIMEINFOS_HEAT1';
  const queryHeat2 = 'SELECT C_NUM, C_STATUS, C_TIME FROM TTIMEINFOS_HEAT2';
  const queryCompetitors = 'SELECT C_NUM, C_LAST_NAME, C_FIRST_NAME, C_CATEGORY FROM TCOMPETITORS';

  competitorsDb.all(queryCompetitors, [], (err, competitors) => {
    if (err) {
      console.error('Error querying the Competitors table:', err.message);
      return;
    }

    db.all(queryHeat1, [], (err, rowsHeat1) => {
      if (err) {
        console.error('Error querying the Heat1 table:', err.message);
        return;
      }

      db.all(queryHeat2, [], (err, rowsHeat2) => {
        if (err) {
          console.error('Error querying the Heat2 table:', err.message);
          return;
        }

        // Combine data from all tables
        const combinedRows = competitors.map(competitor => {
          const row1 = rowsHeat1.find(row => row.C_NUM === competitor.C_NUM) || { C_STATUS: null, C_TIME: null };
          const row2 = rowsHeat2.find(row => row.C_NUM === competitor.C_NUM) || { C_STATUS: null, C_TIME: null };
          return {
            C_NUM: competitor.C_NUM,
            LastName: competitor.C_LAST_NAME,
            FirstName: competitor.C_FIRST_NAME,
            Category: competitor.C_CATEGORY,
            Heat1: { status: row1.C_STATUS, time: row1.C_TIME },
            Heat2: { status: row2.C_STATUS, time: row2.C_TIME }
          };
        });

        // Helper function to format time in mm:ss.ss
        const formatTime = (timeInMs) => {
          if (timeInMs === null) return '-';
          const minutes = Math.floor(timeInMs / 60000);
          const seconds = ((timeInMs % 60000) / 1000).toFixed(2);
          return `${minutes}:${seconds.padStart(5, '0')}`;
        };

        // Helper function to map status codes to descriptions or time
        const getTimeOrStatus = (status, time) => {
          if (status === 1) return 'DNS';
          if (status === 2) return 'DNF';
          if (status === 3) return 'DSQ';
          return formatTime(time);
        };

        // Helper function to calculate the sum of times
        const calculateSum = (heat1, heat2) => {
          if (heat1.status === 0 && heat2.status === 0 && heat1.time !== null && heat2.time !== null) {
            return formatTime(heat1.time + heat2.time);
          }
          return '-';
        };

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
  <title>Skiers Data</title>
  <style>
    body { font-family: Arial, sans-serif; }
    table { width: 80%; margin: 20px auto; border-collapse: collapse; }
    th, td { border: 1px solid #ccc; padding: 10px; text-align: center; }
    th { background-color: #f4f4f4; }
    h2 { text-align: center; margin-top: 20px; }
  </style>
</head>
<body>
  <h1 style="text-align: center;">Skiers Data</h1>
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
          rows.forEach(row => {
            htmlContent += `      <tr>
        <td>${row.C_NUM}</td>
        <td>${row.LastName}</td>
        <td>${row.FirstName}</td>
        <td>${getTimeOrStatus(row.Heat1.status, row.Heat1.time)}</td>
        <td>${getTimeOrStatus(row.Heat2.status, row.Heat2.time)}</td>
        <td>${calculateSum(row.Heat1, row.Heat2)}</td>
      </tr>
`;
          });
          htmlContent += `    </tbody>
  </table>
`;
        }

        htmlContent += `</body>
</html>`;

        // Write the HTML content to a file
        fs.writeFile('skiers_data.html', htmlContent, (err) => {
          if (err) {
            console.error('Error writing HTML file:', err.message);
          } else {
            console.log('HTML file generated successfully: skiers_data.html');
          }

          // Close the database connections after generating the HTML
          db.close((err) => {
            if (err) {
              console.error('Error closing the main database connection:', err.message);
            } else {
              console.log('Main database connection closed.');
            }
          });
          competitorsDb.close((err) => {
            if (err) {
              console.error('Error closing the competitors database connection:', err.message);
            } else {
              console.log('Competitors database connection closed.');
            }
          });
        });
      });
    });
  });
};

// Generate the HTML
generateHtml();
