import { execSync } from 'child_process';

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const svgPath = 'client/public/icons/icon.svg';
const outputDir = 'client/public/icons';

// Check if ImageMagick is installed
try {
  execSync('convert -version', { stdio: 'ignore' });
} catch (error) {
  console.error('ImageMagick is not installed. Please install it or use another method to convert SVG to PNG.');
  process.exit(1);
}

// Create PNG icons for each size
sizes.forEach(size => {
  try {
    const outputPath = `${outputDir}/icon-${size}x${size}.png`;
    execSync(`convert -background none -size ${size}x${size} ${svgPath} ${outputPath}`);
    console.log(`Created ${outputPath}`);
  } catch (error) {
    console.error(`Error creating ${size}x${size} icon:`, error.message);
  }
});

console.log('Icon generation complete!');