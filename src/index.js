import 'dotenv/config';
import { initializeDatabase } from './services/db.js';
import { generateAndSaveDailyBrief } from './services/briefService.js';

async function main() {
  console.log('===================================================');
  console.log('           RING NEWS AGENT: MILESTONE M1           ');
  console.log('===================================================');

  // 1. Initialize database configurations
  initializeDatabase();

  try {
    await generateAndSaveDailyBrief();
    console.log('\n===================================================');
    console.log('      RING RUN COMPLETED SUCCESSFULLY              ');
    console.log('===================================================');
  } catch (error) {
    console.error('\nFatal error running Ring news agent:', error);
  }
}

main();
