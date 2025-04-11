const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');

const DB_FILE = './database.db'; // Tietokantatiedosto tallennetaan server-kansioon

let db;

async function initializeDatabase() {
  try {
    db = await open({
      filename: DB_FILE,
      driver: sqlite3.Database
    });

    console.log('Connected to the SQLite database.');

    // Luo taulut, jos niitä ei ole olemassa
    await db.exec(`
      CREATE TABLE IF NOT EXISTS songs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await db.exec(`
      CREATE TABLE IF NOT EXISTS players (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        score INTEGER DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('Database tables ensured.');
    return db; // Palauta alustettu tietokantaobjekti
  } catch (err) {
    console.error('Error connecting to or initializing database:', err.message);
    throw err; // Heitä virhe eteenpäin
  }
}

// Vie funktio ja myöhemmin alustettu db-objekti
module.exports = {
  initializeDatabase,
  getDb: () => {
    if (!db) {
      throw new Error('Database not initialized. Call initializeDatabase first.');
    }
    return db;
  }
}; 