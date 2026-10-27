const args = process.argv.slice(2);

const command = args[0];
const directory = args[1];

switch (command) {
  case 'scan':
    console.log(`Scanning directory: ${directory}`);
    break;

  case 'duplicates':
    console.log(`Finding duplicates in: ${directory}`);
    break;

  case 'organize':
    console.log(`Organizing files in: ${directory}`);
    break;

  case 'cleanup':
    console.log(`Cleaning up: ${directory}`);
    break;

  default:
    console.log(
      'Unknown command. Use scan, duplicates, organize, or cleanup.'
    );
}