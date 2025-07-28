/**
 * Test script to verify SQLite3 wrapper functionality
 */

const { getSQLite3 } = require('./src/core/sqlite3-wrapper');
const { logger } = require('./src/core/logger');

async function testSQLite3Wrapper() {
    console.log('Testing SQLite3 wrapper...');
    
    // Test loading SQLite3
    const sqlite3 = getSQLite3();
    
    if (sqlite3) {
        console.log('✅ SQLite3 loaded successfully');
        
        // Test basic database operations
        try {
            const db = new sqlite3.Database(':memory:');
            
            db.run('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)', (err) => {
                if (err) {
                    console.log('❌ Failed to create table:', err.message);
                    return;
                }
                
                console.log('✅ SQLite3 database operations working');
                
                db.close((err) => {
                    if (err) {
                        console.log('❌ Failed to close database:', err.message);
                    } else {
                        console.log('✅ SQLite3 test completed successfully');
                    }
                });
            });
            
        } catch (error) {
            console.log('❌ SQLite3 operations failed:', error.message);
        }
    } else {
        console.log('❌ SQLite3 could not be loaded');
    }
}

// Check if this is a pkg environment
if (typeof process.pkg !== 'undefined') {
    console.log('🔥 Running in PKG environment');
} else {
    console.log('📦 Running in normal Node.js environment');
}

testSQLite3Wrapper();