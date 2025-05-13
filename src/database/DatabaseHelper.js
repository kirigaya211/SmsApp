import SQLite from 'react-native-sqlite-storage';

SQLite.enablePromise(true);

class DatabaseHelper {
  static database = null;

  static async initDB() {
    try {
      const db = await SQLite.openDatabase({
        name: 'SmsApp.db',
        location: 'default',
      });
      this.database = db;
      await this.createTables();
      return db;
    } catch (error) {
      console.error('Error initializing database:', error);
      throw error;
    }
  }

  static async createTables() {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message_id TEXT UNIQUE,
        address TEXT,
        body TEXT,
        date INTEGER,
        classification TEXT,
        is_read INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
      );
    `;

    try {
      await this.database.executeSql(createTableQuery);
    } catch (error) {
      console.error('Error creating tables:', error);
      throw error;
    }
  }

  static async saveMessage(message) {
    const { _id, address, body, date, classification, read } = message;
    const query = `
      INSERT OR REPLACE INTO messages (message_id, address, body, date, classification, is_read)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    try {
      await this.database.executeSql(query, [
        _id,
        address,
        body,
        date,
        classification,
        read ? 1 : 0,
      ]);
    } catch (error) {
      console.error('Error saving message:', error);
      throw error;
    }
  }

  static async updateMessageClassification(messageId, classification) {
    const query = `
      UPDATE messages
      SET classification = ?
      WHERE message_id = ?
    `;

    try {
      await this.database.executeSql(query, [classification, messageId]);
    } catch (error) {
      console.error('Error updating message classification:', error);
      throw error;
    }
  }

  static async getMessages() {
    const query = `
      SELECT * FROM messages
      ORDER BY date DESC
    `;

    try {
      const [results] = await this.database.executeSql(query);
      const messages = [];
      for (let i = 0; i < results.rows.length; i++) {
        const row = results.rows.item(i);
        messages.push({
          _id: row.message_id,
          address: row.address,
          body: row.body,
          date: row.date,
          classification: row.classification,
          read: row.is_read === 1,
        });
      }
      return messages;
    } catch (error) {
      console.error('Error getting messages:', error);
      throw error;
    }
  }

  static async getMessagesByAddress(address) {
    const query = `
      SELECT * FROM messages
      WHERE address = ?
      ORDER BY date DESC
    `;

    try {
      const [results] = await this.database.executeSql(query, [address]);
      const messages = [];
      for (let i = 0; i < results.rows.length; i++) {
        const row = results.rows.item(i);
        messages.push({
          _id: row.message_id,
          address: row.address,
          body: row.body,
          date: row.date,
          classification: row.classification,
          read: row.is_read === 1,
        });
      }
      return messages;
    } catch (error) {
      console.error('Error getting messages by address:', error);
      throw error;
    }
  }

  static async getMessageById(messageId) {
    const query = `
      SELECT * FROM messages
      WHERE message_id = ?
    `;

    try {
      const [results] = await this.database.executeSql(query, [messageId]);
      if (results.rows.length > 0) {
        const row = results.rows.item(0);
        return {
          _id: row.message_id,
          address: row.address,
          body: row.body,
          date: row.date,
          classification: row.classification,
          read: row.is_read === 1,
        };
      }
      return null;
    } catch (error) {
      console.error('Error getting message by id:', error);
      throw error;
    }
  }
}

export default DatabaseHelper; 