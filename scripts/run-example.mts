import { spawn } from 'child_process';
import path from 'path';

const exampleName = process.argv[2];

if (!exampleName) {
  console.error('❌ Merci de spécifier un nom d’exemple');
  process.exit(1);
}

const filePath = path.join('examples', `${exampleName}.ts`);

spawn('ts-node', [filePath], {
  stdio: 'inherit',
});
