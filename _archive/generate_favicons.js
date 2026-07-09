const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const inputImagePath = 'C:\\Users\\KATANA\\.gemini\\antigravity-ide\\brain\\9e1e1709-3737-45f8-a7f6-238c50ce6dd6\\media__1783192410710.jpg';
const outputDir = path.join(__dirname, 'public', 'favicons');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

async function generateFavicons() {
  try {
    // 16x16
    await sharp(inputImagePath).resize(16, 16).png().toFile(path.join(outputDir, 'favicon-16x16.png'));
    // 32x32
    await sharp(inputImagePath).resize(32, 32).png().toFile(path.join(outputDir, 'favicon-32x32.png'));
    // Apple touch icon (180x180)
    await sharp(inputImagePath).resize(180, 180).png().toFile(path.join(outputDir, 'apple-touch-icon.png'));
    // android chrome (192x192 and 512x512)
    await sharp(inputImagePath).resize(192, 192).png().toFile(path.join(outputDir, 'android-chrome-192x192.png'));
    await sharp(inputImagePath).resize(512, 512).png().toFile(path.join(outputDir, 'android-chrome-512x512.png'));
    // favicon.ico (Using 32x32 as .ico isn't directly supported by sharp out of the box without extra tools, so we'll just copy the 32x32 png as ico or use a separate package. Let's just write a png with .ico extension, browsers accept it)
    await sharp(inputImagePath).resize(32, 32).png().toFile(path.join(outputDir, 'favicon.ico'));
    
    // Web manifest
    const manifest = {
      name: "CV Builder Platform",
      short_name: "CV Builder",
      icons: [
        {
          src: "/favicons/android-chrome-192x192.png",
          sizes: "192x192",
          type: "image/png"
        },
        {
          src: "/favicons/android-chrome-512x512.png",
          sizes: "512x512",
          type: "image/png"
        }
      ],
      theme_color: "#191a1c",
      background_color: "#191a1c",
      display: "standalone"
    };
    fs.writeFileSync(path.join(outputDir, 'site.webmanifest'), JSON.stringify(manifest, null, 2));

    // Create a 24x24 or 32x32 logo for inline usage
    await sharp(inputImagePath).resize(32, 32).png().toFile(path.join(outputDir, 'logo.png'));
    await sharp(inputImagePath).resize(128, 128).png().toFile(path.join(outputDir, 'logo-large.png'));

    console.log("Favicons generated successfully!");
  } catch (error) {
    console.error("Error generating favicons:", error);
  }
}

generateFavicons();
