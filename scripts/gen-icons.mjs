// Render the SVG mark to the PNG icons the manifest references.
// Run with: npm run gen:icons
import sharp from "sharp";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const pub = resolve(here, "..", "public");
const svg = readFileSync(resolve(pub, "favicon.svg"));

// A maskable icon needs its art inside the safe zone, so pad with the brand green.
const maskable = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
     <rect width="64" height="64" fill="#3f6b3f"/>
     <g transform="translate(9 9) scale(0.72)">${readFileSync(
       resolve(pub, "favicon.svg"),
       "utf8",
     ).replace(/<\?xml.*?\?>/, "").replace(/<svg[^>]*>/, "").replace(/<\/svg>/, "")}</g>
   </svg>`,
);

const jobs = [
  { input: svg, size: 192, out: "icon-192.png" },
  { input: svg, size: 512, out: "icon-512.png" },
  { input: svg, size: 180, out: "apple-touch-icon.png" },
  { input: maskable, size: 512, out: "icon-maskable-512.png" },
];

for (const { input, size, out } of jobs) {
  await sharp(input, { density: 384 })
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(resolve(pub, out));
  console.log(`wrote public/${out} (${size}x${size})`);
}
