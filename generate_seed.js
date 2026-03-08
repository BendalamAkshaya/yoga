import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PUBLIC_DIR = path.join(__dirname, 'public');
const OPTIONAL_ASANAS_DIR = path.join(PUBLIC_DIR, 'OPTIONAL ASANAS');
const SEED_FILE = path.join(__dirname, 'supabase', 'seed_asanas.sql');

function generateSeedData() {
    let sqlOutput = `-- COMPREHENSIVE ASANA SEED SCRIPT (Auto-generated)\n`;
    sqlOutput += `-- This script only contains OPTIONAL ASANAS. Compulsory asanas are loaded dynamically.\n\n`;
    sqlOutput += `TRUNCATE TABLE public.asanas CASCADE;\n\n`;
    sqlOutput += `INSERT INTO public.asanas (asana_code, asana_name, type, base_value, event_type, image_url) VALUES\n`;

    const values = [];

    // Read Top Level Category (e.g., LBB, HBB)
    const groups = fs.readdirSync(OPTIONAL_ASANAS_DIR).filter(file => {
        const fullPath = path.join(OPTIONAL_ASANAS_DIR, file);
        return fs.statSync(fullPath).isDirectory();
    });

    for (const group of groups) {
        const groupDir = path.join(OPTIONAL_ASANAS_DIR, group);

        // Read Base Values (e.g., 0.80, 0.90)
        const baseValues = fs.readdirSync(groupDir).filter(file => {
            const fullPath = path.join(groupDir, file);
            return fs.statSync(fullPath).isDirectory();
        });

        for (const baseValueStr of baseValues) {
            const baseValueDir = path.join(groupDir, baseValueStr);
            const baseValue = parseFloat(baseValueStr);

            // Read the image files
            const files = fs.readdirSync(baseValueDir).filter(file => {
                const fullPath = path.join(baseValueDir, file);
                return fs.statSync(fullPath).isFile() && !file.startsWith('.');
            });

            for (const file of files) {
                // Remove extension for code
                const asanaCode = path.parse(file).name;

                // Keep the whole public path, URL encoded (just in case)
                let imageUrl = `/OPTIONAL ASANAS/${group}/${baseValueStr}/${file}`;

                // Fallback to Code as name
                const asanaName = asanaCode;

                values.push(`('${asanaCode}', '${asanaName}', 'optional', ${baseValue}, 'individual', '${imageUrl}')`);
            }
        }
    }

    sqlOutput += values.join(',\n') + ';\n';

    fs.writeFileSync(SEED_FILE, sqlOutput, 'utf-8');
    console.log(`Successfully generated seed data with ${values.length} optional asanas to ${SEED_FILE}`);
}

try {
    generateSeedData();
} catch (error) {
    console.error('Error generating seed file:', error);
}
